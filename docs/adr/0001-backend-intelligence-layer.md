# ADR 0001: Backend Intelligence Layer

## Status

Accepted.

## Context

The frontend needs to feel like an operational farm workspace, but the codebase must also be credible to technical reviewers. Putting all agronomic state in React would make the product look like a visual mockup. Calling AI directly from the browser would expose credentials and make the system difficult to evaluate.

## Decision

Create a TypeScript Express backend that owns:

- External source connectors.
- Source provenance.
- Field-state intelligence calculation.
- LLM and vision-model calls.
- Request validation.
- Future persistence boundaries.

## Consequences

The frontend remains focused on farmer interaction while the backend becomes inspectable product infrastructure. The intelligence layer can evolve from deterministic evidence fusion to real raster analytics, crop models, and database-backed farm operations without replacing the UI.
