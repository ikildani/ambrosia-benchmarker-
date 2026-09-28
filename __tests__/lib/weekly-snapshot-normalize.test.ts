/**
 * Market Pulse counts must not double-count a deal or split one modality in two.
 */
import { canonicalModality, collapseDuplicateDeals } from '@/lib/digest/weekly-snapshot';

describe('canonicalModality', () => {
  it('folds snake_case into the camelCase key the rest of the corpus uses', () => {
    expect(canonicalModality('small_molecule')).toBe('smallMolecule');
    expect(canonicalModality('smallMolecule')).toBe('smallMolecule');
    expect(canonicalModality('gene_therapy')).toBe('geneTherapy');
    expect(canonicalModality('adc')).toBe('adc');
    expect(canonicalModality(null)).toBe('unknown');
  });
});

describe('collapseDuplicateDeals', () => {
  it('collapses the same deal under different spellings and reversed roles, keeping disclosed terms', () => {
    const rows = [
      { id: 'a', licensor_name: 'Biohaven Ltd', licensee_name: 'SK Biopharmaceuticals', asset_name: 'BHV-7000', upfront_usd: null, total_deal_value_usd: null, dedupe_group_id: null },
      { id: 'b', licensor_name: 'SK Biopharmaceuticals', licensee_name: 'Biohaven', asset_name: 'BHV-7000', upfront_usd: 50e6, total_deal_value_usd: 400e6, dedupe_group_id: null },
      { id: 'c', licensor_name: 'Sydnexis', licensee_name: 'Ligand', asset_name: 'SYD-101', upfront_usd: 10e6, total_deal_value_usd: null, dedupe_group_id: 'grp-1' },
      { id: 'd', licensor_name: 'Sydnexis Inc.', licensee_name: 'Ligand Pharmaceuticals', asset_name: 'SYD101', upfront_usd: null, total_deal_value_usd: null, dedupe_group_id: 'grp-1' },
      { id: 'e', licensor_name: 'Other Bio', licensee_name: 'Big Pharma', asset_name: 'X-1', upfront_usd: 5e6, total_deal_value_usd: 5e6, dedupe_group_id: null },
    ];
    const out = collapseDuplicateDeals(rows).map((r) => r.id).sort();
    expect(out).toEqual(['b', 'c', 'e']);
  });
});
