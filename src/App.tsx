import { useEffect, useMemo, useState } from 'react'
import { UserButton } from '@clerk/clerk-react'
import { Button, Card, FormGroup, HTMLSelect, NumericInput, Switch } from '@blueprintjs/core'
import {
  BookOpen,
  Camera,
  ChevronRight,
  CircleUserRound,
  Grid2X2,
  Headphones,
  Layers3,
  Leaf,
  Radar,
  Send,
  Smartphone,
  Sparkles,
  Sprout,
  ThermometerSun,
  Waves,
} from 'lucide-react'
import { MapContainer, Polygon, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { authFetch } from './lib/apiClient'
import { dataLayer, type Field, type FieldDetail } from './lib/dataLayer'
import {
  FieldDetailPanel,
  FieldListPanel,
  MapLayerMenu,
  SelectionActionBar,
  WeatherModal,
  type MapLayerId,
} from './components/dashboard'
import { WheatLogo } from './components/WheatLogo'
import { DemoNotifications } from './components/Notifications'
import { Filter, Search as SearchIcon } from 'lucide-react'
import '@blueprintjs/core/lib/css/blueprint.css'
import '@blueprintjs/icons/lib/css/blueprint-icons.css'
import 'leaflet/dist/leaflet.css'
import './design-system.css'
import './App.css'
import './dashboard.css'

const farmCenter: [number, number] = [50.2444, 2.7405]

// NDVI vigor ramp (red -> yellow -> green) and per-layer fill for the field choropleth.
function ndviColor(ndvi: number) {
  if (ndvi >= 0.72) return '#0a8849'
  if (ndvi >= 0.62) return '#2c9c45'
  if (ndvi >= 0.5) return '#93b33a'
  if (ndvi >= 0.4) return '#d4b536'
  return '#c75b2c'
}

const cropColors: Record<string, string> = {
  Potato: '#58a6ff',
  'Wheat soft, winter': '#e0c33b',
  Rapeseed: '#f2c84b',
  'Sugar beet': '#db6fbd',
  Maize: '#ff8f4f',
  Barley: '#b9d04b',
}

// Layers that render a detailed per-cell raster inside each field (vs a flat fill).
const RASTER_LAYERS = new Set(['productivity', 'vegetation', 'moisture', 'yield'])

function layerCellColor(ndvi: number, layer: string) {
  if (layer === 'moisture') {
    const m = (ndvi - 0.3) / 0.5
    return m > 0.6 ? '#1c8ec9' : m > 0.4 ? '#5ab1cf' : '#d7a33a'
  }
  if (layer === 'yield') {
    return ndvi > 0.6 ? '#8b4bb2' : ndvi > 0.45 ? '#c979be' : '#ead8f0'
  }
  return ndviColor(ndvi)
}

function fieldFill(field: Field, layer: string): { fill: string; opacity: number } | null {
  if (layer === 'crop') {
    return field.crop ? { fill: cropColors[field.crop] ?? '#9a9a9a', opacity: 0.5 } : null
  }
  // raster layers paint cells (handled separately); satellite/planting/harvest -> outline only.
  return null
}

function pointInRing([lat, lng]: [number, number], ring: [number, number][]) {
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i]
    const [latJ, lngJ] = ring[j]
    const intersects = lngI > lng !== lngJ > lng && lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

type FieldCell = { id: string; positions: [number, number][]; ndvi: number; ndmi: number; color: string }

// Detailed NDVI raster inside a field — fine cells + smooth multi-frequency noise so
// neighbouring cells transition gradually (like the original), not as garish blocks.
function buildFieldRaster(field: Field, layer: string): FieldCell[] {
  const lats = field.boundary.map((p) => p[0])
  const lngs = field.boundary.map((p) => p[1])
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const spanLat = maxLat - minLat
  const spanLng = maxLng - minLng

  // Fixed-ish cell size -> big fields get more cells (fine, consistent detail).
  const target = 0.0002
  const rows = Math.min(44, Math.max(16, Math.round(spanLat / target)))
  const cols = Math.min(44, Math.max(16, Math.round(spanLng / target)))
  const stepLat = spanLat / rows
  const stepLng = spanLng / cols

  // Deterministic per-field phase offsets so each field reads differently.
  let seed = field.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  const p1 = rand() * 6.28
  const p2 = rand() * 6.28
  const p3 = rand() * 6.28

  const cells: FieldCell[] = []

  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const lat = minLat + i * stepLat
      const lng = minLng + j * stepLng
      const center: [number, number] = [lat + stepLat / 2, lng + stepLng / 2]

      if (!pointInRing(center, field.boundary)) {
        continue
      }

      const nx = j / cols
      const ny = i / rows
      // Smooth, low-frequency field — adjacent cells stay close in value.
      const smooth =
        0.17 * Math.sin(nx * 6.5 + p1) +
        0.13 * Math.cos(ny * 5.5 + p2) +
        0.09 * Math.sin((nx + ny) * 9.5 + p3) +
        0.06 * Math.cos((nx - ny) * 13 + p1)
      // tiny deterministic grain
      const grain = (Math.sin((i * 928.1 + j * 13.7)) * 0.5 + 0.5 - 0.5) * 0.03
      const ndvi = Math.max(0.2, Math.min(0.9, field.ndvi + smooth + grain))

      cells.push({
        id: `${field.id}-${i}-${j}`,
        positions: [
          [lat, lng],
          [lat, lng + stepLng],
          [lat + stepLat, lng + stepLng],
          [lat + stepLat, lng],
        ],
        ndvi: Number(ndvi.toFixed(2)),
        ndmi: Number(((ndvi - 0.55) * 0.6).toFixed(2)),
        color: layerCellColor(ndvi, layer),
      })
    }
  }

  return cells
}

const farmFrontier: [number, number][] = [
  [50.253112, 2.746722],
  [50.251575, 2.743127],
  [50.251129, 2.741239],
  [50.247809, 2.745659],
  [50.250025, 2.749275],
  [50.25174, 2.750916],
]

const farmBounds = {
  south: Math.min(...farmFrontier.map(([lat]) => lat)),
  north: Math.max(...farmFrontier.map(([lat]) => lat)),
  west: Math.min(...farmFrontier.map(([, lng]) => lng)),
  east: Math.max(...farmFrontier.map(([, lng]) => lng)),
}

type RasterCell = {
  id: string
  color: string
  label: string
  ndmi: number
  ndvi: number
  opacity: number
  positions: [number, number][]
  rate: string
  thermal: number
}

type ViewMode = 'crop' | 'productivity' | 'moisture' | 'thermal' | 'prescription'
type MenuPage = 'fields' | 'config' | 'agent' | 'doctor'
type DemoStage = 'login' | 'loading' | 'ready'
type CropDoctorStatus = 'idle' | 'analyzing' | 'done' | 'error'

type CropStrip = {
  area: string
  color: string
  crop: string
  name: string
  positions: [number, number][]
}

type ZoneAnalysis = {
  message: string
  recommendation: string
  risk: 'Low' | 'Medium' | 'High'
  title: string
}

type PlaygroundMessage = {
  id: string
  pending?: boolean
  role: 'agent' | 'farmer'
  text: string
}

type DataSource = {
  apiUrl?: string
  cadence: string
  evidence?: string
  id: string
  lastSync: string
  layers: string[]
  name: string
  status: 'connected' | 'degraded' | 'offline'
}

const cropStrips: CropStrip[] = [
  {
    name: 'Strip A',
    crop: 'Blé tendre',
    area: '6.8 ha',
    color: '#58a6ff',
    positions: [
      [50.253112, 2.746722],
      [50.25186, 2.74382],
      [50.24864, 2.74677],
      [50.250025, 2.749275],
      [50.25174, 2.750916],
    ],
  },
  {
    name: 'Strip B',
    crop: 'Colza',
    area: '5.4 ha',
    color: '#f2c84b',
    positions: [
      [50.25186, 2.74382],
      [50.251575, 2.743127],
      [50.251129, 2.741239],
      [50.247809, 2.745659],
      [50.24864, 2.74677],
    ],
  },
  {
    name: 'Strip C',
    crop: 'Betterave',
    area: '4.2 ha',
    color: '#db6fbd',
    positions: [
      [50.25186, 2.74382],
      [50.253112, 2.746722],
      [50.25174, 2.750916],
      [50.25062, 2.74984],
      [50.24955, 2.74792],
    ],
  },
  {
    name: 'Strip D',
    crop: 'Pomme de terre',
    area: '3.9 ha',
    color: '#ff8f4f',
    positions: [
      [50.24955, 2.74792],
      [50.25062, 2.74984],
      [50.250025, 2.749275],
      [50.24864, 2.74677],
    ],
  },
]

const latStep = 0.000105
const lngStep = 0.000145

const rasterCells: RasterCell[] = []

for (let lat = farmBounds.south; lat < farmBounds.north; lat += latStep) {
  for (let lng = farmBounds.west; lng < farmBounds.east; lng += lngStep) {
    const center: [number, number] = [lat + latStep / 2, lng + lngStep / 2]

    if (!isInsideFarm(center)) {
      continue
    }

    const nx = (center[1] - farmBounds.west) / (farmBounds.east - farmBounds.west)
    const ny = (center[0] - farmBounds.south) / (farmBounds.north - farmBounds.south)

    const value =
      0.58 +
      0.18 * Math.sin(nx * 9.8 + ny * 4.2) +
      0.12 * Math.cos(nx * 16.5 - ny * 6.4) +
      0.08 * Math.sin((nx + ny) * 23.0) -
      0.3 * Math.exp(-((nx - 0.36) ** 2 + (ny - 0.46) ** 2) / 0.045) -
      0.24 * Math.exp(-((nx - 0.7) ** 2 + (ny - 0.67) ** 2) / 0.028) +
      0.16 * Math.exp(-((nx - 0.86) ** 2 + (ny - 0.3) ** 2) / 0.035)

    const ndvi = Math.max(0.24, Math.min(0.88, value))
    const ndmi = Math.max(-0.22, Math.min(0.32, (value - 0.55) * 0.62))
    const thermal = Number((2.8 - value * 3.1).toFixed(1))
    const label = value > 0.62 ? 'Healthy vegetation' : value > 0.41 ? 'Moisture watch' : 'High stress'

    rasterCells.push({
      id: `${lat.toFixed(6)}-${lng.toFixed(6)}`,
      color:
        value > 0.72
          ? '#07874e'
          : value > 0.62
            ? '#2c9c45'
            : value > 0.52
              ? '#93b33a'
              : value > 0.41
                ? '#d4b536'
                : '#c75b2c',
      label,
      ndmi,
      ndvi,
      opacity: 0.66,
      positions: [
        [lat, lng],
        [lat, lng + lngStep],
        [lat + latStep, lng + lngStep],
        [lat + latStep, lng],
      ],
      rate: value > 0.62 ? '64k seeds/ha' : value > 0.41 ? '70k seeds/ha' : '76k seeds/ha',
      thermal,
    })
  }
}

const viewModes: {
  description: string
  icon: typeof Sprout
  id: ViewMode
  label: string
}[] = [
  {
    id: 'productivity',
    icon: Radar,
    label: 'Productivity map',
    description: 'NDVI signal from satellite vegetation index',
  },
  {
    id: 'moisture',
    icon: Waves,
    label: 'Moisture map',
    description: 'NDMI-based water retention and dry pockets',
  },
  {
    id: 'thermal',
    icon: ThermometerSun,
    label: 'Thermal stress',
    description: 'Canopy heat anomaly and stress pressure',
  },
  {
    id: 'prescription',
    icon: Sprout,
    label: 'Prescription rate',
    description: 'Recommended variable-rate seeding zones',
  },
  {
    id: 'crop',
    icon: Layers3,
    label: 'Crop layout',
    description: 'Planned crop strips inside the farm frontier',
  },
]

const viewMeta: Record<ViewMode, { legend: string; metric: string; title: string }> = {
  crop: {
    title: 'Crop layout',
    legend: 'Farm crop plan',
    metric: 'Crop strips',
  },
  productivity: {
    title: 'Productivity map',
    legend: 'NDVI vegetation vigor',
    metric: 'Mean NDVI',
  },
  moisture: {
    title: 'Moisture map',
    legend: 'NDMI soil/canopy water',
    metric: 'Moisture variance',
  },
  thermal: {
    title: 'Thermal stress',
    legend: 'Canopy heat anomaly',
    metric: 'Stress pixels',
  },
  prescription: {
    title: 'Prescription rate',
    legend: 'Variable seeding rate',
    metric: 'Seed rate delta',
  },
}

const loadingSteps = [
  'Loading Sentinel-2 context',
  'Resolving RPG parcel ontology',
  'Loading weather and soil layers',
  'Indexing farm raster zones',
  'Opening workspace',
]

const fallbackDataSources: DataSource[] = [
  {
    cadence: '5 day revisit',
    id: 'sentinel-2',
    lastSync: '2026-06-27 06:42 CET',
    layers: ['NDVI productivity', 'NDMI moisture', 'thermal stress proxy'],
    name: 'Copernicus Sentinel-2 L2A',
    status: 'connected',
  },
  {
    cadence: 'annual parcel registry',
    id: 'rpg-fr',
    lastSync: '2026 campaign import',
    layers: ['farm frontier', 'declared crop geometry'],
    name: 'Registre Parcellaire Graphique',
    status: 'connected',
  },
]

function isInsideFarm(point: [number, number]) {
  const [lat, lng] = point
  let inside = false

  for (let i = 0, j = farmFrontier.length - 1; i < farmFrontier.length; j = i++) {
    const [latI, lngI] = farmFrontier[i]
    const [latJ, lngJ] = farmFrontier[j]
    const intersects =
      lngI > lng !== lngJ > lng &&
      lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

function getCellPrimaryValue(cell: RasterCell, activeView: ViewMode) {
  if (activeView === 'moisture') {
    return `${cell.ndmi > 0 ? '+' : ''}${cell.ndmi.toFixed(2)} NDMI`
  }

  if (activeView === 'thermal') {
    return `${cell.thermal > 0 ? '+' : ''}${cell.thermal.toFixed(1)}°C`
  }

  if (activeView === 'prescription') {
    return cell.rate
  }

  return `${cell.ndvi.toFixed(2)} NDVI`
}

function getCellCenter(cell: RasterCell): [number, number] {
  const lat = cell.positions.reduce((sum, point) => sum + point[0], 0) / cell.positions.length
  const lng = cell.positions.reduce((sum, point) => sum + point[1], 0) / cell.positions.length

  return [lat, lng]
}

function formatCoordinate([lat, lng]: [number, number]) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

function parseCoordinate(message: string): [number, number] | null {
  const match = message.match(/(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)/)

  if (!match) {
    return null
  }

  const lat = Number(match[1])
  const lng = Number(match[2])

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  return [lat, lng]
}

function findNearestCell(coordinate: [number, number]) {
  return rasterCells.reduce(
    (closest, cell) => {
      const center = getCellCenter(cell)
      const distance = (coordinate[0] - center[0]) ** 2 + (coordinate[1] - center[1]) ** 2

      return distance < closest.distance ? { cell, distance } : closest
    },
    { cell: rasterCells[0], distance: Number.POSITIVE_INFINITY },
  ).cell
}

function fallbackCopyText(text: string) {
  const textarea = document.createElement('textarea')

  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text))
    return
  }

  fallbackCopyText(text)
}

function getZoneAnalysis(cell: RasterCell, activeView: ViewMode): ZoneAnalysis {
  if (cell.ndvi < 0.42 || cell.thermal > 1.1) {
    return {
      title: 'I found a stressed pocket.',
      message:
        'This part of the field is weaker than the rest and warmer than expected. I would treat it as a possible water stress or compaction area, not as a generic crop problem.',
      recommendation:
        activeView === 'prescription'
          ? 'Keep the higher seed rate only inside this pocket, then inspect before adding nitrogen.'
          : 'Walk this zone first and compare soil moisture with the green band next to it.',
      risk: 'High',
    }
  }

  if (cell.ndmi < -0.02 || cell.ndvi < 0.58) {
    return {
      title: 'This zone needs watching.',
      message:
        'The crop is not failing, but the moisture signal is below the field baseline. I would not overreact yet; this looks like lighter soil or drainage variation.',
      recommendation:
        'Keep the current plan, watch this area after the next image, and add one sampling point if the yellow area expands.',
      risk: 'Medium',
    }
  }

  return {
    title: 'This area looks healthy.',
    message:
      'The vegetation and moisture signals are aligned here. I would use this zone as your benchmark for the rest of the field.',
    recommendation:
      activeView === 'prescription'
        ? 'You can hold or slightly reduce the rate here and move budget toward weaker cells.'
        : 'No immediate action needed. Keep this as a comparison zone when scouting.',
    risk: 'Low',
  }
}

function buildFarmContext(selectedCell: RasterCell | null, activeView: ViewMode, copiedCoordinate: string | null) {
  const selectedAnalysis = selectedCell ? getZoneAnalysis(selectedCell, activeView) : null
  const selectedCenter = selectedCell ? formatCoordinate(getCellCenter(selectedCell)) : null

  return {
    activeView,
    copiedCoordinate,
    farm: {
      location: 'North France, near Arras',
      area: '26.3 ha',
      frontier: farmFrontier.map(formatCoordinate),
    },
    cropPlan: cropStrips.map((strip) => ({
      area: strip.area,
      crop: strip.crop,
      name: strip.name,
    })),
    selectedZone: selectedCell
      ? {
          coordinate: selectedCenter,
          label: selectedCell.label,
          ndvi: Number(selectedCell.ndvi.toFixed(2)),
          ndmi: Number(selectedCell.ndmi.toFixed(2)),
          thermalAnomalyC: selectedCell.thermal,
          primaryValue: getCellPrimaryValue(selectedCell, activeView),
          prescriptionRate: selectedCell.rate,
          risk: selectedAnalysis?.risk,
          localModelRead: selectedAnalysis?.message,
        }
      : null,
  }
}

function extractBackendAnswer(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'answer' in payload &&
    typeof (payload as { answer?: unknown }).answer === 'string'
  ) {
    return (payload as { answer: string }).answer
  }

  return null
}

async function askOpenAIAgent({
  activeView,
  copiedCoordinate,
  messages,
  question,
  selectedCell,
}: {
  activeView: ViewMode
  copiedCoordinate: string | null
  messages: PlaygroundMessage[]
  question: string
  selectedCell: RasterCell | null
}) {
  const recentMessages = messages.slice(-8).map((message) => ({
    role: message.role === 'farmer' ? 'farmer' : 'agent',
    text: message.text,
  }))

  const response = await authFetch('/api/agent', {
    body: JSON.stringify({
      farmContext: buildFarmContext(selectedCell, activeView, copiedCoordinate),
      question,
      recentMessages,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Backend request failed (${response.status}): ${detail.slice(0, 180)}`)
  }

  const payload: unknown = await response.json()
  const text = extractBackendAnswer(payload)

  if (!text) {
    throw new Error('Backend returned no answer')
  }

  return text
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Could not read image'))
    })
    reader.addEventListener('error', () => reject(new Error('Could not read image')))
    reader.readAsDataURL(file)
  })
}

async function askCropDoctor(imageUrl: string, fileName: string, activeView: ViewMode, selectedCell: RasterCell | null) {
  const response = await authFetch('/api/crop-doctor', {
    body: JSON.stringify({
      activeMapView: activeView,
      fileName,
      imageUrl,
      selectedZone: selectedCell
        ? {
            coordinate: formatCoordinate(getCellCenter(selectedCell)),
            ndvi: Number(selectedCell.ndvi.toFixed(2)),
            ndmi: Number(selectedCell.ndmi.toFixed(2)),
            thermalAnomalyC: selectedCell.thermal,
            mapLabel: selectedCell.label,
          }
        : null,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Backend request failed (${response.status}): ${detail.slice(0, 180)}`)
  }

  const payload: unknown = await response.json()
  const text = extractBackendAnswer(payload)

  if (!text) {
    throw new Error('Backend returned no answer')
  }

  return text
}

function App({
  authMode = 'demo',
  onSignOut,
}: {
  authMode?: 'clerk' | 'demo' | 'supabase'
  onSignOut?: () => void
}) {
  const clerkEnabled = authMode === 'clerk'
  const authenticated = authMode === 'clerk' || authMode === 'supabase'
  const [demoStage, setDemoStage] = useState<DemoStage>(authenticated ? 'loading' : 'login')
  const [loadingStep, setLoadingStep] = useState(0)
  const [activeView, setActiveView] = useState<ViewMode>('productivity')
  const [activeMenuPage, setActiveMenuPage] = useState<MenuPage>('fields')
  const [draftQuestion, setDraftQuestion] = useState('')
  const [messages, setMessages] = useState<PlaygroundMessage[]>([
    {
      id: 'welcome',
      role: 'agent',
      text: 'Ask about the field, compare layers, or click a zone on the map.',
    },
  ])
  const [selectedCell, setSelectedCell] = useState<RasterCell | null>(null)
  const [copiedCoordinate, setCopiedCoordinate] = useState<string | null>(null)
  const [cropDoctorImage, setCropDoctorImage] = useState<string | null>(null)
  const [cropDoctorResult, setCropDoctorResult] = useState('')
  const [cropDoctorStatus, setCropDoctorStatus] = useState<CropDoctorStatus>('idle')
  const [dataSources, setDataSources] = useState<DataSource[]>(fallbackDataSources)
  const [showSamplingPoints, setShowSamplingPoints] = useState(true)
  const [menuOpen, setMenuOpen] = useState(true)
  const [zoneCount, setZoneCount] = useState(3)
  const [standardRate, setStandardRate] = useState(70000)
  const selectedAnalysis = selectedCell ? getZoneAnalysis(selectedCell, activeView) : null

  // Field-management surface (Branch 2) — data via the typed dataLayer (mock; live in Branch 3).
  const [fields, setFields] = useState<Field[]>([])
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [fieldDetail, setFieldDetail] = useState<FieldDetail | null>(null)
  const [checkedFieldIds, setCheckedFieldIds] = useState<Set<string>>(new Set())
  const [showWeatherModal, setShowWeatherModal] = useState(false)
  const [mapLayer, setMapLayer] = useState<MapLayerId>('productivity')
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [mapQuery, setMapQuery] = useState('')

  const showRaster = overlayVisible && RASTER_LAYERS.has(mapLayer)
  const fieldRasters = useMemo(
    () => (showRaster ? fields.map((field) => ({ field, cells: buildFieldRaster(field, mapLayer) })) : []),
    [fields, mapLayer, showRaster],
  )

  const handleLayerChange = (id: MapLayerId) => {
    setMapLayer(id)

    if (id === 'crop') {
      setActiveView('crop')
      setOverlayVisible(true)
    } else if (id === 'productivity' || id === 'vegetation') {
      setActiveView('productivity')
      setOverlayVisible(true)
    } else if (id === 'moisture') {
      setActiveView('moisture')
      setOverlayVisible(true)
    } else if (id === 'yield') {
      setActiveView('prescription')
      setOverlayVisible(true)
    } else {
      // satellite / planting date / harvest date → imagery only
      setOverlayVisible(false)
    }
  }

  const toggleFieldCheck = (id: string) => {
    setCheckedFieldIds((current) => {
      const next = new Set(current)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  useEffect(() => {
    if (demoStage !== 'loading') {
      return undefined
    }

    setLoadingStep(0)

    const interval = window.setInterval(() => {
      setLoadingStep((current) => {
        if (current >= loadingSteps.length - 1) {
          window.clearInterval(interval)
          window.setTimeout(() => setDemoStage('ready'), 420)
          return current
        }

        return current + 1
      })
    }, 620)

    return () => window.clearInterval(interval)
  }, [demoStage])

  useEffect(() => {
    if (demoStage !== 'ready') {
      return undefined
    }

    const controller = new AbortController()

    authFetch('/api/sources', { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: unknown) => {
        if (
          payload &&
          typeof payload === 'object' &&
          'sources' in payload &&
          Array.isArray((payload as { sources?: unknown }).sources)
        ) {
          setDataSources((payload as { sources: DataSource[] }).sources)
        }
      })
      .catch(() => {
        setDataSources(fallbackDataSources)
      })

    return () => controller.abort()
  }, [demoStage])

  useEffect(() => {
    let active = true

    void dataLayer.listFields().then((list) => {
      if (active) {
        setFields(list)
      }
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedFieldId) {
      setFieldDetail(null)
      return undefined
    }

    let active = true

    void dataLayer.getFieldDetail(selectedFieldId).then((detail) => {
      if (active) {
        setFieldDetail(detail)
      }
    })

    return () => {
      active = false
    }
  }, [selectedFieldId])

  const askAgent = async (question: string) => {
    const trimmed = question.trim()

    if (!trimmed) {
      return
    }

    const coordinate = parseCoordinate(trimmed)
    const contextCell = coordinate ? findNearestCell(coordinate) : selectedCell

    if (coordinate) {
      setSelectedCell(contextCell)
    }

    const farmerMessage: PlaygroundMessage = {
      id: `farmer-${Date.now()}`,
      role: 'farmer',
      text: trimmed,
    }
    const pendingId = `agent-${Date.now()}`
    const pendingMessage: PlaygroundMessage = {
      id: pendingId,
      pending: true,
      role: 'agent',
      text: 'Thinking with the farm context...',
    }
    const nextMessages = [...messages, farmerMessage, pendingMessage]

    setMessages((current) => [
      ...current,
      farmerMessage,
      pendingMessage,
    ])
    setDraftQuestion('')

    try {
      const answer = await askOpenAIAgent({
        activeView,
        copiedCoordinate,
        messages,
        question: trimmed,
        selectedCell: contextCell,
      })

      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? {
                ...message,
                pending: false,
                text: answer,
              }
            : message,
        ),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OpenAI request failed'

      setMessages(
        nextMessages.map((item) =>
          item.id === pendingId
            ? {
                ...item,
                pending: false,
                text: `${message}. Add OPENAI_API_KEY to .env.local, then restart the API server.`,
              }
            : item,
        ),
      )
    }
  }
  const copyCoordinate = (coordinate: [number, number], cell?: RasterCell) => {
    const formatted = formatCoordinate(coordinate)

    setCopiedCoordinate(formatted)

    if (cell) {
      setSelectedCell(cell)
    }

    copyTextToClipboard(formatted)
  }
  const runAgentAction = (action: 'inspect' | 'moisture' | 'prescription' | 'task') => {
    if (action === 'inspect') {
      setActiveView('thermal')
      void askAgent('Inspect weak zones on the thermal layer')
      return
    }

    if (action === 'moisture') {
      setActiveView('moisture')
      void askAgent('Check moisture and tell me where to look')
      return
    }

    if (action === 'prescription') {
      setActiveView('prescription')
      void askAgent('Show prescription recommendation for this farm')
      return
    }

    void askAgent('Create a scouting task')
  }
  const analyzeCropPhoto = async (file: File | undefined) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setCropDoctorStatus('error')
      setCropDoctorResult('Upload a JPG, PNG, or HEIC crop photo.')
      return
    }

    setActiveMenuPage('doctor')
    setCropDoctorStatus('analyzing')
    setCropDoctorResult('')

    try {
      const imageUrl = await readImageAsDataUrl(file)
      setCropDoctorImage(imageUrl)
      const result = await askCropDoctor(imageUrl, file.name, activeView, selectedCell)
      setCropDoctorResult(result)
      setCropDoctorStatus('done')
    } catch (error) {
      setCropDoctorStatus('error')
      setCropDoctorResult(error instanceof Error ? error.message : 'Crop Doctor failed to analyze the image.')
    }
  }
  const pageTitle =
    activeMenuPage === 'agent'
      ? 'Farm agent'
      : activeMenuPage === 'doctor'
        ? 'Crop Doctor'
        : viewMeta[activeView].title
  const pageSubtitle =
    activeMenuPage === 'agent'
      ? 'Field context assistant'
      : activeMenuPage === 'doctor'
        ? 'Image diagnosis'
        : '26.3 ha · North France'

  if (demoStage !== 'ready') {
    return (
      <main className="demo-entry">
        <section className="demo-entry-panel">
          <div className="demo-brand">
            <span>
              <WheatLogo size={26} />
            </span>
            <b>Demeter</b>
          </div>

          {demoStage === 'login' ? (
            <form
              className="demo-login-form"
              onSubmit={(event) => {
                event.preventDefault()
                setDemoStage('loading')
              }}
            >
              <div className="demo-copy">
                <p>Farm workspace</p>
                <h1>Log in to Demeter</h1>
              </div>

              <label className="demo-field">
                <span>Email</span>
                <input type="email" value="jean.martin@ferme-du-nord.fr" readOnly />
              </label>
              <label className="demo-field">
                <span>Password</span>
                <input type="password" value="demeter-demo" readOnly />
              </label>
              <label className="demo-field">
                <span>Workspace</span>
                <select value="north-france" onChange={() => undefined}>
                  <option value="north-france">Ferme du Nord · 26.3 ha</option>
                </select>
              </label>

              <div className="demo-login-row">
                <label>
                  <input type="checkbox" defaultChecked />
                  Remember me
                </label>
                <button type="button">Forgot password?</button>
              </div>

              <button className="demo-login-button" type="submit">
                Log in
              </button>
            </form>
          ) : (
            <div className="demo-loading">
              <div className="demo-loader" aria-hidden="true" />
              <p>Loading...</p>
              <h1>{loadingSteps[loadingStep]}</h1>
              <div className="demo-step-list">
                {loadingSteps.map((step, index) => (
                  <span className={index <= loadingStep ? 'complete' : ''} key={step}>
                    {step}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="map-only">
      <aside className={`side-shell ${menuOpen ? 'open' : 'closed'}`} aria-label="Prescription configuration">
        <nav className="icon-rail" aria-label="Product navigation">
          <div className="icon-rail__group">
            <button className="brand-button" type="button" aria-label="Demeter">
              <WheatLogo size={24} />
            </button>
            <button
              className={activeMenuPage === 'fields' ? 'active' : ''}
              type="button"
              aria-label="Fields"
              onClick={() => setActiveMenuPage('fields')}
            >
              <Layers3 size={20} />
            </button>
            <button
              className={activeMenuPage === 'config' ? 'active' : ''}
              type="button"
              aria-label="Configuration"
              onClick={() => setActiveMenuPage('config')}
            >
              <Grid2X2 size={20} />
            </button>
            <button
              className={activeMenuPage === 'agent' ? 'active' : ''}
              type="button"
              aria-label="Farm agent"
              onClick={() => setActiveMenuPage('agent')}
            >
              <Sparkles size={20} />
            </button>
            <button
              className={activeMenuPage === 'doctor' ? 'active' : ''}
              type="button"
              aria-label="Crop Doctor"
              onClick={() => setActiveMenuPage('doctor')}
            >
              <Camera size={20} />
            </button>
          </div>

          <div className="icon-rail__group icon-rail__group--bottom">
            <button type="button" aria-label="Support" title="Support">
              <Headphones size={20} />
            </button>
            <button type="button" aria-label="Mobile app" title="Mobile app">
              <Leaf size={20} />
            </button>
            <button type="button" aria-label="Knowledge base" title="Knowledge base">
              <BookOpen size={20} />
            </button>
            <button type="button" aria-label="Get the app" title="Get the app">
              <Smartphone size={20} />
            </button>
            <button
              type="button"
              aria-label="Account"
              title={onSignOut ? 'Account · sign out' : 'Account'}
              onClick={() => onSignOut?.()}
            >
              <CircleUserRound size={20} />
            </button>
          </div>
        </nav>

        <section className="config-panel">
          {activeMenuPage === 'fields' ? (
            <FieldListPanel
              fields={fields}
              totalAreaHa={Number(fields.reduce((sum, field) => sum + field.areaHa, 0).toFixed(2))}
              selectedFieldId={selectedFieldId}
              checkedFieldIds={checkedFieldIds}
              onSelectField={(id) => setSelectedFieldId(id)}
              onToggleCheck={toggleFieldCheck}
              onAddFields={() => undefined}
            />
          ) : (
          <>
          <header className="config-header">
            <span>Demeter</span>
            <div className="header-actions">
              {clerkEnabled && <UserButton />}
              {onSignOut && (
                <Button
                  className="hide-menu-button"
                  icon="log-out"
                  minimal
                  small
                  onClick={onSignOut}
                  aria-label="Sign out"
                />
              )}
              <Button
                className="hide-menu-button"
                icon="chevron-left"
                minimal
                small
                onClick={() => setMenuOpen(false)}
                aria-label="Hide menu"
              />
            </div>
          </header>

          <section className="config-title">
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </section>

          {activeMenuPage === 'config' ? (
            <>
              <section className="config-group">
                <h2>Map settings</h2>
                <div className="view-picker">
                  {viewModes.map((view) => (
                    <button
                      className={activeView === view.id ? 'active' : ''}
                      key={view.id}
                      type="button"
                      onClick={() => setActiveView(view.id)}
                    >
                      <view.icon size={17} />
                      <span>
                        <b>{view.label}</b>
                        <em>{view.description}</em>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="config-group source-group">
                <h2>Data sources</h2>
                <div className="source-stack">
                  {dataSources.map((source) => (
                    <article key={source.id}>
                      <span className={`source-status ${source.status}`} />
                      <div>
                        <b>{source.name}</b>
                        <em>{source.layers.slice(0, 2).join(' · ')}</em>
                        {source.evidence && <small>{source.evidence}</small>}
                      </div>
                      <strong>{source.lastSync}</strong>
                    </article>
                  ))}
                </div>
              </section>

              <Card
                className={`config-card crop-layout-group ${activeView === 'crop' ? 'is-active' : ''}`}
                elevation={0}
              >
                <h2>Crop layout</h2>
                {cropStrips.map((strip) => (
                  <CropStripRow key={strip.name} strip={strip} />
                ))}
              </Card>

              <section className="config-group">
                <h2>Planting</h2>
                <FormGroup label="Crop" labelFor="crop-select">
                  <HTMLSelect
                    id="crop-select"
                    fill
                    options={['Wheat soft, winter', 'Rapeseed', 'Sugar beet', 'Potato']}
                  />
                </FormGroup>
                <FormGroup label="Variety" labelFor="variety-select">
                  <HTMLSelect id="variety-select" fill options={['CP30', 'Chevignon', 'KWS Extase', 'LG Absalon']} />
                </FormGroup>
                <div className="bp-input-grid">
                  <FormGroup label="Standard rate" labelFor="rate-input">
                    <NumericInput
                      id="rate-input"
                      fill
                      min={0}
                      stepSize={1000}
                      majorStepSize={5000}
                      value={standardRate}
                      onValueChange={(value) => setStandardRate(value || 0)}
                      rightElement={<span className="input-unit">seeds/ha</span>}
                    />
                  </FormGroup>
                  <FormGroup label="Input zones" labelFor="zones-input">
                    <NumericInput
                      id="zones-input"
                      fill
                      min={2}
                      max={5}
                      value={zoneCount}
                      onValueChange={(value) => setZoneCount(value || 2)}
                      rightElement={<span className="input-unit">zones</span>}
                    />
                  </FormGroup>
                </div>
                <Switch
                  checked={showSamplingPoints}
                  label="Sampling points"
                  onChange={() => setShowSamplingPoints((current) => !current)}
                />
              </section>

              <footer className="config-actions">
                <Button className="primary-action" icon="download" text="Export map" />
              </footer>
            </>
          ) : activeMenuPage === 'agent' ? (
            <section className="farm-playground page">
              <div className="playground-topline">
                <span>
                  {copiedCoordinate
                    ? `Copied ${copiedCoordinate}`
                    : 'Click the map to copy coordinates, then paste them here.'}
                </span>
                {selectedCell && selectedAnalysis && (
                  <button type="button" onClick={() => setSelectedCell(null)}>
                    <span className={`risk-pill ${selectedAnalysis.risk.toLowerCase()}`}>{selectedAnalysis.risk}</span>
                    {getCellPrimaryValue(selectedCell, activeView)}
                  </button>
                )}
              </div>
              <div className="agent-actions">
                <button type="button" onClick={() => runAgentAction('inspect')}>
                  Inspect weak zones
                </button>
                <button type="button" onClick={() => runAgentAction('moisture')}>
                  Check moisture
                </button>
                <button type="button" onClick={() => runAgentAction('prescription')}>
                  Show prescription
                </button>
                <button type="button" onClick={() => runAgentAction('task')}>
                  Create task
                </button>
              </div>
              <div className="playground-thread">
                {messages.map((message) => (
                  <div className={`playground-message ${message.role} ${message.pending ? 'pending' : ''}`} key={message.id}>
                    <span>{message.role === 'agent' ? 'Demeter' : 'You'}</span>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
              <div className="playground-prompts">
                {['What should I inspect today?', 'Why this zone?', 'Create a scouting task'].map((prompt) => (
                  <button key={prompt} type="button" onClick={() => askAgent(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
              <form
                className="playground-composer"
                onSubmit={(event) => {
                  event.preventDefault()
                  askAgent(draftQuestion)
                }}
              >
                <input
                  aria-label="Ask Demeter"
                  placeholder="Ask about this farm..."
                  value={draftQuestion}
                  onChange={(event) => setDraftQuestion(event.target.value)}
                />
                <button type="submit" aria-label="Send question">
                  <Send size={15} />
                </button>
              </form>
            </section>
          ) : (
            <section className="crop-doctor page">
              <label className={`crop-upload ${cropDoctorImage ? 'has-image' : ''}`}>
                {cropDoctorImage ? (
                  <img alt="Uploaded crop" src={cropDoctorImage} />
                ) : (
                  <span>
                    <Camera size={24} />
                    <b>Add crop photo</b>
                    <em>Leaf, fruit, stem, or field symptom</em>
                  </span>
                )}
                <input
                  accept="image/*"
                  type="file"
                  onChange={(event) => {
                    void analyzeCropPhoto(event.target.files?.[0])
                    event.currentTarget.value = ''
                  }}
                />
              </label>

              <div className="crop-doctor-status">
                {cropDoctorStatus === 'idle' && (
                  <>
                    <strong>Drop in a photo, get a field action.</strong>
                    <p>Disease, pest pressure, nutrient stress, and pesticide guidance are handled from the image.</p>
                  </>
                )}
                {cropDoctorStatus === 'analyzing' && (
                  <>
                    <strong>Analyzing crop photo...</strong>
                    <p>Checking visible symptoms against crop disease and treatment patterns.</p>
                  </>
                )}
                {cropDoctorStatus === 'done' && (
                  <>
                    <strong>AI diagnosis</strong>
                    <p>{cropDoctorResult}</p>
                  </>
                )}
                {cropDoctorStatus === 'error' && (
                  <>
                    <strong>Could not analyze photo</strong>
                    <p>{cropDoctorResult}</p>
                  </>
                )}
              </div>
            </section>
          )}
          </>
          )}
        </section>
      </aside>

      {!menuOpen && (
        <button
          className="show-menu-button"
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Show menu"
        >
          <ChevronRight size={18} />
          Configure
        </button>
      )}
      <aside className="model-legend">
        <strong>{viewMeta[activeView].legend}</strong>
        <span>{activeView === 'crop' ? 'Crop zones' : viewMeta[activeView].metric}</span>
        <div className={`legend-ramp ${activeView}`} />
        <small>{dataSources[0]?.name ?? 'Connected agronomy sources'}</small>
      </aside>
      <MapContainer
        center={farmCenter}
        zoom={14}
        minZoom={3}
        maxZoom={20}
        zoomControl={false}
        attributionControl
        className="real-map"
      >
        <TileLayer
          attribution='Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <TileLayer
          attribution="Labels &copy; OpenStreetMap contributors"
          url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          opacity={0.12}
        />
        {fieldRasters.map(({ field, cells }) =>
          cells.map((cell) => (
            <Polygon
              key={cell.id}
              interactive
              eventHandlers={{
                click: (event) => {
                  setSelectedFieldId(field.id)
                  copyCoordinate([event.latlng.lat, event.latlng.lng])
                },
              }}
              pathOptions={{
                color: cell.color,
                fillColor: cell.color,
                fillOpacity: 0.58,
                opacity: 0.58,
                weight: 1.2,
              }}
              positions={cell.positions}
            >
              <Tooltip sticky opacity={0.96} className="cell-tooltip">
                <strong>{field.name}</strong>
                <span>NDVI {cell.ndvi.toFixed(2)}</span>
                <span>NDMI {cell.ndmi > 0 ? '+' : ''}{cell.ndmi.toFixed(2)}</span>
              </Tooltip>
            </Polygon>
          )),
        )}
        {fields.map((field) => {
          const isSelected = selectedFieldId === field.id
          const isChecked = checkedFieldIds.has(field.id)
          const spec = overlayVisible && !showRaster ? fieldFill(field, mapLayer) : null

          return (
            <Polygon
              key={field.id}
              eventHandlers={{
                click: (event) => {
                  setSelectedFieldId(field.id)
                  copyCoordinate([event.latlng.lat, event.latlng.lng])
                },
              }}
              pathOptions={{
                color: isSelected || isChecked ? '#18a66c' : '#ffffff',
                fillColor: isChecked ? '#18a66c' : spec?.fill ?? '#cfd8d0',
                fillOpacity: isChecked ? 0.4 : spec ? spec.opacity : showRaster ? 0 : 0.06,
                opacity: isSelected ? 1 : 0.9,
                weight: isSelected ? 3 : 1.6,
              }}
              positions={field.boundary}
            >
              <Tooltip direction="center" permanent className="field-label">
                {field.name}
              </Tooltip>
            </Polygon>
          )
        })}
        <FlyToField field={fields.find((item) => item.id === selectedFieldId) ?? null} allFields={fields} />
        <MapCoordinatePicker onPick={(coordinate) => copyCoordinate(coordinate)} />
        <MapReady />
      </MapContainer>

      <div className="map-layer-anchor">
        <MapLayerMenu active={mapLayer} onChange={handleLayerChange} />
      </div>

      <div className="map-toolbar">
        <div className="map-toolbar__search">
          <SearchIcon size={15} />
          <input
            placeholder="Search…"
            value={mapQuery}
            onChange={(event) => setMapQuery(event.target.value)}
            aria-label="Search the map"
          />
        </div>
        <button type="button" className="map-toolbar__filter">
          <Filter size={15} />
          Filter
        </button>
      </div>

      <div className="map-weather-strip">
        <span>☀ +23°</span>
        <span>⇒ 4 m/s →</span>
      </div>

      <div className={`coordinate-readout ${copiedCoordinate ? 'visible' : ''}`} aria-live="polite">
        <span>{copiedCoordinate ? 'Copied coordinates' : 'Click map for coordinates'}</span>
        <strong>{copiedCoordinate ?? '50.244400, 2.740500'}</strong>
      </div>

      {fieldDetail && (
        <FieldDetailPanel
          detail={fieldDetail}
          onClose={() => setSelectedFieldId(null)}
          onOpenWeather={() => setShowWeatherModal(true)}
        />
      )}

      <SelectionActionBar
        fields={fields}
        checkedFieldIds={checkedFieldIds}
        onClear={() => setCheckedFieldIds(new Set())}
      />

      {showWeatherModal && fieldDetail && (
        <WeatherModal
          fieldName={fieldDetail.field.name}
          detail={fieldDetail}
          onClose={() => setShowWeatherModal(false)}
        />
      )}

      <DemoNotifications />
    </main>
  )
}

function CropStripRow({ strip }: { strip: CropStrip }) {
  return (
    <div className="crop-strip-row">
      <i style={{ background: strip.color }} />
      <span>
        <b>{strip.crop}</b>
        <em>
          {strip.name} · {strip.area}
        </em>
      </span>
    </div>
  )
}

function MapCoordinatePicker({ onPick }: { onPick: (coordinate: [number, number]) => void }) {
  useMapEvents({
    click(event) {
      onPick([event.latlng.lat, event.latlng.lng])
    },
  })

  return null
}

function MapReady() {
  const map = useMap()
  map.whenReady(() => {
    map.invalidateSize()
  })

  return null
}

function FlyToField({ field, allFields }: { field: Field | null; allFields: Field[] }) {
  const map = useMap()

  useEffect(() => {
    if (field) {
      map.flyToBounds(field.boundary, { padding: [60, 60], maxZoom: 17, duration: 0.7 })
    }
  }, [field, map])

  useEffect(() => {
    if (!field && allFields.length) {
      map.fitBounds(
        allFields.flatMap((item) => item.boundary),
        { padding: [50, 50] },
      )
    }
    // Only re-fit when the field set changes, not on every selection clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFields.length])

  return null
}

export default App
