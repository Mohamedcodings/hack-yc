# Data Exchange API

Demeter includes a consent-aware data exchange layer for public-sector and enterprise analytics. The goal is to package agricultural intelligence into buyer-safe products without exposing raw farmer identity or raw parcel boundaries by default.

## Buyer Segments

- `government` - food-security monitoring, drought response, policy planning.
- `enterprise` - supply-chain risk, procurement planning, sustainability reporting.
- `insurance` - portfolio risk monitoring and parametric insurance research.
- `cooperative` - member advisory services and input logistics.
- `research` - non-identifying agronomic and climate-resilience analysis.

## Data Products

The current catalog exposes four product families:

- Regional Crop Stress Index
- Soil Water Deficit Grid
- Crop Supply Risk Feed
- Public Sector Food Security Signals

Each data product declares:

- eligible buyer segments;
- delivery formats;
- source systems;
- schema fields;
- spatial and temporal resolution;
- privacy class;
- governance controls;
- license and pricing unit.

## Governance Model

The exchange is designed around these rules:

- no raw farmer identity export;
- no resale of raw parcel boundaries;
- k-anonymity threshold before regional export;
- product-level consent model;
- source provenance attached to each package;
- audit manifest generated for every export;
- human verification required before regulated agronomic actions.

## API Surface

`GET /api/data-exchange/catalog`

Returns available data products and commercial metadata.

`GET /api/data-exchange/governance`

Returns policy, consent, export restriction, and retention metadata.

`POST /api/data-exchange/export`

Builds a preview export manifest:

```json
{
  "productId": "regional-crop-stress-index",
  "buyerSegment": "government",
  "format": "json",
  "region": "Hauts-de-France",
  "purpose": "Food-security and climate-risk monitoring"
}
```

The response includes product metadata, contract terms, delivery information, lineage, quality SLA, and sample buyer-safe records.

## Production Direction

In production, this layer would sit behind authentication, enterprise contracts, consent management, billing, and warehouse exports. The current implementation focuses on the core domain contract and governance model so the business line is visible in code.
