import type { IntelligenceFinding, IntelligenceRecommendation } from '../domain/agronomy.js'

const actionByFactor = {
  canopy_vigor: 'Use the next cloud-free image before changing rates.',
  disease_pressure: 'Scout lower-canopy leaves and verify disease lesions before treatment.',
  moisture_deficit: 'Check soil moisture at the transition between green and yellow raster cells.',
  nutrient_constraint: 'Add a tissue or soil sample before adjusting nitrogen.',
  sprayability: 'Delay spray work until wind and rainfall window are acceptable.',
  thermal_stress: 'Inspect compacted or shallow-soil areas during the warmest part of the day.',
}

export function buildRecommendations(findings: IntelligenceFinding[]): IntelligenceRecommendation[] {
  return findings
    .filter((finding) => finding.riskClass !== 'low')
    .sort((left, right) => right.posterior - left.posterior)
    .slice(0, 4)
    .map((finding) => ({
      action: actionByFactor[finding.factor],
      agronomicRationale: finding.explanation,
      priority: finding.riskClass,
      verification: 'Confirm with field observation before applying chemical or rate changes.',
    }))
}
