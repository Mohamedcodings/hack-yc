# Demeter.ai Farm OS

Demeter is an intelligence layer for agriculture: a farmer-facing operating system for field monitoring, satellite agronomy, prescription planning, crop diagnosis, and AI-assisted farm operations.

The hackathon build is centered on a real northern-France farm workspace. It combines real satellite basemaps, traced field boundaries, live weather/soil/satellite connectors, Sentinel Hub NDVI/NDMI integration, an inspectable agronomic intelligence pipeline, an LLM farm agent, Crop Doctor image analysis, and a governed data exchange API for enterprise/public-sector buyers.

## Product Thesis

The ambition is to build a Palantir-style operating layer for agriculture: one command surface where farms, fields, geospatial data, crop plans, external APIs, agronomic models, and human decisions are connected through an ontology-backed intelligence layer.

Modern farms already generate fragmented signals: satellite imagery, weather forecasts, soil texture, crop observations, machinery constraints, agronomist advice, disease pressure, and market/supply-chain risk. Demeter turns those signals into a single operational surface:

- which field is stressed?
- which pixels or zones caused the alert?
- what evidence supports the recommendation?
- what should the farmer verify before taking action?
- how can aggregated, consent-aware field intelligence be exposed to governments, insurers, cooperatives, and enterprises?

## System Architecture

```text
React/Vite frontend
  -> Leaflet + Esri satellite basemap
  -> field list, parcel polygons, NDVI raster cells, layer menu
  -> agent workspace, crop doctor, coordinate copy workflow
  -> optional Clerk/Supabase auth
  -> /api proxy

TypeScript Express API
  -> Open-Meteo weather + archive season connectors
  -> ISRIC SoilGrids connector
  -> Copernicus STAC metadata connector
  -> Sentinel Hub Statistical + Process API adapter
  -> field detail API with live/fallback provenance
  -> agronomic intelligence pipeline
  -> governed data exchange API
  -> OpenAI Responses API adapter

External source systems
  -> Sentinel Hub / Copernicus Data Space OAuth
  -> Sentinel-2 L2A NDVI and NDMI processing
  -> Copernicus Data Space STAC
  -> Open-Meteo forecast and archive APIs
  -> ISRIC SoilGrids REST API
  -> Esri World Imagery tiles and export API
  -> OpenStreetMap labels
  -> OpenAI Responses API
```

## Repository Layout

- `src/` - React/Vite frontend with real map, field management, agent, crop doctor, and dashboard UI.
- `src/components/` - field list, weather modal, field detail panel, imagery cards, notifications, and brand components.
- `src/lib/` - typed frontend API/data layer with live-first fallback behavior.
- `src/auth/` - optional Supabase auth gate and provider selection.
- `server/` - TypeScript Express API.
- `server/fields.ts` - traced northern-France field boundaries and field metadata.
- `server/field-detail.ts` - per-field payload assembly for NDVI, weather, season, imagery, and provenance.
- `server/sentinel-hub.ts` - Sentinel Hub OAuth, Statistical API, and Process API adapter.
- `server/connectors.ts` - public data connectors with degraded-source handling.
- `server/intelligence/` - feature engineering, evidence fusion, risk model, recommendations, uncertainty, and provenance graph.
- `server/data-exchange/` - governed data-product catalog and export manifests.
- `server/openai.ts` - isolated OpenAI Responses API adapter.
- `server/schemas.ts` - Zod validation for AI/data-exchange requests.
- `docs/` - architecture, data contracts, research notes, and ADRs.

## Data Sources And APIs

| Source | Used For | Integration Status |
| --- | --- | --- |
| Sentinel Hub Statistical API | per-field NDVI and NDMI time series | Live when `SH_CLIENT_ID` and `SH_CLIENT_SECRET` are configured |
| Sentinel Hub Process API | real NDVI raster PNG for field imagery cards | Live with graceful synthetic fallback |
| Copernicus Data Space STAC API | Sentinel-2 scene lookup, acquisition date, product ID, cloud-cover metadata | Live backend connector |
| Sentinel-2 L2A | vegetation and moisture remote-sensing indices | Live through Sentinel Hub; simulated fallback for frictionless demos |
| Esri World Imagery | high-resolution satellite basemap and field image cards | Live tile/export API |
| OpenStreetMap labels | roads, towns, contextual labels | Live map label layer |
| Open-Meteo Forecast API | current and forecast weather per field | Live backend connector |
| Open-Meteo Archive API | accumulated precipitation and growing degree days | Live backend connector |
| ISRIC SoilGrids REST API | clay, sand, silt, organic carbon, nitrogen baseline | Live backend connector |
| Clerk | hosted sign-in and protected API routes | Optional |
| Supabase Auth | Google/GitHub/email OAuth bearer verification | Optional |
| OpenAI Responses API | farm agent and crop disease/pest analysis | Server-side model adapter |

The app is explicit about provenance. If Sentinel Hub or a public data provider is unavailable, the backend returns deterministic fallback data and marks provenance accordingly instead of breaking the demo.

## Intelligence Layer

Demeter's backend exposes a deterministic agronomic intelligence pipeline. It turns source evidence into operational findings, uncertainty scores, and traceable recommendations.

Pipeline stages:

1. **Source ingestion** - weather, soil, satellite metadata, Sentinel Hub NDVI/NDMI, and field geometry are fetched behind typed connectors.
2. **Feature engineering** - raw data becomes field-level feature vectors.
3. **Risk signal derivation** - signals are produced for disease pressure, moisture deficit, thermal stress, sprayability, and canopy vigor.
4. **Evidence fusion** - weighted evidence is combined into factor scores.
5. **Recommendation generation** - farmer-readable next actions are ranked by agronomic priority.
6. **Uncertainty scoring** - evidence completeness, confidence, stale-data penalty, and model uncertainty are reported.
7. **Decision provenance graph** - source-to-feature-to-factor-to-recommendation lineage is returned by the API.

Research concepts represented in code:

- multimodal evidence fusion
- phenology-aware risk scoring
- remote-sensing vegetation indices
- Sentinel-2 NDVI/NDMI processing
- soil-water retention proxy
- growing degree day accumulation
- uncertainty-aware agronomic recommendations
- decision provenance graph
- consent-aware agriculture data products

## Backend API Surface

- `GET /api/health` - backend health, auth mode, and configured model.
- `GET /api/sources` - source provenance stack.
- `GET /api/fields` - traced field polygons, crop metadata, NDVI baseline, and area.
- `GET /api/fields/:id` - per-field detail: Sentinel Hub NDVI/NDMI series, NDVI image, weather, GDD, precipitation, satellite imagery, provenance.
- `GET /api/live/weather` - live Open-Meteo forecast extraction.
- `GET /api/live/soil` - live ISRIC SoilGrids profile extraction.
- `GET /api/live/satellite` - live Copernicus STAC Sentinel-2 metadata extraction.
- `GET /api/farm-context` - aggregate context payload for the current farm.
- `GET /api/intelligence/field-state` - fused field state with findings, recommendations, uncertainty, and provenance graph.
- `GET /api/intelligence/ontology` - crop ontology and research concepts.
- `GET /api/data-exchange/catalog` - governed agriculture data products.
- `GET /api/data-exchange/governance` - privacy, consent, aggregation, licensing, and retention policy.
- `POST /api/data-exchange/export` - buyer-safe export manifest with lineage, contract terms, quality SLA, and sample records.
- `POST /api/agent` - LLM farm agent using map, crop, raster, field, and farmer-message context.
- `POST /api/crop-doctor` - image-based disease, pest, and pesticide guidance workflow.

## Frontend Experience

The farmer can:

- open a North France workspace on real satellite imagery;
- see traced fields and switch between crop, productivity, vegetation, moisture, yield, planting, and harvest layers;
- click any map position or field cell to copy exact coordinates for the farm agent;
- open field details with NDVI imagery, satellite imagery, weather, rainfall, and GDD charts;
- interact with an agent-style farm assistant;
- upload crop photos for disease, pest, nutrient-stress, and treatment analysis;
- use the app locally with demo auth or deploy with Clerk/Supabase auth.

## Data Exchange Layer

Demeter exposes a governed data exchange layer for governments, cooperatives, insurers, input providers, food processors, and supply-chain enterprises.

Current data products:

- Regional Crop Stress Index
- Soil Water Deficit Grid
- Crop Supply Risk Feed
- Public Sector Food Security Signals

The exchange API is consent-aware and aggregation-first. It does not export raw farmer identity by default. Each package includes buyer eligibility, permitted uses, prohibited uses, license terms, provenance lineage, quality metadata, and buyer-safe sample records.

## Run Locally

```bash
cp .env.example .env.local
# add OPENAI_API_KEY if you want the agent and crop doctor
npm install
npm run dev
```

The app runs at `http://127.0.0.1:5175`.
The API runs at `http://127.0.0.1:8787`.

To bypass auth locally even when Clerk/Supabase keys exist:

```bash
DEMETER_AUTH_MODE=demo VITE_DEMETER_AUTH_MODE=demo npm run dev
```

## Environment Variables

Core:

```bash
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4.1-mini
API_PORT=8787
DEMETER_DATA_MODE=auto
```

Optional auth:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_or_pk_live
CLERK_PUBLISHABLE_KEY=pk_test_or_pk_live
CLERK_SECRET_KEY=sk_test_or_sk_live

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-project-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-project-anon-key
```

Optional Sentinel Hub / Copernicus Data Space:

```bash
SH_CLIENT_ID=your-sentinel-hub-oauth-client-id
SH_CLIENT_SECRET=your-sentinel-hub-oauth-client-secret
```

Do not commit real credentials. Add them to `.env.local` for local development and to Vercel project environment variables for production.

`DEMETER_DATA_MODE` controls public data connectors:

- `auto` - use live public APIs, then fall back to committed verified snapshots if a provider times out.
- `snapshot` - use bundled snapshots only for zero external-data friction.
- `live` - require live Open-Meteo, SoilGrids, and Copernicus responses.

Sentinel Hub field analytics have their own graceful fallback: if `SH_CLIENT_ID` / `SH_CLIENT_SECRET` are missing or quota is exhausted, field detail still returns deterministic NDVI/NDMI-like series and imagery with `provenance` marked as fallback.

## Deploy On Vercel

The repo is Vercel-ready. Vercel serves the React app and routes `/api/*` to the Express backend through `api/[...path].ts`.

Recommended settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

Minimum production env:

```bash
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4.1-mini
DEMETER_DATA_MODE=auto
```

Recommended production env for the full demo:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_live_or_test
CLERK_PUBLISHABLE_KEY=pk_live_or_test
CLERK_SECRET_KEY=sk_live_or_test
SH_CLIENT_ID=your-sentinel-hub-oauth-client-id
SH_CLIENT_SECRET=your-sentinel-hub-oauth-client-secret
```

## Demo Flow

1. Open the farm workspace.
2. Select a field from the left panel.
3. Switch productivity, vegetation, moisture, yield, and crop layers.
4. Click the map to copy coordinates, then paste them into the farm agent.
5. Open a field detail panel and show NDVI imagery, weather, rainfall, and GDD.
6. Ask the farm agent what to inspect and why.
7. Upload a crop photo in Crop Doctor for diagnosis and treatment guidance.
8. Show `/api/fields/:id` and `/api/intelligence/field-state` to prove there is a real backend intelligence layer.

## Production Roadmap

- PostGIS persistence for farms, fields, crop plans, and sampling points.
- Cloud Optimized GeoTIFF ingestion and temporal raster analytics.
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
