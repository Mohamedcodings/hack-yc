import type { FeatureVector, LiveFarmContext, SoilContext, WeatherContext } from '../domain/agronomy.js'

function mean(values: Array<number | undefined> | undefined) {
  const filtered = values?.filter((value): value is number => Number.isFinite(value)) ?? []

  if (filtered.length === 0) {
    return null
  }

  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length
}

function firstSoilLayerValue(soil: SoilContext | null, layerName: string) {
  const layer = soil?.layers?.find((candidate) => candidate.name === layerName)
  return layer?.depths?.[0]?.values?.mean ?? null
}

function temperatureAmplitude(weather: WeatherContext | null) {
  const maxTemp = weather?.summary?.maxTemp ?? weather?.daily?.temperature_2m_max?.[0]
  const minTemp = weather?.summary?.minTemp ?? weather?.daily?.temperature_2m_min?.[0]

  if (maxTemp == null || minTemp == null) {
    return null
  }

  return maxTemp - minTemp
}

function fieldCapacityProxy(soil: SoilContext | null) {
  const clay = firstSoilLayerValue(soil, 'clay')
  const sand = firstSoilLayerValue(soil, 'sand')

  if (clay == null || sand == null) {
    return null
  }

  return Math.max(0, Math.min(1, (clay / 1000) * 0.62 + (1 - sand / 1000) * 0.38))
}

export function buildFeatureVector(context: LiveFarmContext): FeatureVector {
  return {
    cloudCover: context.satellite?.sceneCloudCover ?? null,
    fieldCapacityProxy: fieldCapacityProxy(context.soil),
    rainfall24h: context.weather?.summary?.precipitationMm ?? context.weather?.daily?.precipitation_sum?.[0] ?? null,
    sandFraction: firstSoilLayerValue(context.soil, 'sand'),
    soilMoistureSurface: mean(context.weather?.hourly?.soil_moisture_0_to_1cm),
    temperatureAmplitude: temperatureAmplitude(context.weather),
    windSpeedMean: mean(context.weather?.hourly?.wind_speed_10m),
  }
}
