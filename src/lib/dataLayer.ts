/*
 * Typed data layer — the seam between the UI (Branch 2) and live data (Branch 3).
 * Branch 2 ships the mock implementation below. Branch 3 will add a real
 * implementation (Sentinel Hub + Open-Meteo) behind the SAME types, so the UI
 * does not change. The active implementation is chosen in `dataLayer` at the bottom.
 */

import { authFetch } from './apiClient'

export type CropName =
  | 'Potato'
  | 'Wheat soft, winter'
  | 'Rapeseed'
  | 'Sugar beet'
  | 'Maize'
  | 'Barley'
  | null

export interface Field {
  id: string
  name: string
  areaHa: number
  crop: CropName
  plantingDate: string | null
  centroid: [number, number]
  boundary: [number, number][]
  outline: string
  ndvi: number
  lastUpdatedDays: number
  analyzed: boolean
}

export interface SeriesPoint {
  date: string
  value: number
}

export interface WeatherNow {
  temperatureC: number
  precipitationMm: number
  windMs: number
  windDir: string
  cloudCoverPct: number
  humidityPct: number
  dewPointC: number
}

export interface ForecastDay {
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

export interface FieldWeather {
  now: WeatherNow
  hourly: {
    temp: number[]
    wind: number[]
    cloud: number[]
    humidity: number[]
    dew: number[]
  }
  forecast: ForecastDay[]
}

export interface FieldDetail {
  field: Field
  ndviSeries: SeriesPoint[]
  precipitationSeries: SeriesPoint[]
  gddSeries: SeriesPoint[]
  weather: FieldWeather
  satellite: { ndviDate: string; imageDate: string }
  images: { satelliteUrl: string; ndviUrl: string | null }
  summary: { precipitationMm: number; gdd: number; periodDays: number }
}

export function arcgisSatelliteUrl(boundary: [number, number][]): string {
  const lats = boundary.map((p) => p[0])
  const lngs = boundary.map((p) => p[1])
  const w = Math.min(...lngs)
  const e = Math.max(...lngs)
  const s = Math.min(...lats)
  const n = Math.max(...lats)
  const padX = (e - w) * 0.25 || 0.001
  const padY = (n - s) * 0.25 || 0.001
  const box = [w - padX, s - padY, e + padX, n + padY].join(',')
  return (
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export' +
    `?bbox=${box}&bboxSR=4326&imageSR=4326&size=720,520&format=jpg&f=image`
  )
}

export interface DataLayer {
  source: 'mock' | 'live'
  listFields(): Promise<Field[]>
  getFieldDetail(id: string): Promise<FieldDetail>
}

/* ---- deterministic helpers ------------------------------------------- */

function mulberry32(seed: number) {
  return function next() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const OUTLINES = ['#e0563b', '#3f7bd6', '#e0c33b', '#f4f4f4', '#9a9a9a', '#7bbf5a', '#b97fd0']
const CROPS: CropName[] = ['Potato', 'Wheat soft, winter', 'Rapeseed', 'Sugar beet', 'Maize', 'Barley', null]

// Real traced parcels — used only as an offline fallback; the API (/api/fields) is the
// source of truth and serves the full set (these + a non-overlapping Voronoi band).
const FALLBACK_POLYGONS: [number, number][][] = [
  [[50.249881, 2.749522], [50.246409, 2.753899], [50.244241, 2.753019], [50.242635, 2.750788], [50.247328, 2.745166]],
  [[50.247219, 2.744994], [50.244968, 2.747891], [50.242402, 2.743514], [50.245051, 2.740273]],
  [[50.244982, 2.740166], [50.242375, 2.743428], [50.240206, 2.738814], [50.243404, 2.736347]],
  [[50.243349, 2.736218], [50.240193, 2.738707], [50.238875, 2.736390], [50.242484, 2.733407]],
  [[50.247795, 2.739780], [50.246080, 2.742076], [50.244200, 2.738299], [50.245682, 2.736089]],
]

function centroidOf(ring: [number, number][]): [number, number] {
  return [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]
}

function buildMockFields(): Field[] {
  const rng = mulberry32(20260628)

  return FALLBACK_POLYGONS.map((boundary, i) => {
    const crop = i % 3 === 0 ? CROPS[i % CROPS.length] : null
    return {
      id: `field-${i + 1}`,
      name: `Field ${i + 1}`,
      areaHa: Number((6 + rng() * 20).toFixed(2)),
      crop,
      plantingDate: crop ? '2026-04-12' : null,
      centroid: centroidOf(boundary),
      boundary,
      outline: OUTLINES[i % OUTLINES.length],
      ndvi: Number((0.32 + rng() * 0.5).toFixed(2)),
      lastUpdatedDays: 2 + Math.floor(rng() * 10),
      analyzed: false,
    }
  })
}

function buildSeries(id: string): Pick<FieldDetail, 'ndviSeries' | 'precipitationSeries' | 'gddSeries' | 'summary'> {
  const seed = id.split('-')[1] ? Number(id.split('-')[1]) : 1
  const rng = mulberry32(seed * 7919)
  const ndviSeries: SeriesPoint[] = []
  const precipitationSeries: SeriesPoint[] = []
  const gddSeries: SeriesPoint[] = []

  let precipAcc = 0
  let gddAcc = 0
  const days = 179

  for (let d = 0; d <= days; d += 7) {
    const t = d / days
    const date = `2026-${String(1 + Math.floor(t * 5.9)).padStart(2, '0')}-15`
    const ndvi = Math.max(0.18, Math.min(0.85, 0.22 + t * 0.62 + (rng() - 0.5) * 0.06))
    ndviSeries.push({ date, value: Number(ndvi.toFixed(2)) })

    precipAcc += 8 + rng() * 22 + t * 6
    precipitationSeries.push({ date, value: Math.round(precipAcc) })

    gddAcc += 2 + t * 34 + rng() * 6
    gddSeries.push({ date, value: Math.round(gddAcc) })
  }

  return {
    ndviSeries,
    precipitationSeries,
    gddSeries,
    summary: {
      precipitationMm: Math.round(precipAcc),
      gdd: Math.round(gddAcc),
      periodDays: days,
    },
  }
}

function buildWeather(id: string): FieldWeather {
  const seed = id.split('-')[1] ? Number(id.split('-')[1]) : 1
  const rng = mulberry32(seed * 104729)
  const series = (base: number, spread: number, n = 24) =>
    Array.from({ length: n }, (_, i) => Number((base + Math.sin(i / 3) * spread + (rng() - 0.5) * spread).toFixed(1)))

  const dirs = ['→', '↘', '↓', '↗', '←']
  const icons: ForecastDay['icon'][] = ['sun', 'cloud', 'sun', 'cloud', 'sun', 'sun', 'sun']
  const labels = ['Today', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dates = ['Jun 28', 'Jun 29', 'Jun 30', 'Jul 1', 'Jul 2', 'Jul 3', 'Jul 4']

  return {
    now: {
      temperatureC: 23,
      precipitationMm: 0,
      windMs: 4,
      windDir: '→',
      cloudCoverPct: 0,
      humidityPct: 78,
      dewPointC: 19,
    },
    hourly: {
      temp: series(23, 4),
      wind: series(4, 2),
      cloud: series(20, 18),
      humidity: series(70, 12),
      dew: series(18, 3),
    },
    forecast: labels.map((label, i) => ({
      label,
      date: dates[i],
      icon: icons[i],
      tempMin: [18, 13, 11, 11, 12, 10, 11][i],
      tempMax: [31, 26, 27, 25, 28, 24, 27][i],
      precipMm: 0,
      windMs: [7, 5, 5, 5, 8, 6, 7][i],
      windDir: dirs[i % dirs.length],
      cloudPct: [27, 40, 12, 37, 17, 3, 3][i],
      humidityPct: [68, 62, 48, 61, 64, 55, 48][i],
      dewPointC: [16, 12, 8, 11, 12, 7, 7][i],
    })),
  }
}

const mockFields = buildMockFields()

export const mockDataLayer: DataLayer = {
  source: 'mock',
  async listFields() {
    return mockFields
  },
  async getFieldDetail(id) {
    const field = mockFields.find((f) => f.id === id) ?? mockFields[0]

    return {
      field,
      ...buildSeries(field.id),
      weather: buildWeather(field.id),
      satellite: { ndviDate: 'Jun 20, 2026', imageDate: 'Jun 23, 2026' },
      images: { satelliteUrl: arcgisSatelliteUrl(field.boundary), ndviUrl: null },
    }
  },
}

export const totalAreaHa = Number(mockFields.reduce((sum, f) => sum + f.areaHa, 0).toFixed(2))

// Live implementation (Branch 3): backed by the Express endpoints, which serve real
// Open-Meteo weather/season + Sentinel Hub NDVI (with their own mock fallback server-side).
export const liveDataLayer: DataLayer = {
  source: 'live',
  async listFields() {
    const response = await authFetch('/api/fields')

    if (!response.ok) {
      throw new Error(`GET /api/fields ${response.status}`)
    }

    const json = (await response.json()) as { fields: Field[] }
    return json.fields
  },
  async getFieldDetail(id) {
    const response = await authFetch(`/api/fields/${id}`)

    if (!response.ok) {
      throw new Error(`GET /api/fields/${id} ${response.status}`)
    }

    return (await response.json()) as FieldDetail
  },
}

// Active data layer: try live, fall back to mock per call so the UI never breaks offline.
export const dataLayer: DataLayer = {
  source: 'live',
  async listFields() {
    try {
      return await liveDataLayer.listFields()
    } catch {
      return mockDataLayer.listFields()
    }
  },
  async getFieldDetail(id) {
    try {
      return await liveDataLayer.getFieldDetail(id)
    } catch {
      return mockDataLayer.getFieldDetail(id)
    }
  },
}
