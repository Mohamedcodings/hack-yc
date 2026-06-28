# Demeter.ai Farm OS

Frontend + backend hackathon prototype for a farmer-facing agriculture operating system.

The demo shows a real satellite farm map in northern France, crop/raster overlays, an LLM farm agent, and a Crop Doctor image diagnosis flow.

## Architecture

- `src/` - React/Vite frontend with Leaflet satellite maps.
- `server/` - TypeScript Express API.
- `server/prompts.ts` - versioned product prompts for the farm agent and Crop Doctor.
- `server/schemas.ts` - Zod validation for every AI endpoint.
- `server/openai.ts` - isolated OpenAI Responses API adapter.

The browser never calls OpenAI directly. It sends farm context or crop photos to the backend:

- `POST /api/agent` - farm chat using map/crop/raster context.
- `POST /api/crop-doctor` - image diagnosis for crop disease, pest pressure, and treatment guidance.
- `GET /api/sources` - farm data provenance used by the frontend source stack.
- `GET /api/live/weather` - live weather extraction through Open-Meteo.
- `GET /api/live/soil` - live soil profile extraction through ISRIC SoilGrids.
- `GET /api/live/satellite` - live Sentinel-2 metadata extraction through Copernicus Data Space STAC.
- `GET /api/farm-context` - aggregate context payload for the current farm.
- `GET /api/health` - backend health check.

## Run Locally

```bash
cp .env.example .env.local
# add OPENAI_API_KEY to .env.local
npm install
npm run dev
```

The app runs at `http://127.0.0.1:5175`.
The API runs at `http://127.0.0.1:8787`.

## Why The Backend Exists

This is intentionally lightweight for a hackathon, but it follows production boundaries:

- API keys stay server-side.
- AI prompts are centralized and reviewable.
- Inputs are validated before calling the model.
- Frontend stays focused on farmer workflows.
- The system is ready to replace mocked farm context with a database or real agronomy APIs.
- Data provenance is explicit: the demo maps current layers to source systems such as Sentinel-2, RPG parcels, Meteo-France, SoilGrids, and basemap tiles.
- Where public no-key APIs are available, connectors fetch live data at request time. When a production-grade source needs credentials, the code keeps the source visible and isolated behind backend connector boundaries.

## Demo Flow

1. Log in with prefilled credentials.
2. Watch context, ontology, and map loading stages.
3. Explore productivity, moisture, thermal, prescription, and crop layout views.
4. Ask the farm agent questions about the active field.
5. Upload a crop photo in Crop Doctor for disease/treatment guidance.
