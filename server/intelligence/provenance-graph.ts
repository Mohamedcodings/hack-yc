import type {
  EvidenceSignal,
  FeatureVector,
  IntelligenceFinding,
  IntelligenceRecommendation,
  ProvenanceGraph,
  ProvenanceNode,
} from '../domain/agronomy.ts'

const featureSourceMap: Record<keyof FeatureVector, EvidenceSignal['source']> = {
  cloudCover: 'sentinel-2',
  fieldCapacityProxy: 'soilgrids',
  rainfall24h: 'weather',
  sandFraction: 'soilgrids',
  soilMoistureSurface: 'weather',
  temperatureAmplitude: 'weather',
  windSpeedMean: 'weather',
}

const sourceLabels: Record<EvidenceSignal['source'], string> = {
  'crop-doctor': 'Crop Doctor image diagnosis',
  'farmer-observation': 'Farmer field observation',
  'sentinel-2': 'Copernicus Sentinel-2',
  soilgrids: 'ISRIC SoilGrids',
  weather: 'Open-Meteo weather model',
}

function factorNodeId(factor: string) {
  return `factor:${factor}`
}

export function buildProvenanceGraph(
  featureVector: FeatureVector,
  findings: IntelligenceFinding[],
  recommendations: IntelligenceRecommendation[],
): ProvenanceGraph {
  const nodes = new Map<string, ProvenanceNode>()
  const edges: ProvenanceGraph['edges'] = []

  for (const source of Object.keys(sourceLabels) as EvidenceSignal['source'][]) {
    nodes.set(`source:${source}`, {
      id: `source:${source}`,
      kind: 'source',
      label: sourceLabels[source],
    })
  }

  for (const [feature, value] of Object.entries(featureVector) as Array<[keyof FeatureVector, number | null]>) {
    const featureId = `feature:${feature}`
    nodes.set(featureId, {
      id: featureId,
      kind: 'feature',
      label: feature,
      metadata: { value },
    })
    edges.push({
      confidence: value == null ? 0.35 : 0.8,
      from: `source:${featureSourceMap[feature]}`,
      label: 'extracts',
      to: featureId,
    })
  }

  for (const finding of findings) {
    const id = factorNodeId(finding.factor)
    nodes.set(id, {
      id,
      kind: 'factor',
      label: finding.factor,
      metadata: {
        posterior: finding.posterior,
        riskClass: finding.riskClass,
      },
    })

    for (const signal of finding.evidence) {
      edges.push({
        confidence: signal.confidence,
        from: `source:${signal.source}`,
        label: `supports ${finding.factor}`,
        to: id,
      })
    }
  }

  recommendations.forEach((recommendation, index) => {
    const id = `recommendation:${index + 1}`
    nodes.set(id, {
      id,
      kind: 'recommendation',
      label: recommendation.action,
      metadata: { priority: recommendation.priority },
    })

    const matchingFinding = findings.find((finding) => recommendation.agronomicRationale === finding.explanation)
    if (matchingFinding) {
      edges.push({
        confidence: matchingFinding.evidence.reduce((total, signal) => total + signal.confidence, 0) / matchingFinding.evidence.length,
        from: factorNodeId(matchingFinding.factor),
        label: 'drives',
        to: id,
      })
    }
  })

  return {
    edges,
    nodes: Array.from(nodes.values()),
  }
}
