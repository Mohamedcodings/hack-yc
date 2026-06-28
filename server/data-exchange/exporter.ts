import { farmId } from '../farm.js'
import type { IntelligenceState, LiveFarmContext } from '../domain/agronomy.js'
import type { DataExchangeManifest, DataExchangeRequest } from '../domain/data-exchange.js'
import { getDataProduct } from './catalog.js'
import { buildContractTerms, dataGovernancePolicy, governanceVersion } from './governance.js'

function formatTimeRange(request: DataExchangeRequest) {
  if (!request.timeRange) {
    return 'latest available nowcast'
  }

  return `${request.timeRange.from}/${request.timeRange.to}`
}

function scoreFor(intelligence: IntelligenceState, factor: string) {
  return intelligence.findings.find((finding) => finding.factor === factor)?.posterior ?? 0
}

function classFor(intelligence: IntelligenceState, factor: string) {
  return intelligence.findings.find((finding) => finding.factor === factor)?.riskClass ?? 'low'
}

function buildSampleRecords(
  request: DataExchangeRequest,
  context: LiveFarmContext,
  intelligence: IntelligenceState,
): Array<Record<string, number | string | boolean>> {
  const region = request.region ?? 'Hauts-de-France-demo-grid'
  const uncertainty = intelligence.quality.modelUncertainty

  return [
    {
      area_id: `${region}:cell-001`,
      crop_group: 'winter-cereals',
      disease_pressure_score: Number(scoreFor(intelligence, 'disease_pressure').toFixed(3)),
      farm_id_hash: `${farmId}:hashed-preview`,
      model_uncertainty: uncertainty,
      moisture_deficit_score: Number(scoreFor(intelligence, 'moisture_deficit').toFixed(3)),
      source_scene_count: context.satellite?.productCount ?? 0,
    },
    {
      area_id: `${region}:cell-002`,
      canopy_vigor_class: classFor(intelligence, 'canopy_vigor'),
      crop_group: 'oilseed',
      field_capacity_proxy: intelligence.featureVector.fieldCapacityProxy ?? 0,
      model_uncertainty: uncertainty,
      sprayability_penalty: Number(scoreFor(intelligence, 'sprayability').toFixed(3)),
      thermal_stress_score: Number(scoreFor(intelligence, 'thermal_stress').toFixed(3)),
    },
  ]
}

export function buildDataExchangeManifest(
  request: DataExchangeRequest,
  context: LiveFarmContext,
  intelligence: IntelligenceState,
): DataExchangeManifest {
  const product = getDataProduct(request.productId)

  if (!product) {
    throw new Error(`Unknown data product ${request.productId}`)
  }

  if (!product.eligibleBuyers.includes(request.buyerSegment)) {
    throw new Error(`${request.buyerSegment} is not eligible for ${product.id}`)
  }

  if (!product.deliveryFormats.includes(request.format)) {
    throw new Error(`${request.format} is not available for ${product.id}`)
  }

  return {
    audit: {
      generatedAt: new Date().toISOString(),
      governanceVersion,
      requestId: `dxe_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    },
    contract: buildContractTerms(product, request.buyerSegment),
    delivery: {
      format: request.format,
      region: request.region ?? 'Hauts-de-France preview region',
      temporalCoverage: formatTimeRange(request),
    },
    lineage: [
      { source: 'sentinel-2', transformation: 'scene metadata extraction and cloud-cover quality signal' },
      { source: 'weather', transformation: 'rainfall, wind, soil-moisture, and temperature feature engineering' },
      { source: 'soilgrids', transformation: 'soil texture and water-retention proxy extraction' },
      { source: 'intelligence-engine', transformation: 'confidence-weighted evidence fusion and uncertainty scoring' },
      { source: 'farm-ontology', transformation: 'crop/factor normalization into buyer-safe schema' },
    ],
    product,
    quality: {
      ...intelligence.quality,
      completenessSla: `minimum ${dataGovernancePolicy.aggregationThreshold} farms or parcels per commercial aggregate`,
      latencySla: 'daily nowcast, hourly weather refresh when provider is available',
    },
    sampleRecords: buildSampleRecords(request, context, intelligence),
  }
}
