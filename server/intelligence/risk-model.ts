import type { EvidenceSignal, FeatureVector } from '../domain/agronomy.ts'

function normalize(value: number | null, low: number, high: number) {
  if (value == null) {
    return 0.35
  }

  return Math.max(0, Math.min(1, (value - low) / (high - low)))
}

export function deriveEvidenceSignals(features: FeatureVector): EvidenceSignal[] {
  const rainPressure = normalize(features.rainfall24h, 0, 12)
  const windPenalty = normalize(features.windSpeedMean, 8, 28)
  const moistureDeficit = 1 - normalize(features.soilMoistureSurface, 0.08, 0.32)
  const retentionConstraint = 1 - (features.fieldCapacityProxy ?? 0.5)
  const thermalAmplitude = normalize(features.temperatureAmplitude, 6, 18)
  const cloudPenalty = normalize(features.cloudCover, 0, 80)

  return [
    {
      confidence: features.rainfall24h == null ? 0.35 : 0.82,
      description: `Rainfall-driven foliar disease pressure score ${rainPressure.toFixed(2)}.`,
      factor: 'disease_pressure',
      source: 'weather',
      value: rainPressure,
      weight: 0.34,
    },
    {
      confidence: features.soilMoistureSurface == null ? 0.35 : 0.78,
      description: `Surface soil moisture deficit score ${moistureDeficit.toFixed(2)}.`,
      factor: 'moisture_deficit',
      source: 'weather',
      value: moistureDeficit,
      weight: 0.31,
    },
    {
      confidence: features.fieldCapacityProxy == null ? 0.36 : 0.72,
      description: `Soil water-retention constraint score ${retentionConstraint.toFixed(2)}.`,
      factor: 'moisture_deficit',
      source: 'soilgrids',
      value: retentionConstraint,
      weight: 0.24,
    },
    {
      confidence: features.temperatureAmplitude == null ? 0.35 : 0.76,
      description: `Thermal amplitude stress score ${thermalAmplitude.toFixed(2)}.`,
      factor: 'thermal_stress',
      source: 'weather',
      value: thermalAmplitude,
      weight: 0.26,
    },
    {
      confidence: features.windSpeedMean == null ? 0.35 : 0.8,
      description: `Sprayability penalty from wind speed score ${windPenalty.toFixed(2)}.`,
      factor: 'sprayability',
      source: 'weather',
      value: windPenalty,
      weight: 0.27,
    },
    {
      confidence: features.cloudCover == null ? 0.35 : 0.68,
      description: `Satellite observation uncertainty from cloud cover score ${cloudPenalty.toFixed(2)}.`,
      factor: 'canopy_vigor',
      source: 'sentinel-2',
      value: cloudPenalty,
      weight: 0.18,
    },
  ]
}
