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
