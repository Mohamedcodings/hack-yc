import { useMemo, useState } from 'react'
import {
  ChevronDown,
  Cloud,
  CloudRain,
  Droplets,
  Eye,
  Filter,
  Layers,
  Plus,
  Search,
  SlidersHorizontal,
  Sun,
  ThermometerSun,
  Wind,
  X,
} from 'lucide-react'

import type { Field, FieldDetail, ForecastDay, SeriesPoint } from '../lib/dataLayer'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

/* ====================================================================== *
 * Primitives: SVG charts + field boundary thumbnail (no chart deps)
 * ====================================================================== */

export function FieldThumbnail({ field, size = 40 }: { field: Field; size?: number }) {
  const pts = field.boundary
  const lats = pts.map((p) => p[0])
  const lngs = pts.map((p) => p[1])
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const w = maxLng - minLng || 1
  const h = maxLat - minLat || 1
  const pad = 6
  const inner = size - pad * 2

  const d = pts
    .map(([lat, lng], i) => {
      const x = pad + ((lng - minLng) / w) * inner
      const y = pad + (1 - (lat - minLat) / h) * inner
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg className="field-thumb" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <path d={`${d} Z`} fill="none" stroke={field.outline} strokeWidth={1.6} strokeDasharray="3 2" />
    </svg>
  )
}

// Synthetic NDVI raster clipped to the real field shape — used only when a live
// Sentinel Hub NDVI image isn't available. Looks like zoned vegetation vigor, not a
// rainbow gradient: green base biased by the field's NDVI, with stress patches.
const NDVI_RAMP = ['#0a8849', '#2c9c45', '#93b33a', '#d4b536', '#c75b2c']

// Field imagery cards matching the inspiration: the field sits in satellite context,
// shown either NDVI-filled (clipped to the polygon) with a 1.0->0.0 legend, or with its
// boundary outlined. Real Sentinel Hub NDVI when available, else a synthetic raster.
function fieldImageryGeom(field: Field) {
  const lats = field.boundary.map((p) => p[0])
  const lngs = field.boundary.map((p) => p[1])
  const w = Math.min(...lngs)
  const e = Math.max(...lngs)
  const s = Math.min(...lats)
  const n = Math.max(...lats)
  const padX = (e - w) * 0.6 || 0.002
  const padY = (n - s) * 0.6 || 0.002
  const W2 = w - padX
  const E2 = e + padX
  const S2 = s - padY
  const N2 = n + padY

  const VW = 1000
  const midLat = (s + n) / 2
  const aspect = ((E2 - W2) * Math.cos((midLat * Math.PI) / 180)) / (N2 - S2)
  const VH = Math.round(VW / aspect)

  const mapX = (lng: number) => ((lng - W2) / (E2 - W2)) * VW
  const mapY = (lat: number) => (1 - (lat - S2) / (N2 - S2)) * VH
  const polyPts = field.boundary.map(([la, lo]) => `${mapX(lo).toFixed(1)},${mapY(la).toFixed(1)}`).join(' ')

  const sw = 800
  const sh = Math.max(300, Math.min(900, Math.round(800 / aspect)))
  const satUrl =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export' +
    `?bbox=${[W2, S2, E2, N2].join(',')}&bboxSR=4326&imageSR=4326&size=${sw},${sh}&format=jpg&f=image`

  return {
    VW,
    VH,
    polyPts,
    satUrl,
    fieldX: mapX(w),
    fieldW: mapX(e) - mapX(w),
    fieldYtop: mapY(n),
    fieldH: mapY(s) - mapY(n),
  }
}

export function FieldImagery({
  field,
  ndviUrl,
  ndviDate,
  imageDate,
}: {
  field: Field
  ndviUrl: string | null
  ndviDate: string
  imageDate: string
}) {
  const g = useMemo(() => fieldImageryGeom(field), [field])
  const clipId = useMemo(() => `clip-${field.id}-${Math.random().toString(36).slice(2, 6)}`, [field.id])

  const blobs = useMemo(() => {
    let seed = field.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const stress = 1 - Math.min(1, Math.max(0, (field.ndvi - 0.3) / 0.5))
    return Array.from({ length: 7 }, () => {
      const warm = rng() < 0.25 + stress * 0.55
      const idx = warm ? 3 + Math.floor(rng() * 2) : Math.floor(rng() * 3)
      return {
        cx: g.fieldX + rng() * g.fieldW,
        cy: g.fieldYtop + rng() * g.fieldH,
        r: g.fieldW * (0.18 + rng() * 0.28),
        color: NDVI_RAMP[idx],
        opacity: 0.6 + rng() * 0.35,
      }
    })
  }, [field.id, field.ndvi, g])

  return (
    <div className="imagery-row">
      <figure className="imagery">
        <figcaption>NDVI, {ndviDate}</figcaption>
        <div className="imagery-canvas">
          <svg className="imagery-fill" viewBox={`0 0 ${g.VW} ${g.VH}`} preserveAspectRatio="xMidYMid slice" aria-label="NDVI map">
            <defs>
              <clipPath id={clipId}>
                <polygon points={g.polyPts} />
              </clipPath>
              <filter id={`${clipId}-b`}>
                <feGaussianBlur stdDeviation={g.fieldW * 0.06} />
              </filter>
            </defs>
            <image href={g.satUrl} x={0} y={0} width={g.VW} height={g.VH} preserveAspectRatio="xMidYMid slice" opacity={0.5} />
            {ndviUrl ? (
              <image
                href={ndviUrl}
                x={g.fieldX}
                y={g.fieldYtop}
                width={g.fieldW}
                height={g.fieldH}
                clipPath={`url(#${clipId})`}
                preserveAspectRatio="none"
              />
            ) : (
              <g clipPath={`url(#${clipId})`}>
                <rect x={g.fieldX} y={g.fieldYtop} width={g.fieldW} height={g.fieldH} fill={NDVI_RAMP[1]} />
                {blobs.map((b, i) => (
                  <ellipse key={i} cx={b.cx} cy={b.cy} rx={b.r} ry={b.r * 0.7} fill={b.color} opacity={b.opacity} filter={`url(#${clipId}-b)`} />
                ))}
              </g>
            )}
            <polygon points={g.polyPts} fill="none" stroke="#ffffff" strokeWidth={2.5} opacity={0.85} />
          </svg>
          <div className="ndvi-legend">
            <span>1.0</span>
            <i />
            <span>0.0</span>
          </div>
        </div>
      </figure>

      <figure className="imagery">
        <figcaption>Satellite image, {imageDate}</figcaption>
        <div className="imagery-canvas">
          <svg className="imagery-fill" viewBox={`0 0 ${g.VW} ${g.VH}`} preserveAspectRatio="xMidYMid slice" aria-label="Satellite image">
            <image href={g.satUrl} x={0} y={0} width={g.VW} height={g.VH} preserveAspectRatio="xMidYMid slice" />
            <polygon points={g.polyPts} fill="none" stroke="#111417" strokeWidth={2.5} opacity={0.9} />
          </svg>
        </div>
      </figure>
    </div>
  )
}

function buildPath(values: SeriesPoint[], w: number, h: number, pad = 4) {
  if (!values.length) {
    return { line: '', area: '', max: 0, min: 0 }
  }

  const ys = values.map((v) => v.value)
  const max = Math.max(...ys)
  const min = Math.min(...ys)
  const range = max - min || 1
  const stepX = (w - pad * 2) / Math.max(1, values.length - 1)

  const coords = values.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - (v.value - min) / range) * (h - pad * 2)
    return [x, y] as const
  })

  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`

  return { line, area, max, min }
}

export function LineChart({
  series,
  height = 140,
  stroke = 'var(--accent)',
  fill = false,
  months,
}: {
  series: SeriesPoint[]
  height?: number
  stroke?: string
  fill?: boolean
  months?: string[]
}) {
  const w = 560
  const { line, area } = useMemo(() => buildPath(series, w, height), [series, height])
  const gid = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, [])

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" width="100%" height={height}>
        {fill && (
          <>
            <defs>
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
                <stop offset="100%" stopColor={stroke} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gid})`} />
          </>
        )}
        <path d={line} fill="none" stroke={stroke} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      </svg>
      {months && (
        <div className="chart-axis">
          {months.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1

  return (
    <div className="sparkline" aria-hidden="true">
      {values.map((v, i) => (
        <i key={i} style={{ height: `${20 + ((v - min) / range) * 80}%` }} />
      ))}
    </div>
  )
}

/* ====================================================================== *
 * Field list panel (left)
 * ====================================================================== */

export function FieldListPanel({
  fields,
  totalAreaHa,
  selectedFieldId,
  checkedFieldIds,
  onSelectField,
  onToggleCheck,
  onAddFields,
}: {
  fields: Field[]
  totalAreaHa: number
  selectedFieldId: string | null
  checkedFieldIds: Set<string>
  onSelectField: (id: string) => void
  onToggleCheck: (id: string) => void
  onAddFields: () => void
}) {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const filtered = fields.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="field-list">
      <header className="field-list__head">
        <div>
          <h2 className="h3">Season 2026</h2>
          <span className="mono small">{totalAreaHa.toFixed(2)} ha</span>
        </div>
      </header>

      <div className="field-list__search">
        <Search size={15} />
        <input
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search fields"
        />
        <button type="button" className="field-list__sort">
          Sort <SlidersHorizontal size={13} />
        </button>
      </div>

      <div className="field-list__group">
        <ChevronDown size={15} />
        <b>Fields not analyzed</b>
        <span className="mono small">{totalAreaHa.toFixed(2)} ha</span>
      </div>

      <div className="field-list__rows">
        {filtered.map((field) => (
          <button
            type="button"
            key={field.id}
            className={`field-row ${selectedFieldId === field.id ? 'active' : ''}`}
            onClick={() => onSelectField(field.id)}
          >
            <FieldThumbnail field={field} />
            <span className="field-row__meta">
              <b>{field.name}</b>
              <em className="mono">{field.areaHa.toFixed(2)} ha</em>
            </span>
            <span
              className={`field-check ${checkedFieldIds.has(field.id) ? 'on' : ''}`}
              role="checkbox"
              aria-checked={checkedFieldIds.has(field.id)}
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onToggleCheck(field.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onToggleCheck(field.id)
                }
              }}
            />
          </button>
        ))}
      </div>

      <div className="field-list__fab">
        {menuOpen && (
          <div className="fab-menu" role="menu">
            {['Select on map', 'Draw fields', 'Upload file', 'Import from John Deere'].map((item) => (
              <button key={item} type="button" role="menuitem" onClick={() => setMenuOpen(false)}>
                {item}
              </button>
            ))}
            <hr />
            <button type="button" role="menuitem" onClick={() => setMenuOpen(false)}>
              Create group
            </button>
          </div>
        )}
        <button
          type="button"
          className="fab"
          aria-label="Add fields"
          onClick={() => {
            setMenuOpen((o) => !o)
            onAddFields()
          }}
        >
          <Plus size={22} />
        </button>
      </div>
    </div>
  )
}

/* ====================================================================== *
 * Map layer dropdown
 * ====================================================================== */

const MAP_LAYERS = [
  { id: 'crop', label: 'Crop' },
  { id: 'productivity', label: 'Productivity map' },
  { id: 'satellite', label: 'Satellite image' },
  { id: 'vegetation', label: 'Vegetation' },
  { id: 'moisture', label: 'Moisture' },
  { id: 'yield', label: 'Yield' },
  { id: 'planting', label: 'Planting date' },
  { id: 'harvest', label: 'Harvest date' },
] as const

export type MapLayerId = (typeof MAP_LAYERS)[number]['id']

export function MapLayerMenu({
  active,
  onChange,
}: {
  active: MapLayerId
  onChange: (id: MapLayerId) => void
}) {
  const [open, setOpen] = useState(false)
  const current = MAP_LAYERS.find((l) => l.id === active) ?? MAP_LAYERS[1]

  return (
    <div className="layer-menu">
      <button type="button" className="layer-menu__trigger" onClick={() => setOpen((o) => !o)}>
        <Layers size={15} />
        <span>
          <b>{current.label}</b>
          <em>Field name</em>
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="layer-menu__panel">
          <span className="eyebrow eyebrow--plain layer-menu__kicker">Map layer</span>
          {MAP_LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              className={layer.id === active ? 'active' : ''}
              onClick={() => {
                onChange(layer.id)
                setOpen(false)
              }}
            >
              {layer.label}
              {layer.id === active && <span className="tick">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ====================================================================== *
 * Weather modal
 * ====================================================================== */

export function WeatherModal({
  fieldName,
  detail,
  onClose,
}: {
  fieldName: string
  detail: FieldDetail
  onClose: () => void
}) {
  const { now, hourly, forecast } = detail.weather

  const cards = [
    { icon: ThermometerSun, label: 'Temperature', value: `+${now.temperatureC}°`, spark: hourly.temp },
    { icon: CloudRain, label: 'Precipitation', value: `${now.precipitationMm} mm`, spark: null },
    { icon: Wind, label: 'Wind', value: `${now.windDir} ${now.windMs} m/s`, spark: hourly.wind },
    { icon: Cloud, label: 'Cloud cover', value: `${now.cloudCoverPct}%`, spark: hourly.cloud },
    { icon: Droplets, label: 'Humidity', value: `${now.humidityPct}%`, spark: hourly.humidity },
    { icon: Eye, label: 'Dew point', value: `+${now.dewPointC}°`, spark: hourly.dew },
  ]

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="weather-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h2 className="h3">Weather</h2>
            <span className="small">{fieldName}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="weather-grid">
          {cards.map((c) => (
            <article key={c.label}>
              <div className="weather-card__top">
                <c.icon size={16} />
                <span>{c.label}</span>
                <b>{c.value}</b>
              </div>
              {c.spark ? <Sparkline values={c.spark} /> : <p className="small">Not expected in the next 24 hours</p>}
            </article>
          ))}
        </div>

        <h3 className="eyebrow eyebrow--plain">Forecast</h3>
        <div className="forecast-table">
          <div className="forecast-row forecast-row--head">
            <span />
            {forecast.map((d: ForecastDay) => (
              <span key={d.label}>
                <b>{d.label}</b>
                <em className="small">{d.date}</em>
              </span>
            ))}
          </div>
          {(
            [
              ['Temperature', (d: ForecastDay) => `+${d.tempMin}° …+${d.tempMax}°`],
              ['Precipitation', (d: ForecastDay) => `${d.precipMm} mm`],
              ['Wind', (d: ForecastDay) => `${d.windMs} m/s ${d.windDir}`],
              ['Cloud cover', (d: ForecastDay) => `${d.cloudPct}%`],
              ['Humidity', (d: ForecastDay) => `${d.humidityPct}%`],
              ['Dew point', (d: ForecastDay) => `+${d.dewPointC}°`],
            ] as const
          ).map(([label, fn], rowIdx) => (
            <div className="forecast-row" key={label}>
              <span className="forecast-row__label">
                {rowIdx === 0 && forecast.map((d) => <i key={d.label} className={`wx wx-${d.icon}`} />)}
                {label}
              </span>
              {forecast.map((d) => (
                <span key={d.label}>{fn(d)}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ====================================================================== *
 * Field detail panel (slide-over)
 * ====================================================================== */

const DETAIL_TABS = ['Status', 'Field report', 'Prescription maps', 'Data', 'Yield Analysis'] as const
const PRO_TABS = new Set(['Field report', 'Prescription maps', 'Yield Analysis'])

export function FieldDetailPanel({
  detail,
  onClose,
  onOpenWeather,
}: {
  detail: FieldDetail
  onClose: () => void
  onOpenWeather: () => void
}) {
  const [tab, setTab] = useState<(typeof DETAIL_TABS)[number]>('Status')
  const { field, weather } = detail

  return (
    <section className="field-detail reveal is-visible">
      <header className="field-detail__head">
        <div>
          <h2 className="h2">{field.name}</h2>
          <span className="small mono">
            {field.areaHa.toFixed(2)} ha · {field.crop ?? 'No crop'}
          </span>
        </div>
        <div className="field-detail__actions">
          <button type="button" className="ghost-action">Prescription map</button>
          <button type="button" className="ghost-action">Soil sampling map</button>
          <button type="button" className="ghost-action">Upload data</button>
          <button type="button" className="icon-action" onClick={onClose} aria-label="Close field">
            <X size={18} />
          </button>
        </div>
      </header>

      <nav className="field-tabs">
        {DETAIL_TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'active' : ''}
            onClick={() => setTab(t)}
          >
            {t}
            {PRO_TABS.has(t) && <sup className="pro">PRO</sup>}
          </button>
        ))}
      </nav>

      {tab === 'Status' ? (
        <div className="field-detail__body">
          <div className="status-row">
            <div className="status-card">
              <span className="small">Crop</span>
              <b>{field.crop ?? 'Add crop'}</b>
            </div>
            <div className="status-card">
              <span className="small">Planting date</span>
              <b>{field.plantingDate ?? 'Add planting date'}</b>
            </div>
            <button type="button" className="status-card status-card--wx" onClick={onOpenWeather}>
              <span className="wx-temp">
                <Sun size={18} /> +{weather.now.temperatureC}°
              </span>
              <span className="small">
                {weather.now.precipitationMm} mm · {weather.now.windMs} m/s
              </span>
            </button>
          </div>

          <FieldImagery
            field={field}
            ndviUrl={detail.images?.ndviUrl ?? null}
            ndviDate={detail.satellite.ndviDate}
            imageDate={detail.satellite.imageDate}
          />

          <article className="metric-block">
            <div className="metric-block__head">
              <span className="eyebrow eyebrow--plain">NDVI</span>
              <b className="metric-value">{field.ndvi.toFixed(2)}</b>
            </div>
            <LineChart series={detail.ndviSeries} months={MONTHS} fill stroke="var(--accent)" />
          </article>

          <article className="metric-block">
            <div className="metric-block__head">
              <span className="eyebrow eyebrow--plain">Accumulated precipitation</span>
              <b className="metric-value">{detail.summary.precipitationMm} mm</b>
            </div>
            <LineChart series={detail.precipitationSeries} months={MONTHS} fill stroke="#3f7bd6" />
          </article>

          <article className="metric-block">
            <div className="metric-block__head">
              <span className="eyebrow eyebrow--plain">Growing degree-days</span>
              <b className="metric-value">+{detail.summary.gdd}°</b>
            </div>
            <LineChart series={detail.gddSeries} months={MONTHS} fill stroke="var(--warn)" />
          </article>
        </div>
      ) : (
        <div className="field-detail__empty">
          <Filter size={20} />
          <p className="small">
            {tab} is a PRO surface in the inspiration product. Status carries the live agronomic signal in this build.
          </p>
        </div>
      )}
    </section>
  )
}

/* ====================================================================== *
 * Selection action bar (bottom)
 * ====================================================================== */

export function SelectionActionBar({
  fields,
  checkedFieldIds,
  onClear,
}: {
  fields: Field[]
  checkedFieldIds: Set<string>
  onClear: () => void
}) {
  if (checkedFieldIds.size === 0) {
    return null
  }

  const area = fields
    .filter((f) => checkedFieldIds.has(f.id))
    .reduce((sum, f) => sum + f.areaHa, 0)

  return (
    <div className="selection-bar reveal is-visible">
      <span className="mono">
        {checkedFieldIds.size} selected · {area.toFixed(2)} ha
      </span>
      <div className="selection-bar__actions">
        <button type="button">Move</button>
        <button type="button">Delete</button>
        <button type="button">Export data</button>
        <button type="button" className="primary">Create bulk VRA maps</button>
      </div>
      <button type="button" className="selection-bar__close" onClick={onClear} aria-label="Clear selection">
        <X size={16} />
      </button>
    </div>
  )
}
