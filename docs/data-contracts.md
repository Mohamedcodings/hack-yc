# API Data Contracts

This file describes the stable API surface used by the frontend and by hackathon reviewers.

## Health

`GET /api/health`

Returns service status and configured model name.

## Source Provenance

`GET /api/sources`

Returns source metadata for the visible product layers. Each source includes:

- `id`
- `name`
- `status`
- `cadence`
- `layers`
- `evidence`
- `lastSync`

## Live Context

`GET /api/live/weather`

Retrieves weather context through Open-Meteo.

`GET /api/live/soil`

Retrieves soil context through ISRIC SoilGrids.

`GET /api/live/satellite`

Retrieves Sentinel-2 catalogue metadata through Copernicus Data Space STAC.

`GET /api/farm-context`

Aggregates weather, soil, and satellite context for the active farm.

## Intelligence

`GET /api/intelligence/field-state`

Returns the computed agronomic field state:

```ts
{
  farmId: string
  context: LiveFarmContext
  intelligence: {
    assumptions: string[]
    featureVector: FeatureVector
    findings: IntelligenceFinding[]
    generatedAt: string
    intelligenceVersion: string
    ontologyVersion: string
    provenanceGraph: ProvenanceGraph
    quality: IntelligenceQuality
    recommendations: IntelligenceRecommendation[]
  }
}
```

`GET /api/intelligence/ontology`

Returns crop ontology nodes and research terms used by the intelligence layer.

## AI Workflows

`POST /api/agent`

Runs the farm agent with validated map, crop, raster, and farmer-message context.

`POST /api/crop-doctor`

Runs image-based crop diagnosis with optional crop and note context.
