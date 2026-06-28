import type { AgronomicFactor } from '../domain/agronomy.js'

export const ontologyVersion = 'agronomy-ontology-v0.2.0'

export type CropOntologyNode = {
  diseasePressureFactors: AgronomicFactor[]
  latinName: string
  managementQuestions: string[]
  name: string
  phenologySignals: string[]
}

export const cropOntology: CropOntologyNode[] = [
  {
    diseasePressureFactors: ['disease_pressure', 'moisture_deficit', 'thermal_stress'],
    latinName: 'Triticum aestivum',
    managementQuestions: ['yellow rust pressure', 'nitrogen dilution', 'spray window'],
    name: 'Ble tendre',
    phenologySignals: ['canopy closure', 'flag leaf emergence', 'grain fill'],
  },
  {
    diseasePressureFactors: ['disease_pressure', 'nutrient_constraint'],
    latinName: 'Brassica napus',
    managementQuestions: ['sclerotinia pressure', 'pod set', 'flowering protection'],
    name: 'Colza',
    phenologySignals: ['flowering stage', 'pod density', 'late canopy vigor'],
  },
  {
    diseasePressureFactors: ['moisture_deficit', 'nutrient_constraint'],
    latinName: 'Beta vulgaris',
    managementQuestions: ['root expansion', 'soil compaction', 'leaf disease'],
    name: 'Betterave',
    phenologySignals: ['leaf area expansion', 'root bulking', 'canopy persistence'],
  },
  {
    diseasePressureFactors: ['disease_pressure', 'moisture_deficit'],
    latinName: 'Solanum tuberosum',
    managementQuestions: ['late blight pressure', 'irrigation timing', 'tuber bulking'],
    name: 'Pomme de terre',
    phenologySignals: ['row closure', 'tuber initiation', 'senescence onset'],
  },
]

export function getOntologySnapshot() {
  return {
    crops: cropOntology,
    ontologyVersion,
    researchTerms: [
      'multimodal evidence fusion',
      'remote-sensing vegetation indices',
      'phenology-aware risk scoring',
      'soil-water retention proxy',
      'decision provenance graph',
      'uncertainty-aware agronomic recommendations',
    ],
  }
}
