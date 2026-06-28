# Demeter Architecture

Demeter is structured as a farmer-facing agriculture intelligence workspace. The frontend renders the farm map, crop views, diagnosis entry points, and agent surface. The backend owns all model calls, live source connectors, agronomic inference, and provenance.

## Runtime Topology

```text
React/Vite frontend
  -> /api proxy
Express TypeScript API
  -> OpenAI Responses API
  -> Open-Meteo forecast API
  -> ISRIC SoilGrids REST API
  -> Copernicus Data Space STAC API
```

The browser never receives provider credentials and never calls OpenAI directly. This keeps the visible product flexible while preserving a clean migration path to production authentication, telemetry, and database persistence.

## Backend Boundaries

- `server/connectors.ts` retrieves live external context and degrades each source independently.
- `server/provenance.ts` describes source systems, cadence, layers, and sync state.
- `server/intelligence/` turns live context into a field-state inference graph.
- `server/openai.ts` isolates LLM transport from product prompts.
- `server/prompts.ts` contains versioned agent and crop-diagnosis behavior.
- `server/schemas.ts` validates every AI request before model execution.

## Intelligence Layer

The intelligence layer is intentionally deterministic and inspectable for the hackathon. It does not pretend to be a trained yield model. Instead, it implements an evidence-fusion pipeline:

1. Live source extraction.
2. Feature engineering.
3. Factor risk scoring.
4. Weighted evidence fusion.
5. Recommendation generation.
6. Provenance graph construction.
7. Uncertainty scoring.

This gives judges a concrete backend to inspect while keeping the product honest about what is calculated locally and what comes from external APIs.

## Production Extensions

The current architecture is ready for these next integrations:

- Parcel persistence with PostGIS.
- Temporal raster storage with Cloud Optimized GeoTIFFs.
- Real NDVI, NDMI, NDRE, LAI, and land-surface-temperature processing.
- Meteo-France, ECMWF, or farm-station connectors for production weather ingestion.
- Farm operation history, input logs, and machinery telemetry.
- Role-based access control for cooperatives, advisors, and farm workers.
- Model monitoring for crop disease diagnosis and recommendation quality.
