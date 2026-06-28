# Demeter.ai Farm OS

Demeter is an intelligence layer for agriculture: a farmer-facing operating system for field monitoring, prescription-map planning, crop diagnosis, and AI-assisted farm operations.

The current hackathon build focuses on a real northern-France farm map, satellite-style agronomic layers, a typed backend intelligence pipeline, live public data connectors, an LLM farm agent, and a Crop Doctor image-analysis workflow.

## Product Thesis

The long-term ambition is to build a Palantir-style operating layer for agriculture: one system that connects geospatial data, agronomic models, farm operations, external APIs, and human decision-making into a single command surface.

Modern farms already generate fragmented signals: satellite imagery, weather forecasts, soil texture, crop observations, machinery constraints, and agronomist advice. Demeter turns those signals into a single operational surface:

- where is the field stressed?
- why does the system believe that?
- what evidence supports the recommendation?
- what should the farmer verify before taking action?

The product direction is a practical intelligence layer for agriculture: less dashboard noise, more decision support, and a clear provenance trail behind every recommendation.

## System Architecture

```text
React/Vite frontend
  -> Leaflet satellite map
  -> crop zones, raster overlays, agent workspace, crop diagnosis upload
  -> /api proxy

TypeScript Express API
  -> live data connectors
  -> source provenance
  -> agronomic intelligence pipeline
  -> governed data exchange API
  -> OpenAI Responses API adapter
  -> validated AI workflows

External source systems
  -> Copernicus Data Space STAC
  -> Sentinel-2 L2A catalogue metadata
  -> Open-Meteo forecast API
  -> ISRIC SoilGrids REST API
  -> Esri World Imagery tiles
  -> OpenStreetMap labels
  -> French RPG parcel registry reference
```

## Repository Layout

- `src/` - React/Vite frontend with Leaflet satellite maps and farmer workflows.
- `server/` - TypeScript Express API.
- `server/connectors.ts` - live public data connectors with degraded-source handling.
- `server/provenance.ts` - source registry, cadence, evidence, and layer metadata.
- `server/domain/` - typed agronomy domain model.
- `server/intelligence/` - feature engineering, evidence fusion, recommendations, uncertainty, and provenance graph.
- `server/data-exchange/` - governed data-product catalog and export manifests for enterprise/public-sector buyers.
- `server/prompts.ts` - versioned prompts for the farm agent and Crop Doctor.
- `server/schemas.ts` - Zod validation for every AI request.
- `server/openai.ts` - isolated OpenAI Responses API adapter.
- `docs/` - architecture, data contracts, research notes, and ADRs.

## Data Sources And APIs

| Source | Used For | Integration Status |
| --- | --- | --- |
| Copernicus Data Space STAC API | Sentinel-2 scene lookup, acquisition date, product ID, cloud-cover metadata | Live backend connector |
| Sentinel-2 L2A | Vegetation, moisture, and productivity layer roadmap | Metadata live, raster analytics simulated in frontend |
| Esri World Imagery | High-resolution satellite basemap | Live Leaflet tile layer |
| OpenStreetMap labels | Roads, towns, contextual labels | Live map label layer |
| Open-Meteo Forecast API | rainfall, temperature, wind, humidity, soil moisture proxy | Live backend connector |
| ISRIC SoilGrids REST API | clay, sand, silt, soil organic carbon, nitrogen baseline | Live backend connector |
| French RPG parcel registry | farm frontier and declared crop geometry reference | Source documented, static demo geometry today |
| OpenAI Responses API | farm agent and crop disease/pest analysis | Server-side model adapter |

The code is intentionally explicit about which pieces are live and which are prototype calculations. Production integrations would replace the simulated raster layer with real NDVI, NDMI, NDRE, LAI, and land-surface-temperature processing from Sentinel-2 or commercial imagery.

## Intelligence Layer

The backend exposes a deterministic agronomic intelligence pipeline. This is the core of the agriculture intelligence layer: raw field evidence is transformed into operational findings, uncertainty scores, and traceable recommendations. It is designed to be inspectable by judges and easy to replace with stronger production models later.

Pipeline stages:

1. **Source ingestion** - weather, soil, and satellite metadata are fetched through backend connectors.
2. **Feature engineering** - raw source data becomes a field-level feature vector.
3. **Risk signal derivation** - agronomic signals are produced for disease pressure, moisture deficit, thermal stress, sprayability, and canopy vigor.
4. **Evidence fusion** - weighted evidence is combined into posterior factor scores.
5. **Recommendation generation** - farmer-readable next actions are ranked by agronomic priority.
6. **Uncertainty scoring** - evidence completeness, mean confidence, stale-data penalty, and model uncertainty are reported.
7. **Decision provenance graph** - source-to-feature-to-factor-to-recommendation trace is returned by the API.

Research terms represented in code:

- multimodal evidence fusion
- phenology-aware risk scoring
- decision provenance graph
- uncertainty-aware agronomic recommendation
- soil-water retention proxy
- remote-sensing vegetation indices
- prescription-map generation

## Backend API Surface

The browser never calls OpenAI or third-party intelligence APIs directly. The frontend talks to the local backend:

- `GET /api/health` - backend health and configured model.
- `GET /api/sources` - source provenance stack used by the product.
- `GET /api/live/weather` - live Open-Meteo forecast extraction.
- `GET /api/live/soil` - live ISRIC SoilGrids soil profile extraction.
- `GET /api/live/satellite` - live Copernicus STAC Sentinel-2 metadata extraction.
- `GET /api/farm-context` - aggregate context payload for the current farm.
- `GET /api/intelligence/field-state` - fused field state with findings, recommendations, uncertainty, and provenance graph.
- `GET /api/intelligence/ontology` - crop ontology and research concepts.
- `GET /api/data-exchange/catalog` - governed catalog of agriculture data products for governments, insurers, cooperatives, and enterprises.
- `GET /api/data-exchange/governance` - privacy, consent, aggregation, licensing, and retention policy.
- `POST /api/data-exchange/export` - buyer-safe export manifest with lineage, contract terms, quality SLA, and sample records.
- `POST /api/agent` - LLM farm agent using map, crop, raster, and farmer-message context.
- `POST /api/crop-doctor` - image-based disease, pest, and pesticide guidance workflow.

## Data Exchange Layer

Demeter also exposes a governed data exchange layer. The business idea is that agriculture intelligence can become infrastructure for governments, cooperatives, insurers, food processors, input providers, and supply-chain enterprises.

Current data products:

- Regional Crop Stress Index
- Soil Water Deficit Grid
- Crop Supply Risk Feed
- Public Sector Food Security Signals

The exchange API is designed around consent and aggregation. It does not export raw farmer identity by default. Each package includes buyer eligibility, permitted uses, prohibited uses, license terms, provenance lineage, quality metadata, and buyer-safe sample records.

## Frontend Experience

The farmer can:

- log into a preconfigured North France workspace;
- see the farm on a real satellite basemap;
- switch between productivity, moisture, thermal stress, prescription, and crop layout views;
- inspect field zones through coordinate-aware raster cells;
- interact with an agent-style farm assistant;
- upload crop photos for disease and treatment analysis.

## Why The Backend Exists

This is intentionally lightweight for a hackathon, but it follows production boundaries:

- API keys stay server-side.
- External sources are isolated behind connectors.
- Source provenance is visible and reviewable.
- AI prompts are centralized and versionable.
- Request inputs are validated with Zod.
- The intelligence layer returns evidence, not untraceable UI text.
- Frontend code stays focused on farmer workflows.
- The system can evolve toward PostGIS, raster processing, farm telemetry, and user accounts without replacing the product surface.

## Run Locally

```bash
cp .env.example .env.local
# add OPENAI_API_KEY to .env.local
npm install
npm run dev
```

The app runs at `http://127.0.0.1:5175`.
The API runs at `http://127.0.0.1:8787`.

## Demo Flow

1. Log in with the prefilled farmer credentials.
2. Watch context, ontology, and map loading stages.
3. Explore productivity, moisture, thermal, prescription, and crop layout views.
4. Ask the farm agent questions about the active field.
5. Upload a crop photo in Crop Doctor for disease and treatment guidance.
6. Inspect backend field intelligence through `/api/intelligence/field-state`.

## Production Roadmap

High-value next steps:

- PostGIS persistence for farms, parcels, crop plans, and sampling points.
- Cloud Optimized GeoTIFF ingestion for temporal raster analytics.
- Sentinel-2 cloud masking, atmospheric correction, NDVI, NDMI, NDRE, LAI, and thermal proxy processing.
- Historical yield-zone clustering from multi-year remote sensing and harvest maps.
- Phenology-stage estimation per crop and region.
- Weather-risk models for mildew, septoria, rust, sclerotinia, and late blight.
- Prescription-map export for machinery-compatible variable-rate application.
- Audit logs for recommendations, farmer overrides, and agronomist validation.
- Enterprise data exchange contracts, billing, consent management, and warehouse exports.
- Role-based access for farmers, cooperatives, advisors, and seasonal workers.

## Technical Docs

- [Architecture](docs/architecture.md)
- [Intelligence Layer](docs/intelligence-layer.md)
- [API Data Contracts](docs/data-contracts.md)
- [Data Exchange API](docs/data-exchange.md)
- [Research Notes](docs/research-notes.md)
- [ADR 0001](docs/adr/0001-backend-intelligence-layer.md)
