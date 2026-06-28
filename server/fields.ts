export type CropName =
  | 'Potato'
  | 'Wheat soft, winter'
  | 'Rapeseed'
  | 'Sugar beet'
  | 'Maize'
  | 'Barley'
  | null

export interface FieldRecord {
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

// Real traced field polygons (lat,lon) near Le Verguier, northern France — provided
// by the product owner. These are accurate, adjacent, non-overlapping parcels.
const REAL_POLYGONS: [number, number][][] = [
  [
    [50.249881, 2.749522],
    [50.246409, 2.753899],
    [50.244241, 2.753019],
    [50.242635, 2.750788],
    [50.247328, 2.745166],
  ],
  [
    [50.247219, 2.744994],
    [50.244968, 2.747891],
    [50.242402, 2.743514],
    [50.245051, 2.740273],
  ],
  [
    [50.244982, 2.740166],
    [50.242375, 2.743428],
    [50.240206, 2.738814],
    [50.243404, 2.736347],
  ],
  [
    [50.243349, 2.736218],
    [50.240193, 2.738707],
    [50.238875, 2.736390],
    [50.242484, 2.733407],
  ],
  [
    [50.247795, 2.739780],
    [50.246080, 2.742076],
    [50.244200, 2.738299],
    [50.245682, 2.736089],
  ],
]

const OUTLINES = ['#e0563b', '#3f7bd6', '#e0c33b', '#f4f4f4', '#9a9a9a', '#7bbf5a', '#b97fd0']
const CROPS: CropName[] = ['Potato', 'Wheat soft, winter', 'Rapeseed', 'Sugar beet', 'Maize', 'Barley', null]

function mulberry32(seed: number) {
  return function next() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function centroidOf(ring: [number, number][]): [number, number] {
  const lat = ring.reduce((s, p) => s + p[0], 0) / ring.length
  const lon = ring.reduce((s, p) => s + p[1], 0) / ring.length
  return [lat, lon]
}

function polygonAreaHa(ring: [number, number][]): number {
  const meanLat = (centroidOf(ring)[0] * Math.PI) / 180
  const mPerDegLat = 111320
  const mPerDegLon = 111320 * Math.cos(meanLat)
  let area = 0

  for (let i = 0; i < ring.length; i += 1) {
    const [lat1, lon1] = ring[i]
    const [lat2, lon2] = ring[(i + 1) % ring.length]
    area += lon1 * mPerDegLon * (lat2 * mPerDegLat) - lon2 * mPerDegLon * (lat1 * mPerDegLat)
  }

  return Math.abs(area) / 2 / 10000
}

let cached: FieldRecord[] | null = null

export function getFields(): FieldRecord[] {
  if (cached) {
    return cached
  }

  const rng = mulberry32(20260628)

  cached = REAL_POLYGONS.map((boundary, i) => {
    const areaHa = Number(polygonAreaHa(boundary).toFixed(2))
    const crop = i % 3 === 0 ? CROPS[i % CROPS.length] : null

    return {
      id: `field-${i + 1}`,
      name: `Field ${i + 1}`,
      areaHa,
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

  return cached
}

export function getField(id: string): FieldRecord | undefined {
  return getFields().find((field) => field.id === id)
}

export function fieldBbox(field: FieldRecord): [number, number, number, number] {
  const lats = field.boundary.map((p) => p[0])
  const lngs = field.boundary.map((p) => p[1])
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}
