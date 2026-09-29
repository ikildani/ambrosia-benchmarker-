/**
 * Pipeline-page source: discovery validation, page text handling, chart
 * evidence rule, and the shared persist context carrying origin
 * 'pipeline_page' into new asset rows.
 */

import { isBlockedHost, normalizeUrl, parseDiscoveryText, registrableDomain, validateDiscovery } from '@/lib/ingestion/company-websites';
import { looksLikePipelinePage, pageAccession, pageContext, pageQuoteAcceptable, pipelineTextParagraphs, PIPELINE_LINK_RE } from '@/lib/ingestion/pipeline-pages';
import { toNewAssetRow, toDisclosureRow, contextOrigin, type DisclosedProgram } from '@/lib/ingestion/preclinical-pipeline';

describe('website discovery validation', () => {
  it('normalises URLs and strips tracking', () => {
    expect(normalizeUrl('acme-bio.com/')).toBe('https://acme-bio.com/');
    expect(normalizeUrl('http://www.acme.co.uk/pipeline?utm_source=x#top')).toBe('https://www.acme.co.uk/pipeline');
    expect(normalizeUrl('not a url')).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
  });
  it('rejects aggregators, registries and newswires', () => {
    expect(isBlockedHost('www.linkedin.com')).toBe(true);
    expect(isBlockedHost('clinicaltrials.gov')).toBe(true);
    expect(isBlockedHost('acme-bio.com')).toBe(false);
    expect(validateDiscovery({ website: 'https://www.crunchbase.com/organization/acme', confidence: 90 }).website_url).toBeNull();
  });
  it('keeps the pipeline page only on the same registrable domain', () => {
    expect(registrableDomain('www.acme.co.jp')).toBe('acme.co.jp');
    expect(registrableDomain('ir.acme-bio.com')).toBe('acme-bio.com');
    const ok = validateDiscovery({ website: 'https://acme-bio.com', pipeline: 'https://www.acme-bio.com/science/pipeline', confidence: 88, note: 'oncology' });
    expect(ok).toEqual({ website_url: 'https://acme-bio.com/', pipeline_url: 'https://www.acme-bio.com/science/pipeline', confidence: 88, note: 'oncology' });
    const cross = validateDiscovery({ website: 'https://acme-bio.com', pipeline: 'https://globenewswire.com/acme-pipeline' });
    expect(cross.pipeline_url).toBeNull();
    expect(cross.website_url).toBe('https://acme-bio.com/');
  });
  it('parses the JSON on the last line of the answer', () => {
    const text = 'I searched and found the site.\n{"website": "https://acme-bio.com", "pipeline": null, "confidence": 80, "note": "private, Basel"}';
    expect(parseDiscoveryText(text)).toEqual({ website: 'https://acme-bio.com', pipeline: null, confidence: 80, note: 'private, Basel' });
    expect(parseDiscoveryText('no idea')).toBeNull();
  });
});

describe('pipeline page text', () => {
  it('splits visible text into deduplicated paragraphs', () => {
    const text = 'Pipeline\n\nABC-123 · KRAS G12D · NSCLC · Preclinical\nABC-123 · KRAS G12D · NSCLC · Preclinical\nx\nOur discovery engine is proprietary.';
    expect(pipelineTextParagraphs(text)).toEqual(['ABC-123 · KRAS G12D · NSCLC · Preclinical', 'Our discovery engine is proprietary.']);
  });
  it('recognises a pipeline page by stage words and program codes', () => {
    expect(looksLikePipelinePage('Discovery Preclinical Phase 1 Phase 2\nABC-123 KRAS\nXYZ-9 TL1A')).toBe(true);
    expect(looksLikePipelinePage('About us. We are a company. Contact.')).toBe(false);
    expect(PIPELINE_LINK_RE.test('Our Pipeline')).toBe(true);
    expect(PIPELINE_LINK_RE.test('パイプライン')).toBe(true);
    expect(PIPELINE_LINK_RE.test('Careers')).toBe(false);
  });
  it('accepts verbatim quotes and chart labels, rejects paraphrase', () => {
    const paras = ['ABC-123 is our lead KRAS G12D inhibitor, currently in IND-enabling studies.'];
    expect(pageQuoteAcceptable('ABC-123 is our lead KRAS G12D inhibitor, currently in IND-enabling studies.', paras)).toBe(true);
    expect(pageQuoteAcceptable('[chart] ABC-123 · KRAS G12D · Preclinical', paras)).toBe(true);
    expect(pageQuoteAcceptable('[chart] ', paras)).toBe(false);
    expect(pageQuoteAcceptable('ABC-123 is in IND-enabling studies', paras)).toBe(false);
  });
});

describe('pipeline page context → asset rows', () => {
  const now = new Date('2026-09-28T15:00:00Z');
  const ctx = pageContext({ id: 'c1', name: 'Acme Bio' }, 'https://acme-bio.com/pipeline', now);
  const program: DisclosedProgram = {
    program_name: 'ABC-123', aliases: [], stage: 'ind_enabling', target: 'KRAS G12D', target_class: 'enzyme', modality: 'small_molecule',
    therapeutic_area: 'oncology', indication_category: null, indication_specific: 'NSCLC', mechanism_short: 'oral KRAS G12D inhibitor',
    partnered: false, partner_name: null, evidence_quote: '[chart] ABC-123 · KRAS G12D · IND-enabling', confidence: 75,
  };
  it('stamps origin, accession and disclosure fields for a pipeline-page row', () => {
    expect(contextOrigin(ctx)).toBe('pipeline_page');
    expect(ctx.form).toBe('pipeline_page');
    expect(ctx.accession).toBe(pageAccession('https://acme-bio.com/pipeline', now.toISOString()));
    expect(ctx.accession).toMatch(/^page:[0-9a-f]{12}:2026-09-28$/);
    const row = toNewAssetRow(program, ctx, null)!;
    expect(row.asset_origin).toBe('pipeline_page');
    expect(row.partnership_basis).toBe('pipeline_page');
    expect(row.ownership_evidence.rule).toBe('pipeline_page_disclosure');
    expect(row.data_sources).toEqual(['pipeline_page']);
    expect(row.classification_evidence.reason).toBe('pipeline_page_extraction');
    expect(row.phase).toBe('preclinical');
    expect(row.stage_detail).toBe('ind_enabling');
    expect(row.disclosure_url).toBe('https://acme-bio.com/pipeline');
    expect(row.disclosure_excerpt).toBe('[chart] ABC-123 · KRAS G12D · IND-enabling');
    expect(toDisclosureRow(program, ctx, 'a1', 'created').source_type).toBe('pipeline_page');
  });
  it('filing rows are unchanged', () => {
    const filing = { ...ctx, origin: undefined, form: '10-K', accession: '0001-24' };
    const row = toNewAssetRow(program, filing, null)!;
    expect(row.asset_origin).toBe('filing');
    expect(row.ownership_evidence.rule).toBe('filing_disclosure');
    expect(row.data_sources).toEqual(['sec_filing']);
  });
});

import { distinctiveTokens, domainMatchesCompany, domainsFromContacts, guessDomains } from '@/lib/ingestion/company-websites';
import { extractProgramsHeuristic, programNameFromLine, stageFromText } from '@/lib/ingestion/pipeline-pages';

describe('free discovery helpers', () => {
  it('keeps distinctive name tokens', () => {
    expect(distinctiveTokens('Kalevala Therapeutics, Inc.')).toEqual(['kalevala']);
    expect(distinctiveTokens('Jiangsu Hengrui Pharmaceuticals Co., Ltd.')).toEqual(['jiangsu', 'hengrui']);
  });
  it('accepts contact domains that look like the company and drops free mail and CROs', () => {
    expect(domainsFromContacts('Akeso', ['clinicaltrials@akesobio.com', 'pm@iqvia.com', 'x@gmail.com'])).toEqual(['akesobio.com']);
    expect(domainsFromContacts('Kalevala Therapeutics, Inc.', ['info@kalevalatx.com'])).toEqual(['kalevalatx.com']);
    expect(domainsFromContacts('Kalevala Therapeutics', ['info@someothercro.com'])).toEqual([]);
    expect(domainMatchesCompany('hengrui.com', 'Jiangsu Hengrui Pharmaceuticals')).toBe(true);
  });
  it('guesses plausible domains from the name', () => {
    const g = guessDomains('Kalevala Therapeutics, Inc.');
    expect(g).toContain('kalevala.com');
    expect(g).toContain('kalevalatherapeutics.com');
    expect(g).toContain('kalevalatx.com');
    expect(g.length).toBeLessThanOrEqual(18);
  });
});

describe('rule-based pipeline extraction', () => {
  it('reads stage words including sub-phases', () => {
    expect(stageFromText('ABC-123 · NSCLC · Phase 1/2')).toBe('phase_1_2');
    expect(stageFromText('IND-enabling studies ongoing')).toBe('ind_enabling');
    expect(stageFromText('Preclinical')).toBe('preclinical');
    expect(stageFromText('Phase II')).toBe('phase_2');
    expect(stageFromText('Our team')).toBeNull();
  });
  it('names programs by code, INN or leading segment', () => {
    expect(programNameFromLine('ABC-123 · KRAS G12D · NSCLC · Preclinical')).toEqual({ name: 'ABC-123', kind: 'code' });
    expect(programNameFromLine('zilovertamab vedotin | ROR1 | Phase 2')).toEqual({ name: 'zilovertamab', kind: 'inn' });
    expect(programNameFromLine('Anti-TL1A program – ulcerative colitis – Discovery')).toEqual({ name: 'Anti-TL1A program', kind: 'segment' });
    expect(programNameFromLine('Phase 2 – something')).toBeNull();
  });
  it('turns pipeline rows into programs and skips navigation text', () => {
    const paras = [
      'Pipeline',
      'ABC-123 · KRAS G12D inhibitor · NSCLC · IND-enabling',
      'XYZ-9\tanti-TL1A antibody\tulcerative colitis\tPreclinical\tpartnered with Big Pharma Inc',
      'Read more about our Phase 2 results in the newsroom',
      'Cookie settings · Privacy · Phase 1',
      'ABC-123 · KRAS G12D inhibitor · pancreatic cancer · IND-enabling',
    ];
    const out = extractProgramsHeuristic(paras);
    expect(out.map(p => [p.program_name, p.stage, p.modality, p.indication_specific, p.partnered])).toEqual([
      ['ABC-123', 'ind_enabling', 'small_molecule', 'KRAS G12D inhibitor', false],
      ['XYZ-9', 'preclinical', 'antibody', 'anti-TL1A antibody', true],
    ]);
    expect(out[1].partner_name).toBe('Big Pharma Inc');
    expect(out[0].evidence_quote).toBe('ABC-123 · KRAS G12D inhibitor · NSCLC · IND-enabling');
    expect(out[0].confidence).toBe(62);
  });
});
