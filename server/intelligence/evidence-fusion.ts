import type { AgronomicFactor, EvidenceSignal, IntelligenceFinding, RiskClass } from '../domain/agronomy.js'

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

export function classifyRisk(posterior: number): RiskClass {
  if (posterior >= 0.78) {
    return 'critical'
  }

  if (posterior >= 0.58) {
    return 'elevated'
  }

  if (posterior >= 0.34) {
    return 'watch'
  }

  return 'low'
}

export function fuseEvidence(signals: EvidenceSignal[]): IntelligenceFinding[] {
  const grouped = new Map<AgronomicFactor, EvidenceSignal[]>()

  for (const signal of signals) {
    grouped.set(signal.factor, [...(grouped.get(signal.factor) ?? []), signal])
  }

  return Array.from(grouped.entries()).map(([factor, evidence]) => {
    const weighted = evidence.reduce(
      (accumulator, signal) => {
        const effectiveWeight = signal.weight * signal.confidence
        return {
          total: accumulator.total + signal.value * effectiveWeight,
          weight: accumulator.weight + effectiveWeight,
        }
      },
      { total: 0, weight: 0 },
    )
    const posterior = clamp01(weighted.weight > 0 ? weighted.total / weighted.weight : 0)

    return {
      evidence,
      explanation: evidence.map((signal) => signal.description).join(' '),
      factor,
      posterior,
      riskClass: classifyRisk(posterior),
    }
  })
}
