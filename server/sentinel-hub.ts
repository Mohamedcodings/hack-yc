import { config } from './config.js'

// Sentinel Hub on the Copernicus Data Space Ecosystem (CDSE) — the FREE path.
// Get OAuth client credentials at https://shapps.dataspace.copernicus.eu/dashboard/
// (User settings -> OAuth clients). Returns null whenever creds are missing or a
// call fails, so callers fall back to high-fidelity mock and the demo never breaks.

// Works with either deployment — Copernicus Data Space (free) or commercial Sentinel Hub.
// We try each token endpoint and remember whichever authenticates the given credentials.
const ENDPOINTS = [
  {
    name: 'cdse',
    tokenUrl: 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',
    base: 'https://sh.dataspace.copernicus.eu',
  },
  {
    name: 'shub',
    tokenUrl: 'https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token',
    base: 'https://services.sentinel-hub.com',
  },
]

export const sentinelHubConfigured = Boolean(config.shClientId && config.shClientSecret)

let tokenCache: { token: string; expiresAt: number; base: string } | null = null

async function requestToken(tokenUrl: string): Promise<{ access_token: string; expires_in: number } | null> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.shClientId as string,
    client_secret: config.shClientSecret as string,
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    return null
  }

  return (await response.json()) as { access_token: string; expires_in: number }
}

async function getToken(): Promise<{ token: string; base: string } | null> {
  if (!sentinelHubConfigured) {
    return null
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return { token: tokenCache.token, base: tokenCache.base }
  }

  // Prefer a previously-working endpoint, else probe both.
  const ordered = tokenCache ? ENDPOINTS.slice().sort((a) => (a.base === tokenCache?.base ? -1 : 1)) : ENDPOINTS

  for (const endpoint of ordered) {
    const json = await requestToken(endpoint.tokenUrl).catch(() => null)
    if (json?.access_token) {
      tokenCache = {
        token: json.access_token,
        expiresAt: Date.now() + json.expires_in * 1000,
        base: endpoint.base,
      }
      return { token: json.access_token, base: endpoint.base }
    }
  }

  return null
}

const STATS_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "B11", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "ndmi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 },
    ],
  }
}
function evaluatePixel(s) {
  const ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6)
  const ndmi = (s.B08 - s.B11) / (s.B08 + s.B11 + 1e-6)
  return { ndvi: [ndvi], ndmi: [ndmi], dataMask: [s.dataMask] }
}`

// NDVI colour ramp (red -> yellow -> green) matching the in-app legend.
const NDVI_IMAGE_EVALSCRIPT = `//VERSION=3
function setup() {
  return { input: ["B04", "B08", "dataMask"], output: { bands: 4 } }
}
const ramp = [
  [0.0, [0.78, 0.36, 0.17]],
  [0.3, [0.83, 0.71, 0.21]],
  [0.5, [0.58, 0.70, 0.23]],
  [0.7, [0.17, 0.61, 0.27]],
  [0.9, [0.03, 0.53, 0.30]],
]
function lerp(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t] }
function color(v) {
  if (v <= ramp[0][0]) return ramp[0][1]
  for (let i = 1; i < ramp.length; i++) {
    if (v <= ramp[i][0]) {
      const t = (v - ramp[i-1][0]) / (ramp[i][0] - ramp[i-1][0])
      return lerp(ramp[i-1][1], ramp[i][1], t)
    }
  }
  return ramp[ramp.length-1][1]
}
function evaluatePixel(s) {
  const ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6)
  const c = color(ndvi)
  return [c[0], c[1], c[2], s.dataMask]
}`

export interface SeriesPoint {
  date: string
  value: number
}

export interface NdviResult {
  ndviSeries: SeriesPoint[]
  ndmiSeries: SeriesPoint[]
  latestNdvi: number | null
  provider: 'sentinel-hub'
}

type StatsResponse = {
  data?: Array<{
    interval?: { from?: string }
    outputs?: Record<string, { bands?: Record<string, { stats?: { mean?: number } }> }>
  }>
}

type Bbox = [number, number, number, number]

function dataInput(from: string, to: string) {
  return {
    type: 'sentinel-2-l2a',
    dataFilter: { timeRange: { from, to }, mosaickingOrder: 'leastCC', maxCloudCoverage: 40 },
  }
}

export async function fetchNdviTimeSeries(
  bbox: Bbox,
  from = '2026-01-01T00:00:00Z',
  to = '2026-06-28T23:59:59Z',
): Promise<NdviResult | null> {
  const auth = await getToken().catch(() => null)
  if (!auth) {
    return null
  }

  const requestBody = {
    input: {
      bounds: { bbox, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
      data: [dataInput(from, to)],
    },
    aggregation: {
      timeRange: { from, to },
      aggregationInterval: { of: 'P10D' },
      resx: 0.0002,
      resy: 0.0002,
      evalscript: STATS_EVALSCRIPT,
    },
  }

  const response = await fetch(`${auth.base}/api/v1/statistics`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    throw new Error(`SH stats ${response.status}`)
  }

  const json = (await response.json()) as StatsResponse
  const ndviSeries: SeriesPoint[] = []
  const ndmiSeries: SeriesPoint[] = []

  for (const entry of json.data ?? []) {
    const date = entry.interval?.from?.slice(0, 10)
    const ndvi = entry.outputs?.ndvi?.bands?.B0?.stats?.mean
    const ndmi = entry.outputs?.ndmi?.bands?.B0?.stats?.mean
    if (date && typeof ndvi === 'number' && Number.isFinite(ndvi)) {
      ndviSeries.push({ date, value: Number(ndvi.toFixed(2)) })
    }
    if (date && typeof ndmi === 'number' && Number.isFinite(ndmi)) {
      ndmiSeries.push({ date, value: Number(ndmi.toFixed(2)) })
    }
  }

  if (!ndviSeries.length) {
    return null
  }

  return {
    ndviSeries,
    ndmiSeries,
    latestNdvi: ndviSeries[ndviSeries.length - 1]?.value ?? null,
    provider: 'sentinel-hub',
  }
}

// Real coloured NDVI raster for a field, returned as a PNG data URL (or null).
export async function fetchNdviImage(
  bbox: Bbox,
  from = '2026-04-01T00:00:00Z',
  to = '2026-06-28T23:59:59Z',
): Promise<string | null> {
  const auth = await getToken().catch(() => null)
  if (!auth) {
    return null
  }

  const requestBody = {
    input: {
      bounds: { bbox, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
      data: [dataInput(from, to)],
    },
    output: { width: 512, height: 512, responses: [{ identifier: 'default', format: { type: 'image/png' } }] },
    evalscript: NDVI_IMAGE_EVALSCRIPT,
  }

  const response = await fetch(`${auth.base}/api/v1/process`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json', Accept: 'image/png' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(25_000),
  })

  if (!response.ok) {
    throw new Error(`SH process ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  return `data:image/png;base64,${buffer.toString('base64')}`
}
