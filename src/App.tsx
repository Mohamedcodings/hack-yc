import { useEffect, useState } from 'react'
import { UserButton } from '@clerk/clerk-react'
import { Button, Card, FormGroup, HTMLSelect, NumericInput, Switch } from '@blueprintjs/core'
import {
  Camera,
  ChevronRight,
  Grid2X2,
  Layers3,
  Radar,
  Send,
  Sparkles,
  Sprout,
  ThermometerSun,
  Waves,
} from 'lucide-react'
import { MapContainer, Polygon, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import '@blueprintjs/core/lib/css/blueprint.css'
import '@blueprintjs/icons/lib/css/blueprint-icons.css'
import 'leaflet/dist/leaflet.css'
import './App.css'

const farmCenter: [number, number] = [50.2511, 2.7461]

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
type MenuPage = 'config' | 'agent' | 'doctor'
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

const analysisPoints: [number, number][] = [
  [50.2524, 2.7468],
  [50.2507, 2.7456],
  [50.25015, 2.7488],
  [50.2517, 2.74955],
]

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

function makePointSquare([lat, lng]: [number, number], size: number): [number, number][] {
  return [
    [lat - size, lng - size],
    [lat - size, lng + size],
    [lat + size, lng + size],
    [lat + size, lng - size],
  ]
}

function getCellStyle(cell: RasterCell, activeView: ViewMode) {
  if (activeView === 'moisture') {
    const moisture = (cell.ndmi + 0.22) / 0.54
    return {
      color: moisture > 0.66 ? '#1c8ec9' : moisture > 0.45 ? '#5ab1cf' : '#d7a33a',
      opacity: 0.54,
    }
  }

  if (activeView === 'thermal') {
    return {
      color: cell.thermal > 1 ? '#d9562f' : cell.thermal > 0.2 ? '#e0bd35' : '#149a5a',
      opacity: 0.56,
    }
  }

  if (activeView === 'prescription') {
    const rate = Number.parseInt(cell.rate, 10)
    return {
      color: rate >= 76 ? '#8b4bb2' : rate >= 70 ? '#c979be' : '#ead8f0',
      opacity: 0.58,
    }
  }

  return {
    color: cell.color,
    opacity: activeView === 'crop' ? 0.18 : 0.52,
  }
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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

function apiPath(path: string) {
  return `${apiBaseUrl}${path}`
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

  const response = await fetch(apiPath('/api/agent'), {
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
  const response = await fetch(apiPath('/api/crop-doctor'), {
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

function App({ authMode = 'demo' }: { authMode?: 'clerk' | 'demo' }) {
  const clerkEnabled = authMode === 'clerk'
  const [demoStage, setDemoStage] = useState<DemoStage>(clerkEnabled ? 'loading' : 'login')
  const [loadingStep, setLoadingStep] = useState(0)
  const [activeView, setActiveView] = useState<ViewMode>('productivity')
  const [activeMenuPage, setActiveMenuPage] = useState<MenuPage>('config')
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

    fetch(apiPath('/api/sources'), { signal: controller.signal })
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
  const selectCell = (cell: RasterCell, coordinate?: [number, number]) => {
    setSelectedCell(cell)
    copyCoordinate(coordinate ?? getCellCenter(cell), cell)
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
              <Sprout size={26} />
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
          <button className="brand-button" type="button" aria-label="Demeter">
            <Sprout size={23} />
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
        </nav>

        <section className="config-panel">
          <header className="config-header">
            <span>Demeter</span>
            <div className="header-actions">
              {clerkEnabled && <UserButton />}
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
        zoom={17}
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
        {activeView !== 'crop' && rasterCells.map((cell) => {
          const style = getCellStyle(cell, activeView)
          const isSelected = selectedCell?.id === cell.id

          return (
          <Polygon
            key={cell.id}
            eventHandlers={{
              click: (event) => {
                selectCell(cell, [event.latlng.lat, event.latlng.lng])
              },
            }}
            pathOptions={{
              className: isSelected ? 'farm-cell selected' : 'farm-cell',
              color: isSelected ? '#f8fff3' : 'rgba(255,255,255,0.08)',
              fillColor: style.color,
              fillOpacity: isSelected ? Math.min(style.opacity + 0.18, 0.78) : style.opacity,
              opacity: isSelected ? 0.98 : 0.16,
              weight: isSelected ? 2.2 : 0.32,
            }}
            positions={cell.positions}
          >
            <Tooltip sticky opacity={0.96} className="cube-tooltip">
              <strong>{isSelected ? 'Selected cell' : cell.label}</strong>
              <span>{viewMeta[activeView].metric} {getCellPrimaryValue(cell, activeView)}</span>
              <span>NDVI {cell.ndvi.toFixed(2)}</span>
              <span>NDMI {cell.ndmi > 0 ? '+' : ''}{cell.ndmi.toFixed(2)}</span>
              <span>Thermal {cell.thermal > 0 ? '+' : ''}{cell.thermal.toFixed(1)}°C</span>
              <b>{cell.rate}</b>
            </Tooltip>
          </Polygon>
          )
        })}
        <Polygon
          interactive={false}
          pathOptions={{
            color: '#111812',
            fillOpacity: 0,
            opacity: 0.95,
            weight: 4,
          }}
          positions={farmFrontier}
        />
        {showSamplingPoints && analysisPoints.map((point, index) => (
          <Polygon
            key={`${point[0]}-${point[1]}`}
            interactive={false}
            pathOptions={{
              color: '#f7fff4',
              fillColor: '#121d13',
              fillOpacity: 0.92,
              opacity: 0.95,
              weight: 2,
            }}
            positions={makePointSquare(point, index === 0 ? 0.00008 : 0.00006)}
          />
        ))}
        {activeView === 'crop' && cropStrips.map((strip) => (
          <Polygon
            key={strip.name}
            interactive
            pathOptions={{
              color: strip.color,
              fillColor: strip.color,
              fillOpacity: 0.28,
              opacity: 0.96,
              weight: 3.2,
            }}
            positions={strip.positions}
          >
            <Tooltip sticky opacity={0.96} className="cube-tooltip">
              <strong>{strip.crop}</strong>
              <span>{strip.name}</span>
              <span>{strip.area}</span>
              <b>Crop zone</b>
            </Tooltip>
          </Polygon>
        ))}
        <MapCoordinatePicker onPick={(coordinate) => copyCoordinate(coordinate)} />
        <MapReady />
      </MapContainer>
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

export default App
