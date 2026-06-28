import {
  intelligenceVersion,
  type IntelligenceState,
  type LiveFarmContext,
} from '../domain/agronomy.ts'
import { fuseEvidence } from './evidence-fusion.ts'
import { buildFeatureVector } from './feature-engineering.ts'
import { buildProvenanceGraph } from './provenance-graph.ts'
import { deriveEvidenceSignals } from './risk-model.ts'
import { ontologyVersion } from './ontology.ts'
import { buildRecommendations } from './recommendation-engine.ts'
import { estimateIntelligenceQuality } from './uncertainty.ts'

export function runAgronomicIntelligence(context: LiveFarmContext): IntelligenceState {
  const featureVector = buildFeatureVector(context)
  const signals = deriveEvidenceSignals(featureVector)
  const findings = fuseEvidence(signals)
  const recommendations = buildRecommendations(findings)
  const provenanceGraph = buildProvenanceGraph(featureVector, findings, recommendations)
  const quality = estimateIntelligenceQuality(featureVector, signals)

  return {
    assumptions: [
      'Risk scores are evidence-fusion outputs, not regulatory pesticide prescriptions.',
      'Live weather, soil, and satellite metadata are fused with the map context.',
      'Chemical actions require label compliance and local agronomist validation.',
    ],
    featureVector,
    findings,
    generatedAt: new Date().toISOString(),
    intelligenceVersion,
    ontologyVersion,
    provenanceGraph,
    quality,
    recommendations,
  }
}
