/**
 * Tests for lib/comps/verified-comps.ts: confidence rules, ladder relaxation,
 * ranking, territory matching, summary stats and the plain-language labels.
 */

import {
  computeConfidence,
  selectVerifiedComps,
  describeSelection,
  territoryMatches,
  summarizeComps,
  quantile,
  estimateVsComps,
  topDrivers,
  adjacentPhaseRange,
  COMP_LADDER,
  classifyAcquisition,
  coreCompanyName,
  type CompCandidateRow,
} from '@/lib/comps/verified-comps';
import { pickSourceLink, toCandidate } from '@/lib/comps/verified-comps.server';

jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn() }));

let seq = 0;
function deal(p: Partial<CompCandidateRow>): CompCandidateRow {
  seq++;
  return {
    id: `d${seq}`,
    licensor: `Licensor ${seq}`,
    licensee: `Licensee ${seq}`,
    asset: null,
    year: 2022,
    announcedDate: '2022-06-01',
    therapeuticArea: 'oncology',
    phase: 'phase_2',
    modality: 'small_molecule',
    indicationCategory: null,
    indicationSpecific: 'non-small cell lung cancer',
    dealType: 'license',
    territory: 'global',
    upfrontM: 50,
    totalM: 500,
    royaltyLowPct: null,
    royaltyHighPct: null,
    sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${seq}/ex99.htm`,
    sourceLabel: 'SEC 8-K',
    ...p,
  };
}

const NSCLC_P2_LICENSE = {
  therapeuticArea: 'oncology', phase: 'phase2', modality: 'smallMolecule', indication: 'lung_nsclc', dealType: 'licensing', territory: 'global',
};

describe('computeConfidence', () => {
  const calibrated = { source: 'calibrated' as const, sampleSize: 25 };

  it('is Low with fewer than 3 close comps, whatever the baseline', () => {
    expect(computeConfidence(0, calibrated).level).toBe('low');
    expect(computeConfidence(2, calibrated).level).toBe('low');
    expect(computeConfidence(2, calibrated).reason).toMatch(/Only 2 closely comparable deals/);
  });

  it('caps a static baseline at Medium', () => {
    expect(computeConfidence(20, { source: 'static', sampleSize: null }).level).toBe('medium');
  });

  it('caps a calibrated baseline with n < 10 at Medium', () => {
    expect(computeConfidence(20, { source: 'calibrated', sampleSize: 9 }).level).toBe('medium');
    expect(computeConfidence(20, null).level).toBe('medium');
  });

  it('is High with 8+ close comps and a calibrated baseline of n >= 10', () => {
    expect(computeConfidence(8, { source: 'calibrated', sampleSize: 10 }).level).toBe('high');
  });

  it('is Medium between 3 and 7 close comps', () => {
    expect(computeConfidence(3, calibrated).level).toBe('medium');
    expect(computeConfidence(7, calibrated).level).toBe('medium');
  });
});

describe('selectVerifiedComps: ranking and relaxation', () => {
  it('stays on the exact rung when it holds enough deals, exact matches first', () => {
    const rows = [
      ...Array.from({ length: 5 }, () => deal({})),
      deal({ phase: 'phase_3' }),
      deal({ modality: 'antibody', indicationSpecific: 'breast cancer' }),
    ];
    const s = selectVerifiedComps(NSCLC_P2_LICENSE, rows);
    expect(s.rungIndex).toBe(0);
    expect(s.relaxed).toBe(false);
    expect(s.comps).toHaveLength(5);
    expect(s.comps.every(c => c.rung === 0)).toBe(true);
  });

  it('widens one step at a time and keeps closer deals ahead of looser ones', () => {
    const rows = [
      deal({ year: 2019, announcedDate: '2019-01-01' }), // exact
      deal({ phase: 'phase_1', year: 2025, announcedDate: '2025-01-01' }), // adjacent + modality
      deal({ phase: 'phase_3' }),
      deal({ phase: 'phase_3', indicationSpecific: 'colorectal' }),
      deal({ phase: 'phase_1', indicationSpecific: 'pancreatic' }),
      deal({ phase: 'preclinical' }), // two steps away: excluded at the adjacent rung
    ];
    const s = selectVerifiedComps(NSCLC_P2_LICENSE, rows);
    expect(COMP_LADDER[s.rungIndex!]).toMatchObject({ phase: 'adjacent', modality: true });
    expect(s.relaxed).toBe(true);
    expect(s.comps).toHaveLength(5);
    expect(s.comps[0].rung).toBe(0); // the 2019 exact match leads the 2025 adjacent one
    expect(s.comps.some(c => c.phase === 'preclinical')).toBe(false);
  });

  it('holds deal structure longer than modality: acquisitions are not priced off licenses', () => {
    const rows = [
      ...Array.from({ length: 6 }, () => deal({ modality: 'peptide', indicationSpecific: 'prostate cancer', dealType: 'license' })),
      ...Array.from({ length: 5 }, () => deal({ modality: 'antibody', indicationSpecific: 'solid tumors', dealType: 'acquisition', upfrontM: 900 })),
    ];
    const s = selectVerifiedComps({ therapeuticArea: 'oncology', phase: 'phase2', modality: 'peptide', indication: 'prostate', dealType: 'acquisition', territory: 'global' }, rows);
    expect(s.comps.every(c => c.dealType === 'acquisition')).toBe(true);
    expect(s.summary.medianUpfrontM).toBe(900);
    expect(s.closeCount).toBe(0);
    // No asset purchases among them: confidence is capped at Low and the note says why.
    expect(s.confidenceCap).toBe('low');
    expect(s.acquisitionNote).toMatch(/Fewer than 3/);
  });

  it('falls back to the whole therapeutic area when nothing closer reaches the minimum', () => {
    const rows = [deal({ phase: 'approved', dealType: 'license', modality: 'antibody', indicationSpecific: 'melanoma' })];
    const s = selectVerifiedComps(NSCLC_P2_LICENSE, rows);
    expect(s.rungIndex).toBe(COMP_LADDER.length - 1);
    expect(s.comps).toHaveLength(1);
  });

  it('returns an empty selection when there are no rows', () => {
    const s = selectVerifiedComps(NSCLC_P2_LICENSE, []);
    expect(s.rungIndex).toBeNull();
    expect(s.summary.n).toBe(0);
    expect(s.summary.medianUpfrontM).toBeNull();
  });

  it('ignores other therapeutic areas, rows without an upfront, and approved-stage M&A for a pre-approval query', () => {
    const rows = [
      deal({ therapeuticArea: 'neurology' }),
      deal({ upfrontM: 0 }),
      deal({ phase: 'approved', dealType: 'acquisition' }),
      deal({}),
    ];
    const s = selectVerifiedComps(NSCLC_P2_LICENSE, rows);
    expect(s.comps).toHaveLength(1);
  });

  it('caps the pool', () => {
    const rows = Array.from({ length: 40 }, () => deal({}));
    expect(selectVerifiedComps(NSCLC_P2_LICENSE, rows, { maxPool: 25 }).comps).toHaveLength(25);
  });

  it('prefers Greater China licenses for a China query and drops ex-China licenses', () => {
    const china = { ...NSCLC_P2_LICENSE, territory: 'china' };
    const rows = [
      ...Array.from({ length: 5 }, () => deal({ territory: 'Greater China', upfrontM: 20 })),
      ...Array.from({ length: 5 }, () => deal({ territory: 'global', upfrontM: 200 })),
      deal({ territory: 'US, EU, Japan, and rest of world excluding Greater China', upfrontM: 300 }),
    ];
    const s = selectVerifiedComps(china, rows);
    expect(s.rungIndex).toBe(0);
    expect(s.comps.every(c => c.territory === 'Greater China')).toBe(true);
    expect(s.summary.medianUpfrontM).toBe(20);
  });
});

describe('territoryMatches', () => {
  const lic = (territory: string | null) => ({ territory, dealType: 'license' });
  it('treats global, US and unrecorded rights as global', () => {
    expect(territoryMatches('global', lic('global'))).toBe(true);
    expect(territoryMatches('global', lic(null))).toBe(true);
    expect(territoryMatches('global', lic('us'))).toBe(true);
    expect(territoryMatches('global', lic('china'))).toBe(false);
    expect(territoryMatches('global', lic('regional'))).toBe(false);
  });
  it('matches China queries to China licenses only', () => {
    expect(territoryMatches('china', lic('Greater China'))).toBe(true);
    expect(territoryMatches('china', lic('greater_china'))).toBe(true);
    expect(territoryMatches('china', lic('ex_china'))).toBe(false);
    expect(territoryMatches('china', lic('global ex-Greater China'))).toBe(false);
    expect(territoryMatches('china', lic('global'))).toBe(false);
  });
  it('lets acquisitions match any territory', () => {
    expect(territoryMatches('china', { territory: 'global', dealType: 'acquisition' })).toBe(true);
  });
});

describe('stats', () => {
  it('quantile interpolates linearly', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10, 20, 30, 40, 50], 0.25)).toBe(20);
    expect(quantile([], 0.5)).toBeNull();
  });
  it('summarizeComps reports median and interquartile range of upfronts', () => {
    const s = summarizeComps([{ upfrontM: 10, totalM: 100 }, { upfrontM: 20, totalM: null }, { upfrontM: 30, totalM: 300 }]);
    expect(s).toMatchObject({ n: 3, medianUpfrontM: 20, p25UpfrontM: 15, p75UpfrontM: 25, medianTotalM: 200, nTotal: 2 });
  });
});

describe('labels', () => {
  it('describes the phase window', () => {
    expect(adjacentPhaseRange('phase2')).toBe('Phase 1–3');
    expect(adjacentPhaseRange('phase1')).toBe('Preclinical to Phase 2');
  });

  it('says plainly when it had to widen', () => {
    const q = { therapeuticArea: 'oncology', phase: 'phase2', modality: 'peptide', indication: 'prostate', dealType: 'acquisition', territory: 'global' };
    const adjAcq = COMP_LADDER.findIndex(r => r.phase === 'adjacent' && !r.modality && !r.indication && r.structure && !r.territory);
    const d = describeSelection(q, adjAcq, { modality: 'Peptide', indication: 'Prostate Cancer' });
    expect(d.relaxationNote).toBe('Fewer than 5 Phase 2 peptide acquisitions in Prostate Cancer with disclosed terms; showing Phase 1–3 acquisitions in oncology.');
    expect(describeSelection(q, 0, { modality: 'Peptide', indication: 'Prostate Cancer' }).relaxationNote).toBeNull();
  });

  it('names the territory for regional licenses', () => {
    const q = { ...NSCLC_P2_LICENSE, territory: 'china' };
    expect(describeSelection(q, 0, { modality: 'Small Molecule', indication: 'NSCLC' }).shown)
      .toBe('Phase 2 small molecule licensing deals in NSCLC for Greater China rights');
  });
});

describe('estimate vs comps', () => {
  const mods = [
    { name: 'Peptide', multiplier: 1.4, applied: 1.25 },
    { name: 'Prostate', multiplier: 0.9, applied: 0.92 },
    { name: 'Global rights', multiplier: 1.0 },
  ];
  it('orders drivers by size of effect and drops neutral ones', () => {
    expect(topDrivers(mods)).toEqual([{ name: 'Peptide', pct: 25 }, { name: 'Prostate', pct: -8 }]);
  });
  it('explains the gap with the biggest factor pushing the same way when the factors account for it', () => {
    expect(estimateVsComps(140, 100, mods).sentence).toBe('1.4x the comparable median, mainly because of Peptide (+25%).');
    expect(estimateVsComps(85, 100, mods).sentence).toBe('85% of the comparable median, mainly because of Prostate (-8%).');
    expect(estimateVsComps(105, 100, mods).sentence).toBe('In line with the comparable median.');
    expect(estimateVsComps(100, null, mods).ratio).toBeNull();
  });
  it('does not blame a small factor for a large gap (a +17% factor cannot explain 5.2x)', () => {
    const china = [
      { name: 'Greater China', multiplier: 0.4 },
      { name: 'Lung (NSCLC)', multiplier: 1.17 },
      { name: 'Some combo potential', multiplier: 1.07 },
    ];
    const s = estimateVsComps(104, 20, china).sentence!;
    expect(s).toMatch(/^5\.2x the comparable median\. Most of the gap is in the starting point for this stage, which sits above/);
    expect(s).not.toMatch(/mainly because/);
    expect(estimateVsComps(50, 100, mods).sentence).toMatch(/^50% of the comparable median\. Most of the gap .* sits below/);
  });
  it('never blames the deal structure, which the comps already share', () => {
    const asset = [
      { name: 'Asset purchase', multiplier: 0.1 },
      { name: 'Peptide', multiplier: 0.6 },
    ];
    expect(estimateVsComps(4.9, 9, asset).sentence).toBe('54% of the comparable median, mainly because of Peptide (-40%).');
    expect(estimateVsComps(2, 9, [{ name: 'Asset purchase', multiplier: 0.1 }]).sentence).not.toMatch(/Asset purchase/);
  });
});

describe('source links', () => {
  it('prefers the press release, then the filing URL, and refuses bare domains', () => {
    expect(pickSourceLink({ press_release_url: 'https://x.com/news/1', source_url: 'https://www.sec.gov/Archives/a', source_type: 'sec_8k' }))
      .toEqual({ url: 'https://x.com/news/1', label: 'Press release' });
    expect(pickSourceLink({ press_release_url: null, source_url: 'https://www.sec.gov/Archives/a', source_type: 'sec_8k' }))
      .toEqual({ url: 'https://www.sec.gov/Archives/a', label: 'SEC 8-K' });
    expect(pickSourceLink({ press_release_url: 'https://news.bms.com', source_url: null, source_type: 'press_release' })).toBeNull();
  });

  it('drops rows that are not primary-sourced', () => {
    const base = {
      id: '1', licensor_name: 'A', licensee_name: 'B', asset_name: null, announced_date: '2024-01-01', therapeutic_area: 'oncology',
      phase_at_signing: 'phase_2', modality: 'adc', indication_category: null, indication_specific: null, deal_type: 'license',
      territory: 'global', upfront_usd: 50_000_000, total_deal_value_usd: 500_000_000, royalty_low_pct: null, royalty_high_pct: null,
      source_url: 'https://example.com/pr/1', press_release_url: null, source_type: 'perplexity_discovery', source_filing_id: null,
    };
    expect(toCandidate(base)).toBeNull();
    expect(toCandidate({ ...base, source_filing_id: '0001-24-1' })).toMatchObject({ upfrontM: 50, totalM: 500, sourceUrl: 'https://example.com/pr/1' });
  });
});

describe('acquisitions: asset purchase vs whole-company buyout', () => {
  const ACQ_P2 = { therapeuticArea: 'oncology', phase: 'phase2', modality: 'peptide', indication: 'prostate', dealType: 'acquisition', territory: 'global' };

  it('classifies from deal_subtype when set', () => {
    expect(classifyAcquisition({ dealType: 'acquisition', dealSubtype: 'asset_purchase', asset: 'Pracinostat', licensor: 'S*BIO Pte Ltd' })).toBe('asset');
    expect(classifyAcquisition({ dealType: 'acquisition', dealSubtype: 'asset_purchase', asset: 'pacritinib', licensor: 'S*BIO Pte Ltd' })).toBe('asset');
    expect(classifyAcquisition({ dealType: 'acquisition', dealSubtype: 'company_acquisition', asset: 'ONC201', licensor: 'Oncoceutics, Inc.' })).toBe('company');
  });

  it('treats an asset text naming the target company as a whole-company acquisition', () => {
    expect(classifyAcquisition({ dealType: 'acquisition', asset: 'Biotheus (BNT327/PM8002, PD-L1 x VEGF-A bispecific)', licensor: 'Biotheus' })).toBe('company');
    expect(classifyAcquisition({ dealType: 'acquisition', asset: 'ProfoundBio (rinatabart sesutecan / Rina-S, FRa ADC)', licensor: 'ProfoundBio' })).toBe('company');
    expect(classifyAcquisition({ dealType: 'acquisition', asset: 'Mirati Therapeutics (full company acquisition; key assets include adagrasib)', licensor: 'Mirati Therapeutics' })).toBe('company');
    expect(classifyAcquisition({ dealType: 'acquisition', asset: 'Seagen oncology portfolio (full acquisition)', licensor: 'Seagen' })).toBe('company');
  });

  it('keeps named asset sales as assets and everything else unknown', () => {
    expect(classifyAcquisition({ dealType: 'acquisition', asset: 'Atreca antibody-related assets (including APN-497444)', licensor: 'Atreca, Inc.' })).toBe('asset');
    expect(classifyAcquisition({ dealType: 'acquisition', asset: 'Bemarituzumab', licensor: 'Five Prime Therapeutics' })).toBe('unknown');
    expect(classifyAcquisition({ dealType: 'acquisition', asset: null, licensor: '2seventy bio' })).toBe('unknown');
    expect(classifyAcquisition({ dealType: 'license', asset: 'Biotheus (x)', licensor: 'Biotheus' })).toBeNull();
  });

  it('strips legal suffixes for the company-name match', () => {
    expect(coreCompanyName('S*BIO Pte Ltd')).toBe('s*bio');
    expect(coreCompanyName('Mirati Therapeutics, Inc.')).toBe('mirati');
    expect(coreCompanyName('Co')).toBe('');
  });

  it('computes the headline from asset purchases and lists whole-company buyouts after them', () => {
    const rows = [
      deal({ dealType: 'acquisition', licensor: 'Biotheus', asset: 'Biotheus (BNT327)', upfrontM: 800, announcedDate: '2024-11-13' }),
      deal({ dealType: 'acquisition', licensor: 'ProfoundBio', asset: 'ProfoundBio (Rina-S)', upfrontM: 1800, announcedDate: '2024-04-03' }),
      deal({ dealType: 'acquisition', licensor: 'S*BIO Pte Ltd', asset: 'Pracinostat', dealSubtype: 'asset_purchase', upfrontM: 0.5, announcedDate: '2012-08-09' }),
      deal({ dealType: 'acquisition', licensor: 'S*BIO Pte Ltd', asset: 'pacritinib', dealSubtype: 'asset_purchase', upfrontM: 15, announcedDate: '2012-05-01' }),
      deal({ dealType: 'acquisition', licensor: 'X Bio', asset: 'XB-1', dealSubtype: 'asset_purchase', upfrontM: 10, announcedDate: '2020-01-01' }),
      deal({ dealType: 'acquisition', licensor: 'Five Prime Therapeutics', asset: 'Bemarituzumab', upfrontM: 1900, announcedDate: '2021-03-04' }),
    ];
    const s = selectVerifiedComps(ACQ_P2, rows);
    expect(s.headlineBasis).toBe('asset_purchases');
    expect(s.assetPurchaseCount).toBe(3);
    expect(s.companyAcquisitionCount).toBe(2);
    expect(s.summary.n).toBe(3);
    expect(s.summary.medianUpfrontM).toBe(10);
    expect(s.confidenceCap).toBeNull();
    expect(s.comps.map(c => c.acquisitionKind)).toEqual(['asset', 'asset', 'asset', 'unknown', 'company', 'company']);
  });

  it('widens phase (still acquisitions) to reach 3 asset purchases', () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => deal({ dealType: 'acquisition', licensor: `Co${i}`, asset: `Co${i} (lead)`, upfrontM: 900 })),
      ...Array.from({ length: 3 }, () => deal({ dealType: 'acquisition', phase: 'phase_1', dealSubtype: 'asset_purchase', upfrontM: 12 })),
    ];
    const s = selectVerifiedComps(ACQ_P2, rows);
    expect(COMP_LADDER[s.rungIndex!].phase).toBe('adjacent');
    expect(s.headlineBasis).toBe('asset_purchases');
    expect(s.summary.medianUpfrontM).toBe(12);
  });

  it('caps confidence at Low when most acquisition comps are company buyouts', () => {
    const rows = Array.from({ length: 5 }, (_, i) => deal({ dealType: 'acquisition', licensor: `Co${i}`, asset: `Co${i} (lead)`, upfrontM: 900 }));
    const s = selectVerifiedComps(ACQ_P2, rows);
    expect(s.headlineBasis).toBe('all');
    expect(s.acquisitionNote).toMatch(/^Most of these are whole-company acquisitions/);
    expect(computeConfidence(20, { source: 'calibrated', sampleSize: 50 }, s.confidenceCap).level).toBe('low');
  });
});
