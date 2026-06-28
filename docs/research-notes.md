# Research Notes

Demeter uses research language carefully: the current repo implements an explainable prototype pipeline, not a production agronomy model.

## Relevant Technical Directions

- Multimodal evidence fusion for combining remote sensing, soil, weather, and field observations.
- Phenology-aware disease risk scoring where crop stage affects model interpretation.
- Vegetation-index analytics such as NDVI, NDMI, NDRE, LAI, and canopy chlorophyll proxy layers.
- Soil-water balance modeling using texture, rainfall, evapotranspiration, and crop coefficient curves.
- Prescription-map generation from productivity zones, constraints, and machinery-compatible rates.
- Decision provenance graphs for auditability of agronomic recommendations.
- Uncertainty-aware recommendations so the system can distinguish action from required verification.

## Prototype Scope

The hackathon implementation currently uses live public APIs where possible and deterministic feature fusion where full scientific models would require heavier processing, credentials, or historical datasets.

The most important engineering choice is that the simulated and calculated pieces live behind explicit module boundaries. That makes the code easier to replace with production-grade services without rewriting the user experience.

## Production Model Candidates

- Field boundary extraction from parcel registries and segmentation models.
- Sentinel-2 raster processing for cloud masking, atmospheric correction, and index computation.
- Disease-pressure models per crop using weather windows and phenology stage.
- Yield-zone clustering using multi-year vegetation and harvest data.
- Prescription optimization constrained by label rates, machine width, buffer zones, and input economics.
