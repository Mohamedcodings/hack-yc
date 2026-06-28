import type { EvidenceSourceId, IntelligenceQuality } from './agronomy.ts'

export type BuyerSegment = 'cooperative' | 'enterprise' | 'government' | 'insurance' | 'research'

export type DeliveryFormat = 'geojson' | 'json' | 'parquet' | 'stac-item'

export type PrivacyClass = 'aggregated' | 'anonymized' | 'consented-field-level'

export type DataProductCategory =
  | 'climate-risk'
  | 'crop-health'
  | 'food-security'
  | 'input-optimization'
  | 'soil-water'
  | 'supply-chain'

export type DataProductField = {
  description: string
  name: string
  type: 'array' | 'boolean' | 'number' | 'object' | 'string'
}

export type DataProduct = {
  category: DataProductCategory
  description: string
  deliveryFormats: DeliveryFormat[]
  eligibleBuyers: BuyerSegment[]
  fields: DataProductField[]
  governanceControls: string[]
  id: string
  license: string
  name: string
  pricingUnit: string
  privacyClass: PrivacyClass
  sources: EvidenceSourceId[]
  spatialResolution: string
  temporalResolution: string
  useCases: string[]
}

export type DataExchangeRequest = {
  buyerSegment: BuyerSegment
  format: DeliveryFormat
  productId: string
  purpose: string
  region?: string
  timeRange?: {
    from: string
    to: string
  }
}

export type DataGovernancePolicy = {
  aggregationThreshold: number
  consentModel: string
  exportRestrictions: string[]
  fieldBoundaryPolicy: string
  privacyGuarantees: string[]
  retentionPolicy: string
}

export type DataExchangeManifest = {
  audit: {
    generatedAt: string
    governanceVersion: string
    requestId: string
  }
  contract: {
    buyerSegment: BuyerSegment
    license: string
    permittedUses: string[]
    prohibitedUses: string[]
    pricingUnit: string
  }
  delivery: {
    format: DeliveryFormat
    region: string
    temporalCoverage: string
  }
  lineage: Array<{
    source: EvidenceSourceId | 'farm-ontology' | 'intelligence-engine'
    transformation: string
  }>
  product: DataProduct
  quality: IntelligenceQuality & {
    completenessSla: string
    latencySla: string
  }
  sampleRecords: Array<Record<string, number | string | boolean>>
}
