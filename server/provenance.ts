export type FarmDataSource = {
  apiUrl?: string
  cadence: string
  evidence?: string
  id: string
  lastSync: string
  layers: string[]
  name: string
  status: 'connected' | 'degraded' | 'offline'
}

export const farmDataSources: FarmDataSource[] = [
  {
    id: 'sentinel-2',
    name: 'Copernicus Sentinel-2 L2A',
    cadence: '5 day revisit',
    layers: ['NDVI productivity', 'NDMI moisture', 'thermal stress proxy'],
    lastSync: '2026-06-27 06:42 CET',
    status: 'connected',
  },
  {
    id: 'rpg-fr',
    name: 'Registre Parcellaire Graphique',
    cadence: 'annual parcel registry',
    layers: ['farm frontier', 'declared crop geometry'],
    apiUrl: 'https://www.data.gouv.fr/fr/datasets/registre-parcellaire-graphique-rpg-contours-des-parcelles-et-ilots-culturaux-et-leur-groupe-de-cultures-majoritaire/',
    evidence: 'public French agricultural parcel registry reference',
    lastSync: '2026 campaign import',
    status: 'connected',
  },
  {
    id: 'meteo-france',
    name: 'Meteo-France AROME',
    cadence: 'hourly model refresh',
    layers: ['rainfall', 'canopy stress', 'spray window'],
    lastSync: '2026-06-28 08:00 CET',
    status: 'connected',
  },
  {
    id: 'soilgrids',
    name: 'ISRIC SoilGrids',
    cadence: 'static soil baseline',
    layers: ['texture', 'water retention', 'organic carbon'],
    lastSync: '250 m soil profile',
    status: 'connected',
  },
  {
    id: 'imagery',
    name: 'Esri World Imagery + OSM labels',
    cadence: 'basemap service',
    layers: ['satellite context', 'roads and places'],
    apiUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
    evidence: 'live tile service used by Leaflet basemap',
    lastSync: 'live tile service',
    status: 'connected',
  },
]
