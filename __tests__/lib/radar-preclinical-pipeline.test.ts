/**
 * Company-disclosed preclinical programs (lib/ingestion/preclinical-pipeline.ts).
 * Pure helpers only: filing selection, paragraph extraction, verbatim quotes,
 * stage mapping, matching, row building, and the structured-output schema.
 */

import {
  ANNUAL_FORMS,
  DisclosedProgramSchema,
  FILING_ASSET_CONFIDENCE,
  buildOutputJsonSchema,
  dedupePrograms,
  extractPipelineParagraphs,
  extractPrograms,
  filingDocumentUrl,
  matchExistingAsset,
  pickPipelineFiling,
  programKeys,
  quoteIsVerbatim,
  stageToPhase,
  toDisclosureRow,
  toExistingAssetPatch,
  toNewAssetRow,
  type DisclosedProgram,
  type ExistingAsset,
  type FilingContext,
} from '@/lib/ingestion/preclinical-pipeline';
import { findUnsupportedKeywords } from '@/lib/radar/classify-prompt';
import { RADAR_PHASE_OPTIONS, RADAR_PHASE_RANK } from '@/lib/radar/vocab';
import { resolvePhaseList, defaultExclusions } from '@/lib/radar/client/filter-schema';

const CTX: FilingContext = {
  company_id: 'co-1',
  company_name: 'Acme Therapeutics, Inc.',
  form: '10-K',
  accession: '0001234567-26-000012',
  filing_date: '2026-03-02',
  url: 'https://www.sec.gov/Archives/edgar/data/1234567/000123456726000012/acme-10k.htm',
  model: 'claude-sonnet-5',
  now: new Date('2026-09-27T12:00:00Z'),
};

function program(overrides: Partial<DisclosedProgram> = {}): DisclosedProgram {
  return {
    program_name: 'ACM-201',
    aliases: [],
    stage: 'ind_enabling',
    target: 'KRAS G12D',
    target_class: 'enzyme',
    modality: 'small_molecule',
    therapeutic_area: 'oncology',
    indication_category: 'solid_tumor',
    indication_specific: 'pancreatic cancer',
    mechanism_short: 'oral KRAS G12D inhibitor',
    partnered: false,
    partner_name: null,
    evidence_quote: 'ACM-201 is our oral KRAS G12D inhibitor currently in IND-enabling studies.',
    confidence: 92,
    ...overrides,
  };
}

describe('schema', () => {
  it('uses no keywords the structured-output API rejects, and nullable enums are anyOf (a type union next to enum is a 400)', () => {
    const schema = buildOutputJsonSchema();
    expect(findUnsupportedKeywords(schema)).toEqual([]);
    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const o = node as Record<string, unknown>;
      if (Array.isArray(o.type) && 'enum' in o) throw new Error(`enum with type union at ${JSON.stringify(o).slice(0, 80)}`);
      for (const v of Object.values(o)) walk(v);
    };
    expect(() => walk(schema)).not.toThrow();
  });

  it('clips lengths, coerces unknown vocab to null and unknown stages to unknown', () => {
    const parsed = DisclosedProgramSchema.parse({
      program_name: 'x'.repeat(200),
      aliases: ['', 'ACM 201', 'acmelizumab', 'a', 'b', 'c', 'd', 'e'],
      stage: 'phase_9',
      target: null,
      target_class: 'made_up',
      modality: 'antibody',
      therapeutic_area: 'nope',
      indication_category: null,
      indication_specific: '',
      mechanism_short: 'm'.repeat(100),
      partnered: true,
      partner_name: 'Big Pharma',
      evidence_quote: 'q'.repeat(700),
      confidence: 140,
    });
    expect(parsed.program_name).toHaveLength(80);
    expect(parsed.aliases).toHaveLength(6);
    expect(parsed.stage).toBe('unknown');
    expect(parsed.target_class).toBeNull();
    expect(parsed.modality).toBe('antibody');
    expect(parsed.therapeutic_area).toBeNull();
    expect(parsed.indication_specific).toBeNull();
    expect(parsed.mechanism_short).toHaveLength(80);
    expect(parsed.evidence_quote).toHaveLength(600);
    expect(parsed.confidence).toBe(100);
  });
});

describe('filing selection', () => {
  const f = (form: string, filingDate: string, primaryDocument = 'doc.htm') => ({ accessionNumber: `${form}-${filingDate}`, form, filingDate, primaryDocument });

  it('prefers the newest annual report over a newer registration statement', () => {
    const pick = pickPipelineFiling([f('S-1', '2026-05-01'), f('10-K', '2026-03-01'), f('10-K', '2025-03-01'), f('10-Q', '2026-08-01')]);
    expect(pick?.form).toBe('10-K');
    expect(pick?.filingDate).toBe('2026-03-01');
  });

  it('falls back to S-1 / F-1 for a company with no annual report yet, and to null otherwise', () => {
    expect(pickPipelineFiling([f('S-1', '2026-05-01'), f('8-K', '2026-06-01')])?.form).toBe('S-1');
    expect(pickPipelineFiling([f('8-K', '2026-06-01'), f('10-K', '2026-03-01', '')])).toBeNull();
    expect(ANNUAL_FORMS.has('20-F')).toBe(true);
  });

  it('builds the EDGAR document URL without accession dashes', () => {
    expect(filingDocumentUrl('0001234567', { accessionNumber: '0001234567-26-000012', form: '10-K', filingDate: '2026-03-02', primaryDocument: 'acme-10k.htm' }))
      .toBe('https://www.sec.gov/Archives/edgar/data/1234567/000123456726000012/acme-10k.htm');
  });
});

describe('paragraph extraction', () => {
  const doc = [
    'PART I',
    'Item 1. Business',
    'Overview. We are a clinical-stage biopharmaceutical company.',
    'Our pipeline. ACM-101 is our lead product candidate, an anti-TL1A antibody in Phase 2 for ulcerative colitis.',
    'ACM-201 is our oral KRAS G12D inhibitor currently in IND-enabling studies; we expect to submit an IND in 2026.',
    'ACM-301 | TL1A x IL-23 bispecific | Preclinical',
    'We lease 40,000 square feet of office space in Cambridge, Massachusetts.',
    'Item 1A. Risk Factors',
    'If our product candidates such as ACM-201 fail in preclinical studies, there can be no assurance we will advance them.',
    'Our competitors, including Big Pharma with its KRAS G12C inhibitor, have greater resources.',
  ].join('\n\n');

  it('keeps pipeline paragraphs from the Business section and drops risk-factor hypotheticals and boilerplate', () => {
    const out = extractPipelineParagraphs(doc, 10);
    expect(out).toContain('Our pipeline. ACM-101 is our lead product candidate, an anti-TL1A antibody in Phase 2 for ulcerative colitis.');
    expect(out).toContain('ACM-201 is our oral KRAS G12D inhibitor currently in IND-enabling studies; we expect to submit an IND in 2026.');
    expect(out).toContain('ACM-301 | TL1A x IL-23 bispecific | Preclinical');
    expect(out.some(p => p.startsWith('If our product candidates'))).toBe(false);
    expect(out.some(p => p.startsWith('We lease'))).toBe(false);
    // Document order is preserved.
    expect(out.indexOf('ACM-301 | TL1A x IL-23 bispecific | Preclinical')).toBeGreaterThan(out.indexOf('Our pipeline. ACM-101 is our lead product candidate, an anti-TL1A antibody in Phase 2 for ulcerative colitis.'));
  });

  it('respects the paragraph and character caps', () => {
    expect(extractPipelineParagraphs(doc, 1)).toHaveLength(1);
    expect(extractPipelineParagraphs(doc, 10, 60).join('').length).toBeLessThanOrEqual(60);
  });
});

describe('verbatim quotes and stages', () => {
  it('accepts a quote after whitespace folding and rejects paraphrase', () => {
    const paras = ['ACM-201 is our oral   KRAS G12D inhibitor currently in IND-enabling studies.'];
    expect(quoteIsVerbatim('ACM-201 is our oral KRAS G12D inhibitor', paras)).toBe(true);
    expect(quoteIsVerbatim('ACM-201 is an oral KRAS inhibitor', paras)).toBe(false);
    expect(quoteIsVerbatim('ACM-201', paras)).toBe(false);
  });

  it('maps disclosed stages to phase and stage_detail', () => {
    expect(stageToPhase('discovery')).toEqual({ phase: 'preclinical', stage_detail: 'discovery' });
    expect(stageToPhase('ind_enabling')).toEqual({ phase: 'preclinical', stage_detail: 'ind_enabling' });
    expect(stageToPhase('preclinical')).toEqual({ phase: 'preclinical', stage_detail: 'preclinical' });
    expect(stageToPhase('phase_1_2')).toEqual({ phase: 'phase_1_2', stage_detail: null });
    expect(stageToPhase('approved')).toEqual({ phase: 'phase_4', stage_detail: null });
    expect(stageToPhase('discontinued')).toEqual({ phase: null, stage_detail: null });
  });
});

describe('matching and dedupe', () => {
  const existing: ExistingAsset[] = [
    { id: 'a-101', asset_name: 'ACM-101', asset_aliases: ['acmelizumab'], drug_master_id: 'dm-1', phase: 'phase_2', asset_origin: 'registry', target: null, target_class: null, moa_short: null, mechanism: null, data_sources: ['clinicaltrials'] },
    { id: 'a-old', asset_name: 'Old program', asset_aliases: [], drug_master_id: 'dm-9', phase: 'preclinical', asset_origin: 'filing', target: 'X', target_class: null, moa_short: null, mechanism: null, data_sources: ['sec_filing'] },
  ];

  it('matches by alias key, then by drug_master through drug_aliases, else none', () => {
    expect(matchExistingAsset(program({ program_name: 'Acmelizumab' }), existing, new Map()).asset?.id).toBe('a-101');
    expect(matchExistingAsset(program({ program_name: 'ACM 101' }), existing, new Map()).asset?.id).toBe('a-101');
    const viaDrug = matchExistingAsset(program({ program_name: 'Renamed', aliases: ['newcode'] }), existing, new Map([['newcode', 'dm-9']]));
    expect(viaDrug.asset?.id).toBe('a-old');
    expect(viaDrug.drug_master_id).toBe('dm-9');
    const none = matchExistingAsset(program({ program_name: 'ACM-201' }), existing, new Map([['acm201', 'dm-2']]));
    expect(none.asset).toBeNull();
    expect(none.drug_master_id).toBe('dm-2');
  });

  it('collapses duplicate programs onto the higher-confidence entry and merges aliases', () => {
    const out = dedupePrograms([
      program({ program_name: 'ACM-201', confidence: 70 }),
      program({ program_name: 'ACM 201', aliases: ['KRAS program'], confidence: 90, stage: 'preclinical' }),
      program({ program_name: 'ACM-301', confidence: 80 }),
    ]);
    expect(out).toHaveLength(2);
    const acm201 = out.find(p => programKeys(p).includes('acm201'))!;
    expect(acm201.confidence).toBe(90);
    expect(acm201.stage).toBe('preclinical');
    expect(acm201.aliases).toContain('KRAS program');
    // A spelling variant of the winner's own name is not kept as an alias (same normalized key).
    expect(acm201.aliases).not.toContain('ACM-201');
  });
});

describe('row building', () => {
  it('creates a cited preclinical asset with classification filled from the filing', () => {
    const row = toNewAssetRow(program(), CTX, 'dm-2')!;
    expect(row).toMatchObject({
      company_id: 'co-1', asset_name: 'ACM-201', phase: 'preclinical', stage_detail: 'ind_enabling',
      target: 'KRAS G12D', modality: 'small_molecule', therapeutic_area: 'oncology', moa_short: 'oral KRAS G12D inhibitor',
      partnership_status: 'unpartnered', partnership_basis: 'filing', ownership_status: 'originator', owner_type: 'industry',
      classification_status: 'classified', classification_model: 'claude-sonnet-5:filing', drug_master_id: 'dm-2', drug_resolution_status: 'resolved',
      asset_origin: 'filing', disclosure_source_type: '10-K', disclosure_url: CTX.url, disclosure_date: '2026-03-02', disclosed_last_seen_at: '2026-03-02',
      confidence_score: FILING_ASSET_CONFIDENCE, trial_count: 0, nct_ids: [], first_posted_date: '2026-03-02',
    });
    expect(row.disclosure_excerpt).toBe(program().evidence_quote);
    expect(row.ownership_evidence).toEqual({ rule: 'filing_disclosure', accession: CTX.accession, form: '10-K' });
  });

  it('records the partner when the filing says the program is partnered', () => {
    const row = toNewAssetRow(program({ partnered: true, partner_name: 'Big Pharma' }), CTX, null)!;
    expect(row.partnership_status).toBe('partnered');
    expect(row.partner_company_name).toBe('Big Pharma');
    expect(row.partnership_evidence[0]).toMatchObject({ type: 'filing', id: CTX.accession, url: CTX.url });
    expect(row.drug_resolution_status).toBe('unresolved');
  });

  it('never creates clinical-stage or discontinued assets from a filing', () => {
    expect(toNewAssetRow(program({ stage: 'phase_1' }), CTX, null)).toBeNull();
    expect(toNewAssetRow(program({ stage: 'discontinued' }), CTX, null)).toBeNull();
  });

  it('stamps an existing registry asset with the disclosure, fills empty fields only, and never changes its phase', () => {
    const a: ExistingAsset = { id: 'a-101', asset_name: 'ACM-101', asset_aliases: [], drug_master_id: null, phase: 'phase_2', asset_origin: 'registry', target: 'TL1A', target_class: null, moa_short: null, mechanism: null, data_sources: ['clinicaltrials'] };
    const patch = toExistingAssetPatch(program({ stage: 'phase_1', target: 'WRONG', target_class: 'cytokine', mechanism_short: 'anti-TL1A mAb' }), CTX, a);
    expect(patch.target).toBeUndefined();
    expect(patch.target_class).toBe('cytokine');
    expect(patch.moa_short).toBe('anti-TL1A mAb');
    expect(patch.phase).toBeUndefined();
    expect(patch).toMatchObject({ disclosure_url: CTX.url, disclosure_accession: CTX.accession, disclosed_last_seen_at: '2026-03-02' });
  });

  it('lets a filing-origin asset advance when a later filing says so, and leaves curated rows alone', () => {
    const a: ExistingAsset = { id: 'a-old', asset_name: 'ACM-201', asset_aliases: [], drug_master_id: null, phase: 'preclinical', asset_origin: 'filing', target: null, target_class: null, moa_short: null, mechanism: null, data_sources: ['sec_filing'] };
    expect(toExistingAssetPatch(program({ stage: 'phase_1' }), CTX, a)).toMatchObject({ phase: 'phase_1', stage_detail: null, target: 'KRAS G12D' });
    const curated: ExistingAsset = { ...a, data_sources: ['manual'] };
    expect(toExistingAssetPatch(program(), CTX, curated).target).toBeUndefined();
  });

  it('writes one disclosure row per program with the match outcome', () => {
    const row = toDisclosureRow(program({ stage: 'phase_2' }), CTX, null, 'unmatched_clinical');
    expect(row).toMatchObject({ company_id: 'co-1', asset_id: null, program_key: 'acm201', stage: 'phase_2', phase: 'phase_2', source_id: CTX.accession, match_status: 'unmatched_clinical', model: 'claude-sonnet-5' });
  });
});

describe('extractPrograms', () => {
  const paragraphs = [
    'ACM-201 is our oral KRAS G12D inhibitor currently in IND-enabling studies.',
    'ACM-301 is a TL1A x IL-23 bispecific antibody in discovery.',
  ];
  const reply = (programs: unknown[]) => ({
    messages: {
      create: async () => ({
        stop_reason: 'end_turn',
        usage: { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        content: [{ type: 'text', text: JSON.stringify({ programs }) }],
      }),
    },
  });

  it('keeps verbatim-cited programs, drops paraphrased ones, and counts schema failures', async () => {
    const client = reply([
      program(),
      program({ program_name: 'ACM-301', stage: 'discovery', evidence_quote: 'ACM-301 is a bispecific in discovery' }),
      { program_name: 'broken' },
    ]);
    const out = await extractPrograms(client as never, 'claude-sonnet-5', 'Acme', '10-K', '2026-03-02', paragraphs);
    expect(out.error).toBeNull();
    expect(out.programs.map(p => p.program_name)).toEqual(['ACM-201']);
    expect(out.dropped).toBe(1);
    expect(out.invalid).toBe(1);
    expect(out.usage.calls).toBe(1);
  });

  it('surfaces a truncated or refused answer as an error instead of an empty pipeline', async () => {
    const client = { messages: { create: async () => ({ stop_reason: 'max_tokens', usage: {}, content: [] }) } };
    const out = await extractPrograms(client as never, 'claude-sonnet-5', 'Acme', '10-K', '2026-03-02', paragraphs);
    expect(out.error).toMatch(/max_tokens/);
    expect(out.programs).toEqual([]);
  });
});

describe('preclinical in the shared vocabulary', () => {
  it('is the lowest phase, included by default, and excluded by a From=P1 range', () => {
    expect(RADAR_PHASE_OPTIONS[0].value).toBe('preclinical');
    expect(RADAR_PHASE_RANK.preclinical).toBe(1);
    const empty = { phase: [], phase_min: null, phase_max: null, ownership: [] };
    expect(defaultExclusions(empty).phase).toEqual(['phase_4', 'not_applicable', 'unknown']);
    expect(resolvePhaseList({ phase: [], phase_min: 'phase_1', phase_max: null })).not.toContain('preclinical');
    expect(resolvePhaseList({ phase: [], phase_min: null, phase_max: 'phase_1' })).toEqual(['preclinical', 'early_phase_1', 'phase_1']);
  });
});
