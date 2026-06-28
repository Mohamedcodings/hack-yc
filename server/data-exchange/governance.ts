import type { BuyerSegment, DataGovernancePolicy, DataProduct } from '../domain/data-exchange.ts'

export const governanceVersion = 'data-governance-v0.1.0'

export const dataGovernancePolicy: DataGovernancePolicy = {
  aggregationThreshold: 25,
  consentModel: 'Farmer-controlled consent registry with product-level opt-in and revocation hooks.',
  exportRestrictions: [
    'No raw farmer identity export.',
    'No resale of raw parcel boundaries.',
    'No use for punitive enforcement without a separate legal basis.',
    'No chemical recommendation automation without agronomist or farmer validation.',
  ],
  fieldBoundaryPolicy: 'Field-level exports require explicit consent; commercial feeds use dissolved, aggregated, or jittered geometries.',
  privacyGuarantees: [
    'k-anonymity threshold before regional export',
    'purpose-bound licensing',
    'source provenance attached to every package',
    'audit manifest for every generated dataset',
  ],
  retentionPolicy: 'Preview manifests are ephemeral; contracted exports define retention by data product and buyer agreement.',
}

const permittedUseByBuyer: Record<BuyerSegment, string[]> = {
  cooperative: ['member advisory services', 'regional planning', 'input logistics'],
  enterprise: ['supply-chain risk monitoring', 'procurement planning', 'sustainability reporting'],
  government: ['food-security monitoring', 'drought response', 'agricultural policy planning'],
  insurance: ['portfolio risk monitoring', 'parametric trigger research', 'loss-adjustment prioritization'],
  research: ['non-identifying agronomic research', 'climate resilience analysis', 'model benchmarking'],
}

export function buildContractTerms(product: DataProduct, buyerSegment: BuyerSegment) {
  return {
    buyerSegment,
    license: product.license,
    permittedUses: permittedUseByBuyer[buyerSegment],
    prohibitedUses: dataGovernancePolicy.exportRestrictions,
    pricingUnit: product.pricingUnit,
  }
}
