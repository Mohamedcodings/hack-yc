import type { EvidenceSignal, FeatureVector, IntelligenceQuality } from '../domain/agronomy.ts'

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

export function estimateIntelligenceQuality(features: FeatureVector, signals: EvidenceSignal[]): IntelligenceQuality {
  const featureValues = Object.values(features)
  const knownFeatureCount = featureValues.filter((value) => value !== null).length
  const evidenceCompleteness = knownFeatureCount / featureValues.length
  const meanConfidence =
    signals.length === 0 ? 0 : signals.reduce((total, signal) => total + signal.confidence, 0) / signals.length
  const staleDataPenalty = features.cloudCover == null ? 0.25 : clamp01((features.cloudCover - 35) / 65) * 0.18

  return {
    evidenceCompleteness: Number(evidenceCompleteness.toFixed(3)),
    meanConfidence: Number(meanConfidence.toFixed(3)),
    modelUncertainty: Number(clamp01(1 - evidenceCompleteness * meanConfidence + staleDataPenalty).toFixed(3)),
    staleDataPenalty: Number(staleDataPenalty.toFixed(3)),
  }
}
