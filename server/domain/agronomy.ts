export const intelligenceVersion = 'demeter-intelligence-v0.3.0'

export type AgronomicFactor =
  | 'canopy_vigor'
  | 'disease_pressure'
  | 'moisture_deficit'
  | 'nutrient_constraint'
  | 'sprayability'
  | 'thermal_stress'

export type RiskClass = 'low' | 'watch' | 'elevated' | 'critical'

export type EvidenceSourceId = 'sentinel-2' | 'weather' | 'soilgrids' | 'farmer-observation' | 'crop-doctor'

export type EvidenceSignal = {
  confidence: number
  description: string
  factor: AgronomicFactor
  source: EvidenceSourceId
  value: number
  weight: number
}

export type IntelligenceFinding = {
  factor: AgronomicFactor
  evidence: EvidenceSignal[]
  explanation: string
  posterior: number
  riskClass: RiskClass
}

export type IntelligenceRecommendation = {
  action: string
  agronomicRationale: string
  priority: RiskClass
  verification: string
}

export type ProvenanceNode = {
  id: string
  label: string
  kind: 'source' | 'feature' | 'factor' | 'recommendation'
  metadata?: Record<string, string | number | null>
}

export type ProvenanceEdge = {
  confidence: number
  from: string
  label: string
  to: string
}

export type ProvenanceGraph = {
  edges: ProvenanceEdge[]
  nodes: ProvenanceNode[]
}

export type IntelligenceQuality = {
  evidenceCompleteness: number
  meanConfidence: number
  modelUncertainty: number
  staleDataPenalty: number
}

export type WeatherContext = {
  daily?: {
    precipitation_sum?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    time?: string[]
  }
  hourly?: {
    precipitation?: number[]
    relative_humidity_2m?: number[]
    soil_moisture_0_to_1cm?: number[]
    temperature_2m?: number[]
    wind_speed_10m?: number[]
  }
  summary?: {
    maxTemp?: number
    minTemp?: number
    precipitationMm?: number
  }
}

export type SoilContext = {
  layers?: Array<{
    depths?: Array<{
      label?: string
      values?: {
        mean?: number
      }
    }>
    name?: string
  }>
  summary?: string
}

export type SatelliteContext = {
  latestProductId?: string
  latestSceneDate?: string
  productCount?: number
  sceneCloudCover?: number
}

export type LiveFarmContext = {
  satellite: SatelliteContext | null
  soil: SoilContext | null
  weather: WeatherContext | null
}

export type FeatureVector = {
  cloudCover: number | null
  fieldCapacityProxy: number | null
  rainfall24h: number | null
  sandFraction: number | null
  soilMoistureSurface: number | null
  temperatureAmplitude: number | null
  windSpeedMean: number | null
}

export type IntelligenceState = {
  assumptions: string[]
  featureVector: FeatureVector
  findings: IntelligenceFinding[]
  generatedAt: string
  intelligenceVersion: string
  ontologyVersion: string
  provenanceGraph: ProvenanceGraph
  quality: IntelligenceQuality
  recommendations: IntelligenceRecommendation[]
}
