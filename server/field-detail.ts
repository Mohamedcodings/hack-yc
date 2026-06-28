import { fetchNdviImage, fetchNdviTimeSeries } from './sentinel-hub.js'
import { fieldBbox, getField, getFields, type FieldRecord } from './fields.js'

// Real satellite imagery for a field bbox via Esri World Imagery export (free, no key).
function arcgisSatelliteUrl(bbox: [number, number, number, number]): string {
  const [w, s, e, n] = bbox
  const padX = (e - w) * 0.25 || 0.001
  const padY = (n - s) * 0.25 || 0.001
  const box = [w - padX, s - padY, e + padX, n + padY].join(',')
  return (
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export' +
    `?bbox=${box}&bboxSR=4326&imageSR=4326&size=720,520&format=jpg&f=image`
  )
}

// Assembles the per-field detail payload that the frontend FieldDetailPanel/WeatherModal
// consume. Live where reliable (Open-Meteo weather + season; Sentinel Hub NDVI), mock
// fallback everywhere so the demo never breaks. Shape matches src/lib/dataLayer.ts types.

export interface SeriesPoint {
  date: string
  value: number
}

interface ForecastDay {
  label: string
  date: string
  icon: 'sun' | 'cloud' | 'rain'
  tempMin: number
  tempMax: number
  precipMm: number
  windMs: number
  windDir: string
  cloudPct: number
  humidityPct: number
  dewPointC: number
}

const DAY_LABELS = ['Today', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function mulberry32(seed: number) {
  return function next() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFrom(id: string) {
  return Number(id.replace(/\D/g, '')) || 1
}

function degToArrow(deg: number | undefined) {
  if (deg === undefined) {
    return '→'
  }
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']
  return arrows[Math.round(deg / 45) % 8]
}

function mean(values: number[]) {
  const valid = values.filter((v) => Number.isFinite(v))
  return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : 0
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

/* ---- mock fallbacks --------------------------------------------------- */

function mockSeries(id: string) {
  const rng = mulberry32(seedFrom(id) * 7919)
  const ndviSeries: SeriesPoint[] = []
  const precipitationSeries: SeriesPoint[] = []
  const gddSeries: SeriesPoint[] = []
  let precipAcc = 0
  let gddAcc = 0
  const days = 179

  for (let d = 0; d <= days; d += 7) {
    const t = d / days
    const date = `2026-${String(1 + Math.floor(t * 5.9)).padStart(2, '0')}-15`
    ndviSeries.push({ date, value: Number(Math.max(0.18, Math.min(0.85, 0.22 + t * 0.62 + (rng() - 0.5) * 0.06)).toFixed(2)) })
    precipAcc += 8 + rng() * 22 + t * 6
    precipitationSeries.push({ date, value: Math.round(precipAcc) })
    gddAcc += 2 + t * 34 + rng() * 6
    gddSeries.push({ date, value: Math.round(gddAcc) })
  }

  return { ndviSeries, precipitationSeries, gddSeries, summary: { precipitationMm: Math.round(precipAcc), gdd: Math.round(gddAcc), periodDays: days } }
}

function mockWeather(id: string) {
  const rng = mulberry32(seedFrom(id) * 104729)
  const series = (base: number, spread: number, n = 24) =>
    Array.from({ length: n }, (_, i) => Number((base + Math.sin(i / 3) * spread + (rng() - 0.5) * spread).toFixed(1)))
  const icons: ForecastDay['icon'][] = ['sun', 'cloud', 'sun', 'cloud', 'sun', 'sun', 'sun']

  return {
    now: { temperatureC: 23, precipitationMm: 0, windMs: 4, windDir: '→', cloudCoverPct: 0, humidityPct: 78, dewPointC: 19 },
    hourly: { temp: series(23, 4), wind: series(4, 2), cloud: series(20, 18), humidity: series(70, 12), dew: series(18, 3) },
    forecast: DAY_LABELS.map((label, i) => ({
      label,
      date: ['Jun 28', 'Jun 29', 'Jun 30', 'Jul 1', 'Jul 2', 'Jul 3', 'Jul 4'][i],
      icon: icons[i],
      tempMin: [18, 13, 11, 11, 12, 10, 11][i],
      tempMax: [31, 26, 27, 25, 28, 24, 27][i],
      precipMm: 0,
      windMs: [7, 5, 5, 5, 8, 6, 7][i],
      windDir: ['→', '↘', '↓', '↗', '←', '↓', '→'][i],
      cloudPct: [27, 40, 12, 37, 17, 3, 3][i],
      humidityPct: [68, 62, 48, 61, 64, 55, 48][i],
      dewPointC: [16, 12, 8, 11, 12, 7, 7][i],
    })),
  }
}

/* ---- live weather (Open-Meteo) ---------------------------------------- */

type ForecastResponse = {
  current?: Record<string, number>
  hourly?: Record<string, number[]>
  daily?: Record<string, Array<number | string>>
}

async function liveWeather([lat, lon]: [number, number]) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('timezone', 'Europe/Paris')
  url.searchParams.set('forecast_days', '7')
  url.searchParams.set('current', 'temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m,dew_point_2m')
  url.searchParams.set('hourly', 'temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m,dew_point_2m')
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum')

  const data = await fetchJson<ForecastResponse>(url.toString())
  const cur = data.current ?? {}
  const h = data.hourly ?? {}
  const dy = data.daily ?? {}
  const first24 = (key: string) => (h[key] ?? []).slice(0, 24).map((v) => Number(Number(v).toFixed(1)))

  const days = Math.min(7, (dy.time as string[] | undefined)?.length ?? 0)
  const forecast: ForecastDay[] = []

  for (let i = 0; i < days; i += 1) {
    const slice = (key: string) => (h[key] ?? []).slice(i * 24, i * 24 + 24).map(Number)
    const cloudMean = mean(slice('cloud_cover'))
    const precip = Number(dy.precipitation_sum?.[i] ?? 0)
    const date = String(dy.time?.[i] ?? '')

    forecast.push({
      label: DAY_LABELS[i] ?? `D${i}`,
      date: date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      icon: precip > 1 ? 'rain' : cloudMean > 45 ? 'cloud' : 'sun',
      tempMin: Math.round(Number(dy.temperature_2m_min?.[i] ?? 0)),
      tempMax: Math.round(Number(dy.temperature_2m_max?.[i] ?? 0)),
      precipMm: Number(precip.toFixed(1)),
      windMs: Math.round(mean(slice('wind_speed_10m'))),
      windDir: degToArrow(mean(slice('wind_direction_10m'))),
      cloudPct: Math.round(cloudMean),
      humidityPct: Math.round(mean(slice('relative_humidity_2m'))),
      dewPointC: Math.round(mean(slice('dew_point_2m'))),
    })
  }

  return {
    now: {
      temperatureC: Math.round(cur.temperature_2m ?? 0),
      precipitationMm: Number((cur.precipitation ?? 0).toFixed(1)),
      windMs: Math.round(cur.wind_speed_10m ?? 0),
      windDir: degToArrow(cur.wind_direction_10m),
      cloudCoverPct: Math.round(cur.cloud_cover ?? 0),
      humidityPct: Math.round(cur.relative_humidity_2m ?? 0),
      dewPointC: Math.round(cur.dew_point_2m ?? 0),
    },
    hourly: {
      temp: first24('temperature_2m'),
      wind: first24('wind_speed_10m'),
      cloud: first24('cloud_cover'),
      humidity: first24('relative_humidity_2m'),
      dew: first24('dew_point_2m'),
    },
    forecast,
  }
}

/* ---- live season charts (Open-Meteo archive: precip accumulation + GDD) */

type ArchiveResponse = { daily?: { time?: string[]; precipitation_sum?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[] } }

async function liveSeason([lat, lon]: [number, number]) {
  const end = new Date()
  end.setDate(end.getDate() - 3) // ERA5 lag
  const start = new Date(end)
  start.setDate(start.getDate() - 179)
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('start_date', iso(start))
  url.searchParams.set('end_date', iso(end))
  url.searchParams.set('timezone', 'Europe/Paris')
  url.searchParams.set('daily', 'precipitation_sum,temperature_2m_max,temperature_2m_min')

  const data = await fetchJson<ArchiveResponse>(url.toString())
  const time = data.daily?.time ?? []
  const precip = data.daily?.precipitation_sum ?? []
  const tmax = data.daily?.temperature_2m_max ?? []
  const tmin = data.daily?.temperature_2m_min ?? []

  if (time.length < 14) {
    return null
  }

  const precipitationSeries: SeriesPoint[] = []
  const gddSeries: SeriesPoint[] = []
  let precipAcc = 0
  let gddAcc = 0

  for (let i = 0; i < time.length; i += 1) {
    precipAcc += Number(precip[i] ?? 0)
    const avg = (Number(tmax[i] ?? 0) + Number(tmin[i] ?? 0)) / 2
    gddAcc += Math.max(0, avg - 8) // base 8C
    if (i % 7 === 0 || i === time.length - 1) {
      precipitationSeries.push({ date: time[i], value: Math.round(precipAcc) })
      gddSeries.push({ date: time[i], value: Math.round(gddAcc) })
    }
  }

  return {
    precipitationSeries,
    gddSeries,
    summary: { precipitationMm: Math.round(precipAcc), gdd: Math.round(gddAcc), periodDays: time.length },
  }
}

/* ---- assembly --------------------------------------------------------- */

export function listFields() {
  return getFields()
}

export async function buildFieldDetail(id: string) {
  const field = getField(id) ?? getFields()[0]
  const fallback = mockSeries(field.id)
  const bbox = fieldBbox(field)

  const [ndviRes, weatherRes, seasonRes, ndviImgRes] = await Promise.allSettled([
    fetchNdviTimeSeries(bbox),
    liveWeather(field.centroid),
    liveSeason(field.centroid),
    fetchNdviImage(bbox),
  ])

  const ndvi = ndviRes.status === 'fulfilled' ? ndviRes.value : null
  const liveWx = weatherRes.status === 'fulfilled' ? weatherRes.value : null
  const season = seasonRes.status === 'fulfilled' ? seasonRes.value : null
  const ndviImageUrl = ndviImgRes.status === 'fulfilled' ? ndviImgRes.value : null

  const ndviSeries = ndvi?.ndviSeries.length ? ndvi.ndviSeries : fallback.ndviSeries
  const precipitationSeries = season?.precipitationSeries ?? fallback.precipitationSeries
  const gddSeries = season?.gddSeries ?? fallback.gddSeries
  const summary = season?.summary ?? fallback.summary
  const weather = liveWx ?? mockWeather(field.id)
  const latestNdvi = ndvi?.latestNdvi ?? ndviSeries[ndviSeries.length - 1]?.value ?? field.ndvi

  const provenance = {
    ndvi: ndvi ? 'Sentinel Hub Statistical API' : 'mock',
    ndviImage: ndviImageUrl ? 'Sentinel Hub Process API' : 'synthetic',
    satellite: 'Esri World Imagery',
    weather: liveWx ? 'Open-Meteo forecast API' : 'mock',
    season: season ? 'Open-Meteo archive API' : 'mock',
  }

  return {
    field: { ...field, ndvi: Number(latestNdvi.toFixed?.(2) ?? latestNdvi) },
    ndviSeries,
    precipitationSeries,
    gddSeries,
    summary,
    weather,
    satellite: { ndviDate: 'Jun 20, 2026', imageDate: 'Jun 23, 2026' },
    images: { satelliteUrl: arcgisSatelliteUrl(bbox), ndviUrl: ndviImageUrl },
    provenance,
  }
}

export type { FieldRecord }
