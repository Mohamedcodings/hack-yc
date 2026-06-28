# Agriculture Intelligence Layer

The intelligence layer turns raw context into a farmer-readable field state. It is designed like an early decision-support system rather than a static demo payload.

## Core Concepts

- **Agronomic ontology**: crop nodes, phenology signals, disease-pressure factors, and management questions.
- **Feature vector**: normalized evidence from weather, satellite metadata, and soil texture.
- **Evidence signal**: weighted observation that supports a specific agronomic factor.
- **Posterior risk score**: fused factor score after confidence-weighted aggregation.
- **Recommendation**: operational next step with an agronomic rationale and verification requirement.
- **Provenance graph**: trace from source system to feature to factor to recommendation.
- **Quality score**: evidence completeness, mean confidence, stale-data penalty, and model uncertainty.

## Current Factors

| Factor | Purpose |
| --- | --- |
| `canopy_vigor` | Satellite observation quality and vegetation proxy. |
| `disease_pressure` | Rainfall-driven foliar disease pressure. |
| `moisture_deficit` | Soil moisture and water-retention stress. |
| `nutrient_constraint` | Reserved for tissue/soil sample integration. |
| `sprayability` | Wind and weather constraints on spray operations. |
| `thermal_stress` | Temperature-amplitude stress proxy. |

## Inference Contract

`GET /api/intelligence/field-state` returns:

- `context`: live weather, soil, and satellite metadata.
- `intelligence.featureVector`: deterministic model inputs.
- `intelligence.findings`: factor-level posterior risk outputs.
- `intelligence.recommendations`: prioritized farmer actions.
- `intelligence.provenanceGraph`: inspectable source-to-decision trace.
- `intelligence.quality`: uncertainty and completeness metadata.

## Why This Matters

A farmer should not see raw APIs or abstract AI output. They should see what part of the field needs attention, why the system thinks that, how confident it is, and what verification step is still needed before action.
