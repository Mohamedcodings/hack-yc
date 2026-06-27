import { useState } from 'react'
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

  return (
    <main className="map-only">
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
      <aside className={`cell-inspector ${hoveredCell ? 'visible' : ''}`}>
        {hoveredCell ? (
          <>
            <strong>{hoveredCell.label}</strong>
            <span>Hovered cube analytics</span>
            <dl>
              <div>
                <dt>NDVI</dt>
                <dd>{hoveredCell.ndvi.toFixed(2)}</dd>
              </div>
              <div>
                <dt>NDMI</dt>
                <dd>
                  {hoveredCell.ndmi > 0 ? '+' : ''}
                  {hoveredCell.ndmi.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt>Thermal stress</dt>
                <dd>
                  {hoveredCell.thermal > 0 ? '+' : ''}
                  {hoveredCell.thermal.toFixed(1)}°C
                </dd>
              </div>
              <div>
                <dt>Prescription</dt>
                <dd>{hoveredCell.rate}</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <strong>Hover a cube</strong>
            <span>Cell analytics will appear here</span>
          </>
        )}
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
        <CoordinatePicker onPick={setCoordinate} />
        <MapReady />
      </MapContainer>
    </main>
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
