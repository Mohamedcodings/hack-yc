import { readFileSync } from 'node:fs'

import { config } from './config.ts'
import { farmBounds, farmCenter } from './farm.ts'
import { farmDataSources, type FarmDataSource } from './provenance.ts'

type WeatherPayload = {
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
    time?: string[]
    wind_speed_10m?: number[]
  }
}

type SoilGridsLayer = {
  depths?: Array<{
    label?: string
    values?: {
      mean?: number
    }
  }>
  name?: string
}

type SoilGridsPayload = {
  properties?: {
    layers?: SoilGridsLayer[]
  }
  type?: string
}

type StacPayload = {
  features?: Array<{
    id?: string
    properties?: {
      datetime?: string
      'eo:cloud_cover'?: number
    }
  }>
  type?: string
}

type WeatherContextResponse = {
  provider: string
  source: FarmDataSource
  weather: WeatherPayload & {
    summary?: {
      date?: string
      maxTemp?: number
      minTemp?: number
      precipitationMm?: number
    }
  }
}

type SoilContextResponse = {
  provider: string
  soil: {
    layers: SoilGridsLayer[]
    summary: string
    type?: string
  }
  source: FarmDataSource
}

type SatelliteContextResponse = {
  provider: string
  satellite: {
    latestProductId?: string
    latestSceneDate: string
    productCount: number
    sceneCloudCover?: number
  }
  source: FarmDataSource
}

function readFixture<T>(fileName: string): T {
  return JSON.parse(readFileSync(new URL(`./fixtures/live-context/${fileName}`, import.meta.url), 'utf8')) as T
}

const cachedWeatherFixture = readFixture<WeatherContextResponse>('weather.json')
const cachedSoilFixture = readFixture<SoilContextResponse>('soil.json')
const cachedSatelliteFixture = readFixture<SatelliteContextResponse>('satellite.json')

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

function connectedSource(id: string, overrides: Partial<FarmDataSource>): FarmDataSource {
  const base = farmDataSources.find((source) => source.id === id)

  if (!base) {
    throw new Error(`Unknown source ${id}`)
  }

  return {
    ...base,
    ...overrides,
    status: 'connected',
  }
}

function degradedSource(id: string, error: unknown): FarmDataSource {
  const base = farmDataSources.find((source) => source.id === id)
  const message = error instanceof Error ? error.message : 'connector unavailable'

  if (!base) {
    throw new Error(`Unknown source ${id}`)
  }

  return {
    ...base,
    evidence: message,
    lastSync: 'live connector unavailable',
    status: 'degraded',
  }
}

function cachedSource(source: FarmDataSource, error: unknown): FarmDataSource {
  const message = error instanceof Error ? error.message : 'live connector unavailable'

  return {
    ...source,
    evidence: `${source.evidence ?? 'cached connector snapshot'} · snapshot fallback: ${message}`,
    lastSync: `${source.lastSync} · cached fallback`,
    status: 'degraded',
  }
}

function cachedWeatherContext(error: unknown): WeatherContextResponse {
  const cached = clone(cachedWeatherFixture)

  return {
    ...cached,
    provider: `${cached.provider} · cached fallback`,
    source: cachedSource(cached.source, error),
  }
}

function cachedSoilContext(error: unknown): SoilContextResponse {
  const cached = clone(cachedSoilFixture)

  return {
    ...cached,
    provider: `${cached.provider} · cached fallback`,
    source: cachedSource(cached.source, error),
  }
}

function cachedSatelliteContext(error: unknown): SatelliteContextResponse {
  const cached = clone(cachedSatelliteFixture)

  return {
    ...cached,
    provider: `${cached.provider} · cached fallback`,
    source: cachedSource(cached.source, error),
  }
}

async function withConnectorMode<T>(fetchLive: () => Promise<T>, fetchCached: (error: unknown) => T): Promise<T> {
  if (config.dataMode === 'snapshot') {
    return fetchCached(new Error('DEMETER_DATA_MODE=snapshot'))
  }

  try {
    return await fetchLive()
  } catch (error) {
    if (config.dataMode === 'live') {
      throw error
    }

    return fetchCached(error)
  }
}

async function fetchWeatherLive(): Promise<WeatherContextResponse> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')

  url.searchParams.set('latitude', String(farmCenter.lat))
  url.searchParams.set('longitude', String(farmCenter.lon))
  url.searchParams.set('timezone', 'Europe/Paris')
  url.searchParams.set('forecast_days', '2')
  url.searchParams.set(
    'hourly',
    'temperature_2m,relative_humidity_2m,precipitation,soil_moisture_0_to_1cm,soil_temperature_0cm,wind_speed_10m',
  )
  url.searchParams.set('daily', 'precipitation_sum,temperature_2m_max,temperature_2m_min')

  const data = await fetchJson<WeatherPayload>(url.toString())
  const today = data.daily?.time?.[0] ?? 'today'
  const maxTemp = data.daily?.temperature_2m_max?.[0]
  const minTemp = data.daily?.temperature_2m_min?.[0]
  const rain = data.daily?.precipitation_sum?.[0]

  return {
    provider: 'Open-Meteo forecast API',
    source: connectedSource('meteo-france', {
      apiUrl: url.origin,
      evidence: `${today}: ${minTemp ?? '?'}-${maxTemp ?? '?'}C, ${rain ?? '?'} mm rain`,
      lastSync: new Date().toISOString(),
    }),
    weather: {
      daily: data.daily,
      hourly: data.hourly,
      summary: {
        date: today,
        maxTemp,
        minTemp,
        precipitationMm: rain,
      },
    },
  }
}

export async function fetchWeatherContext() {
  return withConnectorMode(fetchWeatherLive, cachedWeatherContext)
}

async function fetchSoilLive(): Promise<SoilContextResponse> {
  const url = new URL('https://rest.isric.org/soilgrids/v2.0/properties/query')

  url.searchParams.set('lon', String(farmCenter.lon))
  url.searchParams.set('lat', String(farmCenter.lat))
  for (const property of ['clay', 'sand', 'silt', 'soc', 'nitrogen']) {
    url.searchParams.append('property', property)
  }
  for (const depth of ['0-5cm', '5-15cm']) {
    url.searchParams.append('depth', depth)
  }
  url.searchParams.set('value', 'mean')

  const data = await fetchJson<SoilGridsPayload>(url.toString())
  const layers = data.properties?.layers ?? []
  const layerSummary = layers
    .map((layer) => `${layer.name}: ${layer.depths?.[0]?.values?.mean ?? 'n/a'}`)
    .slice(0, 3)
    .join(', ')

  return {
    provider: 'ISRIC SoilGrids REST API',
    soil: {
      layers,
      summary: layerSummary,
      type: data.type,
    },
    source: connectedSource('soilgrids', {
      apiUrl: url.origin,
      evidence: layerSummary || `${layers.length} soil layers returned`,
      lastSync: new Date().toISOString(),
    }),
  }
}

export async function fetchSoilContext() {
  return withConnectorMode(fetchSoilLive, cachedSoilContext)
}

async function fetchSatelliteLive(): Promise<SatelliteContextResponse> {
  const body = {
    bbox: [farmBounds.west, farmBounds.south, farmBounds.east, farmBounds.north],
    collections: ['sentinel-2-l2a'],
    datetime: '2026-05-29T00:00:00Z/2026-06-28T23:59:59Z',
    limit: 5,
  }

  const data = await fetchJson<StacPayload>('https://stac.dataspace.copernicus.eu/v1/search', {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  const latest = data.features?.[0]
  const cloudCover = latest?.properties?.['eo:cloud_cover']
  const latestDate = latest?.properties?.datetime ?? 'latest catalogue scene'

  return {
    provider: 'Copernicus Data Space STAC API',
    satellite: {
      latestProductId: latest?.id,
      latestSceneDate: latestDate,
      productCount: data.features?.length ?? 0,
      sceneCloudCover: cloudCover,
    },
    source: connectedSource('sentinel-2', {
      apiUrl: 'https://stac.dataspace.copernicus.eu/v1',
      evidence: `${latest?.id ?? 'scene'} · cloud ${cloudCover ?? 'n/a'}%`,
      lastSync: latestDate,
    }),
  }
}

export async function fetchSatelliteContext() {
  return withConnectorMode(fetchSatelliteLive, cachedSatelliteContext)
}

export async function getLiveDataSources() {
  const [satellite, weather, soil] = await Promise.allSettled([
    fetchSatelliteContext(),
    fetchWeatherContext(),
    fetchSoilContext(),
  ])

  const sentinelSource =
    satellite.status === 'fulfilled' ? satellite.value.source : degradedSource('sentinel-2', satellite.reason)
  const weatherSource =
    weather.status === 'fulfilled' ? weather.value.source : degradedSource('meteo-france', weather.reason)
  const soilSource = soil.status === 'fulfilled' ? soil.value.source : degradedSource('soilgrids', soil.reason)

  return farmDataSources.map((source) => {
    if (source.id === sentinelSource.id) {
      return sentinelSource
    }

    if (source.id === weatherSource.id) {
      return weatherSource
    }

    if (source.id === soilSource.id) {
      return soilSource
    }

    return source
  })
}

export async function getLiveFarmContext() {
  const [satellite, weather, soil] = await Promise.allSettled([
    fetchSatelliteContext(),
    fetchWeatherContext(),
    fetchSoilContext(),
  ])

  return {
    satellite: satellite.status === 'fulfilled' ? satellite.value.satellite : null,
    soil: soil.status === 'fulfilled' ? soil.value.soil : null,
    weather: weather.status === 'fulfilled' ? weather.value.weather : null,
  }
}
