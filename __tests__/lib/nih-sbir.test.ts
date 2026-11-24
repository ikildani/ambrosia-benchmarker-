/**
 * NIH SBIR/STTR program source: code extraction rules, program shaping, schedule, dry run.
 * Fixtures are real RePORTER titles/abstract fragments (Nov 2026 sample), trimmed.
 */

jest.mock('../../lib/fetch-with-timeout', () => ({ fetchWithTimeout: jest.fn() }));

import { fetchWithTimeout } from '../../lib/fetch-with-timeout';
import {
  buildSearchBody,
  currentFiscalYear,
  displayOrgName,
  extractCodes,
  isCandidateCode,
  modalityOf,
  nihSbirDue,
  runNihSbir,
  stageOf,
  toPrograms,
  type ReporterProject,
} from '../../lib/ingestion/nih-sbir';
import { scheduledPreclinicalMode } from '../../lib/ingestion/preclinical-pipeline';

const project = (title: string, abstract = '', extra: Partial<ReporterProject> = {}): ReporterProject => ({
  appl_id: 11000001, project_num: '1R44AI167461-01', core_project_num: 'R44AI167461', project_title: title, abstract_text: abstract,
  fiscal_year: 2024, organization: { org_name: 'INHALON BIOPHARMA, INC.', org_country: 'UNITED STATES' }, ...extra,
});

describe('code extraction', () => {
  it('takes a development code from the grant title', () => {
    const codes = extractCodes(project('IND-enabling development for IN-002, an inhaled muco-trapping mAb against respiratory syncytial virus'));
    expect(codes.map(c => [c.code, c.source])).toEqual([['IN-002', 'title']]);
  });

  it('takes a repeated abstract code framed as the company\'s own candidate', () => {
    const abstract = 'We have developed MDI-2517, a novel small molecule inhibitor of PAI-1. In this Phase II SBIR we will complete IND-enabling toxicology of MDI-2517 in two species.';
    const codes = extractCodes(project('Development of a small molecule inhibitor of PAI-1 for systemic sclerosis', abstract));
    expect(codes.map(c => c.code)).toEqual(['MDI-2517']);
    expect(codes[0].quote).toMatch(/^We have developed MDI-2517/);
  });

  it('ignores a code mentioned once, targets, tool compounds and cell lines', () => {
    const abstract = 'Prior work with Y-27632 in HEK293 cells showed Hsp90 and TH17 effects; SN-38 is the active metabolite. PF-739 was used as a reference AMPK agonist. Our lead QX-11 is novel.';
    expect(extractCodes(project('Novel ROCK inhibitors for COPD therapy', abstract))).toEqual([]);
    for (const c of ['Y-27632', 'HEK293', 'Hsp90', 'TH17', 'SN-38', 'PF-739', 'IL-6', 'CD19', 'COVID-19', 'R44', 'ADAMTS13', 'Th40', 'HN001']) {
      expect(isCandidateCode(c)).toBe(false);
    }
    for (const c of ['IN-002', 'MDI-2517', 'VMT01', 'AVR-48', 'FL118', 'SHK-186', 'RGX-104']) expect(isCandidateCode(c)).toBe(true);
  });

  it('skips devices, diagnostics and non-therapeutic grants', () => {
    expect(extractCodes(project('Mobile Three-Dimensional Screening device XR-200 for Cranial Malformations'))).toEqual([]);
    expect(extractCodes(project('A survey of clinic workflows QZ-100'))).toEqual([]);
  });

  it('keeps only title codes when an abstract lists a screening campaign', () => {
    const abstract = 'Compounds AB-101, AB-102, AB-103 and AB-104 were our lead inhibitors. AB-101 AB-102 AB-103 AB-104 AB-101 AB-102 AB-103 AB-104 AB-101 AB-102 AB-103 AB-104.';
    expect(extractCodes(project('Optimization of AB-101 inhibitors', abstract)).map(c => c.code)).toEqual(['AB-101']);
  });
});

describe('program shaping', () => {
  it('reads the stage from the grant wording', () => {
    expect(stageOf('IND-enabling studies of KTX-1161')).toBe('ind_enabling');
    expect(stageOf('Phase 1 Safety, Pharmacokinetic study of AVR-48 in healthy volunteers')).toBe('phase_1');
    expect(stageOf('A Phase 2 multi-center trial of CD5 CAR T-cell therapy in patients with T-cell lymphoma')).toBe('phase_2');
    expect(stageOf('Preclinical development of OR-449', 'A Phase 1 trial in patients will follow.')).toBe('preclinical');
    expect(stageOf('Novel ROCK inhibitors', 'This Phase I SBIR will synthesize analogs; a phase II study in patients is planned')).toBe('preclinical');
    expect(stageOf('Optimizing XY-12', 'hit-to-lead chemistry')).toBe('lead_optimization');
  });

  it('builds disclosed programs with a verbatim quote and rule confidence', () => {
    const [p] = toPrograms(project('IND-enabling development for IN-002, an inhaled muco-trapping mAb against respiratory syncytial virus'));
    expect(p).toMatchObject({ program_name: 'IN-002', stage: 'ind_enabling', modality: 'antibody', confidence: 85, partnered: false });
    expect(p.evidence_quote).toContain('IN-002');
    expect(modalityOf('a novel siRNA therapeutic')).toBe('oligonucleotide');
  });

  it('formats upper-case awardee names', () => {
    expect(displayOrgName('INHALON BIOPHARMA, INC.')).toBe('Inhalon Biopharma, Inc.');
    expect(displayOrgName('Cayman Chemical Company')).toBe('Cayman Chemical Company');
  });
});

describe('schedule', () => {
  it('runs at 04 and 16 UTC while due, never displacing filings or HKEX', () => {
    const s = { pagesApproved: true, filingsBacklog: false, lean: true, nihDue: true };
    expect(scheduledPreclinicalMode(4, s)).toBe('nih');
    expect(scheduledPreclinicalMode(16, s)).toBe('nih');
    expect(scheduledPreclinicalMode(0, s)).toBe('filings');
    expect(scheduledPreclinicalMode(10, s)).toBe('hkex');
    expect(scheduledPreclinicalMode(4, { ...s, nihDue: false })).toBe('pages');
  });

  it('is due during the backfill and weekly afterwards', () => {
    const now = new Date('2026-12-01T04:25:00Z');
    expect(nihSbirDue({}, null, now)).toBe(true);
    expect(nihSbirDue({ backfill_completed_at: '2026-11-30T00:00:00Z' }, '{"fy":2026,"offset":0}', now)).toBe(true);
    expect(nihSbirDue({ backfill_completed_at: '2026-11-20T00:00:00Z', last_completed_at: '2026-11-28T00:00:00Z' }, null, now)).toBe(false);
    expect(nihSbirDue({ backfill_completed_at: '2026-11-20T00:00:00Z', last_completed_at: '2026-11-20T00:00:00Z' }, null, now)).toBe(true);
    expect(currentFiscalYear(new Date('2026-10-02T00:00:00Z'))).toBe(2027);
    expect(currentFiscalYear(new Date('2026-09-30T00:00:00Z'))).toBe(2026);
  });

  it('pins the RePORTER request', () => {
    const body = buildSearchBody(2024, 500);
    expect(body.criteria).toEqual({ activity_codes: ['R41', 'R42', 'R43', 'R44', 'U43', 'U44', 'SB1'], fiscal_years: [2024] });
    expect(body).toMatchObject({ offset: 500, limit: 500, sort_field: 'appl_id' });
  });
});

describe('dry run', () => {
  /** Chainable stand-in: every query answers with no rows. */
  function emptyClient() {
    const result = { data: [], error: null };
    const chain: Record<string, unknown> = {};
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_t, prop) {
        if (prop === 'then') return (resolve: (v: unknown) => unknown) => resolve(result);
        if (prop === 'maybeSingle' || prop === 'single') return async () => ({ data: null, error: null });
        return () => proxy;
      },
    };
    const proxy: Record<string, unknown> = new Proxy(chain, handler);
    return { from: () => proxy, rpc: async () => result } as never;
  }

  it('extracts, resolves (new company) and writes nothing', async () => {
    (fetchWithTimeout as jest.Mock).mockResolvedValueOnce(new Response(JSON.stringify({
      meta: { total: 2 },
      results: [
        project('IND-enabling development for IN-002, an inhaled muco-trapping mAb against respiratory syncytial virus'),
        project('Mobile screening app', '', { appl_id: 2, core_project_num: 'R43XX1' }),
      ],
    }), { status: 200 }));
    const r = await runNihSbir(emptyClient(), { dryRun: true, fiscalYear: 2026, now: new Date('2026-05-01T00:00:00Z'), timeBudgetMs: 60_000 });
    expect(r.projects).toBe(2);
    expect(r.projectsWithCodes).toBe(1);
    expect(r.programs).toBe(1);
    expect(r.companiesCreated).toBe(1);
    expect(r.created).toBe(0);
    expect(r.sample[0]).toMatchObject({ company: 'Inhalon Biopharma, Inc.', code: 'IN-002', url: 'https://reporter.nih.gov/project-details/11000001' });
    expect(r.done).toBe(true);
  });
});
