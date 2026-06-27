import { useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  Grid2X2,
  Headphones,
  Layers3,
  Leaf,
  MapPinned,
  PenLine,
  Radar,
  Settings2,
  Sprout,
  Tractor,
  UploadCloud,
} from 'lucide-react'
import { MapContainer, Polygon, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
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

type CropStrip = {
  area: string
  color: string
  crop: string
  name: string
  positions: [number, number][]
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

function App() {
  const [coordinate, setCoordinate] = useState<[number, number] | null>(null)
  const [hoveredCell, setHoveredCell] = useState<RasterCell | null>(null)
  const [menuOpen, setMenuOpen] = useState(true)
  const [zoneCount, setZoneCount] = useState(3)
  const [standardRate, setStandardRate] = useState(70000)

  return (
    <main className="map-only">
      <aside className={`side-shell ${menuOpen ? 'open' : 'closed'}`} aria-label="Prescription configuration">
        <nav className="icon-rail" aria-label="Product navigation">
          <button className="brand-button" type="button" aria-label="Demeter">
            <Sprout size={23} />
          </button>
          {[CalendarDays, Grid2X2, Radar, MapPinned, UploadCloud, Layers3, Tractor, Cloud].map(
            (Icon, index) => (
              <button className={index === 1 ? 'active' : ''} type="button" key={index}>
                <Icon size={20} />
              </button>
            ),
          )}
          <button type="button" aria-label="Support">
            <Headphones size={20} />
          </button>
        </nav>

        <section className="config-panel">
          <header className="config-header">
            <button type="button">← Back</button>
            <span>User Guide</span>
            <button
              className="hide-menu-button"
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Hide menu"
            >
              <ChevronLeft size={17} />
            </button>
          </header>

          <section className="config-title">
            <h1>Prescription map</h1>
            <p>OSKI, 26.3 ha</p>
          </section>

          <section className="config-group">
            <h2>Map settings</h2>
            <SettingRow icon={Sprout} label="Planting" />
            <SettingRow icon={Radar} label="Productivity map" />
            <SettingRow icon={Layers3} label="Crop layout" />
            <SettingRow icon={Grid2X2} label={`${zoneCount} zones`} />
          </section>

          <section className="config-group crop-layout-group">
            <h2>Crop layout</h2>
            {cropStrips.map((strip) => (
              <CropStripRow key={strip.name} strip={strip} />
            ))}
          </section>

          <section className="config-group">
            <h2>Planting</h2>
            <div className="select-line">
              <span>Wheat soft, winter</span>
              <ChevronDown size={17} />
            </div>
            <div className="select-line">
              <span>CP30</span>
              <ChevronDown size={17} />
            </div>
            <label className="input-line">
              <span>Standard rate</span>
              <input
                type="number"
                value={standardRate}
                onChange={(event) => setStandardRate(Number(event.target.value))}
              />
              <em>seeds/ha</em>
            </label>
            <label className="input-line">
              <span>Input zones</span>
              <input
                max={5}
                min={2}
                type="number"
                value={zoneCount}
                onChange={(event) => setZoneCount(Number(event.target.value))}
              />
              <em>zones</em>
            </label>
          </section>

          <section className="config-group zones-group">
            <h2>Productivity-based zone</h2>
            <ZoneRow color="#c75b2c" name="Zone 1" area="5.7 ha (22%)" rate={standardRate + 6000} />
            <ZoneRow color="#d4b536" name="Zone 2" area="14.2 ha (54%)" rate={standardRate} />
            <ZoneRow color="#2c9c45" name="Zone 3" area="6.4 ha (24%)" rate={standardRate - 6000} />
          </section>

          <section className="config-group trial-card">
            <h2>Trial</h2>
            <SettingRow icon={Sprout} label="Planting, PLAN1" />
            <SettingRow icon={Leaf} label="Test A/B line, 112°" />
            <SettingRow icon={Settings2} label="2 perpendicular strips, 98m" />
          </section>

          <section className="config-group cell-readout">
            {hoveredCell ? (
              <>
                <h2>{hoveredCell.label}</h2>
                <DataRow label="NDVI" value={hoveredCell.ndvi.toFixed(2)} />
                <DataRow
                  label="NDMI"
                  value={`${hoveredCell.ndmi > 0 ? '+' : ''}${hoveredCell.ndmi.toFixed(2)}`}
                />
                <DataRow
                  label="Thermal"
                  value={`${hoveredCell.thermal > 0 ? '+' : ''}${hoveredCell.thermal.toFixed(1)}°C`}
                />
                <DataRow label="Rate" value={hoveredCell.rate} />
              </>
            ) : (
              <>
                <h2>Cell analytics</h2>
                <p>Hover a cube to inspect satellite-derived values.</p>
              </>
            )}
          </section>

          <footer className="config-actions">
            <button className="ghost-action" type="button">
              <PenLine size={16} />
              Edit
            </button>
            <button className="primary-action" type="button">
              <Download size={16} />
              Export map
            </button>
          </footer>
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

      <div className="coordinate-readout">
        {coordinate
          ? `${coordinate[0].toFixed(6)}, ${coordinate[1].toFixed(6)}`
          : 'Click map to get coordinates'}
      </div>
      <aside className="model-legend">
        <strong>Satellite agronomy model</strong>
        <span>NDVI · NDMI · thermal stress</span>
        <div className="legend-ramp" />
        <dl>
          <div>
            <dt>Mean NDVI</dt>
            <dd>0.61</dd>
          </div>
          <div>
            <dt>Moisture variance</dt>
            <dd>18%</dd>
          </div>
          <div>
            <dt>Stress pixels</dt>
            <dd>14.2 ha</dd>
          </div>
        </dl>
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
        {rasterCells.map((cell) => (
          <Polygon
            key={cell.id}
            eventHandlers={{
              click: () => setHoveredCell(cell),
              mouseout: () => setHoveredCell(null),
              mouseover: () => setHoveredCell(cell),
            }}
            pathOptions={{
              color: 'rgba(255,255,255,0.14)',
              fillColor: cell.color,
              fillOpacity: cell.opacity,
              opacity: 0.2,
              weight: 0.55,
            }}
            positions={cell.positions}
          >
            <Tooltip sticky opacity={0.96} className="cube-tooltip">
              <strong>{cell.label}</strong>
              <span>NDVI {cell.ndvi.toFixed(2)}</span>
              <span>NDMI {cell.ndmi > 0 ? '+' : ''}{cell.ndmi.toFixed(2)}</span>
              <span>Thermal {cell.thermal > 0 ? '+' : ''}{cell.thermal.toFixed(1)}°C</span>
              <b>{cell.rate}</b>
            </Tooltip>
          </Polygon>
        ))}
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
        {analysisPoints.map((point, index) => (
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
        {cropStrips.map((strip) => (
          <Polygon
            key={strip.name}
            interactive={false}
            pathOptions={{
              color: strip.color,
              fillColor: strip.color,
              fillOpacity: 0.08,
              opacity: 0.96,
              weight: 2.5,
            }}
            positions={strip.positions}
          />
        ))}
        <CoordinatePicker onPick={setCoordinate} />
        <MapReady />
      </MapContainer>
    </main>
  )
}

function SettingRow({ icon: Icon, label }: { icon: typeof Sprout; label: string }) {
  return (
    <div className="setting-row">
      <Icon size={16} />
      <span>{label}</span>
    </div>
  )
}

function ZoneRow({
  area,
  color,
  name,
  rate,
}: {
  area: string
  color: string
  name: string
  rate: number
}) {
  return (
    <div className="zone-row">
      <i style={{ background: color }} />
      <span>
        <b>{name}</b>
        <em>{area}</em>
      </span>
      <strong>{rate.toLocaleString()}</strong>
    </div>
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

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="data-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function CoordinatePicker({ onPick }: { onPick: (coordinate: [number, number]) => void }) {
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
