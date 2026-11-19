/**
 * Preclinical at scale: program identity (port of migration 187), identifier
 * matching, cross-company code guard decisions, the filer walk order, the
 * scheduled mode, and the server-side pipeline-page helpers (robots.txt,
 * HTML lines with stage hints, link ranking, site identity, locate flow,
 * text-only verbatim rule). Fixtures only, no network.
 */

import {
  assetIdentifiers,
  cleanProgramAssetName,
  identifierSpellings,
  programIdentifiers,
} from '@/lib/ingestion/program-identity';
import {
  decideProgram,
  matchExistingAsset,
  orderFilingQueue,
  scheduledPreclinicalMode,
  storedContext,
  storedToProgram,
  toNewAssetRow,
  type DisclosedProgram,
  type ExistingAsset,
  type FilingContext,
} from '@/lib/ingestion/preclinical-pipeline';
import {
  batchCustomId,
  extractLinks,
  htmlToPageLines,
  htmlToPipelineParagraphs,
  locatePipelinePageHttp,
  needsBrowserRender,
  parseRobots,
  rankPipelineLinks,
  robotsAllows,
  siteBelongsToCompany,
  companyNameCore,
  pageMentionsCompany,
  BOT_TOKEN,
  type FetchedPage,
} from '@/lib/ingestion/pipeline-pages-http';
import { PIPELINE_PAGE_TEXT_SYSTEM, buildPageRequestParams, parsePageResponse } from '@/lib/ingestion/pipeline-pages';
import { backlogPlan, backlogBlocked } from '@/lib/ai/spend-guard';

function program(over: Partial<DisclosedProgram> = {}): DisclosedProgram {
  return {
    program_name: 'ACM-201', aliases: [], stage: 'ind_enabling', target: 'TL1A', target_class: 'cytokine', modality: 'antibody',
    therapeutic_area: 'immunology', indication_category: null, indication_specific: 'ulcerative colitis', mechanism_short: 'anti-TL1A antibody',
    partnered: false, partner_name: null, evidence_quote: 'ACM-201 is in IND-enabling studies.', confidence: 92, ...over,
  };
}

function asset(over: Partial<ExistingAsset>): ExistingAsset {
  return { id: 'x', asset_name: 'X', asset_aliases: [], drug_master_id: null, phase: 'phase_1', asset_origin: 'registry', target: null, target_class: null, moa_short: null, mechanism: null, data_sources: ['clinicaltrials'], ...over };
}

const CTX: FilingContext = { company_id: 'co-1', company_name: 'Acme Bio', form: 'pipeline_page', accession: 'page:abc:2026-11-18', filing_date: '2026-11-18', url: 'https://acme.bio/pipeline', model: 'claude-sonnet-5', now: new Date('2026-11-18T00:00:00Z'), origin: 'pipeline_page' };

describe('program identity (port of radar_asset_identifiers)', () => {
  it('reads codes and INNs in order, normalized', () => {
    expect(assetIdentifiers('Investigational drug: HLX37 dose1')).toEqual(['HLX37']);
    expect(assetIdentifiers('MK-3475 + docetaxel')).toEqual(['MK3475', 'DOCETAXEL']);
    expect(assetIdentifiers('BI 10773 tablets')).toEqual(['BI10773']);
    expect(assetIdentifiers('4D-150')).toEqual(['4D150']);
    expect(assetIdentifiers('Ivonescimab (AK112)')).toEqual(['IVONESCIMAB', 'AK112']);
    expect(assetIdentifiers('mRNA-3927')).toEqual(['MRNA3927']);
  });
  it('ignores targets, units and generic words', () => {
    expect(assetIdentifiers('CD19 CAR-T')).toEqual([]);
    expect(assetIdentifiers('IL-23 antibody program')).toEqual([]);
    expect(assetIdentifiers('KRAS G12D inhibitor')).toEqual([]);
    expect(assetIdentifiers('oligonucleotide peptide')).toEqual([]);
  });
  it('builds clean asset names that carry the identifier', () => {
    expect(cleanProgramAssetName({ program_name: 'ACM-201', aliases: [] })).toBe('ACM-201');
    expect(cleanProgramAssetName({ program_name: 'TL1A antibody', aliases: ['ACM 201'] })).toBe('TL1A antibody (ACM 201)');
    expect(cleanProgramAssetName({ program_name: 'KRAS G12D degrader', aliases: [] })).toBe('KRAS G12D degrader');
    expect(cleanProgramAssetName({ program_name: 'AdoXLongTM Sema', aliases: [] })).toBe('AdoXLong Sema');
    expect(cleanProgramAssetName({ program_name: 'AdOral® Sema', aliases: [] })).toBe('AdOral Sema');
    expect(programIdentifiers({ program_name: 'Acmelimab', aliases: ['ACM-201', 'ACM201'] })).toEqual(['ACMELIMAB', 'ACM201']);
    expect(identifierSpellings('HLX37')).toEqual(['HLX37', 'HLX-37', 'HLX 37']);
  });
});

describe('identifier matching and the cross-company code guard', () => {
  const existing = [
    asset({ id: 'r-1', asset_name: 'HLX37 dose1' }),
    asset({ id: 'r-2', asset_name: 'AK112, docetaxel' }),
    asset({ id: 'r-3', asset_name: 'JS207 + pembrolizumab' }),
  ];
  it('matches a registry arm carrying the same code', () => {
    const m = matchExistingAsset(program({ program_name: 'HLX37', stage: 'phase_1' }), existing, new Map());
    expect(m.asset?.id).toBe('r-1');
    expect(m.via).toBe('identifier');
    expect(matchExistingAsset(program({ program_name: 'Ivonescimab', aliases: ['AK112'] }), existing, new Map()).asset?.id).toBe('r-2');
  });
  it('does not match a combination program to its parent drug through a model alias', () => {
    const rows = [asset({ id: 'p-1', asset_name: 'ALDP001 Nasal Spray' })];
    expect(matchExistingAsset(program({ program_name: 'ALDP021', aliases: ['ALDP001'] }), rows, new Map()).asset).toBeNull();
  });
  it('never matches on a background INN deep in an arm name', () => {
    expect(matchExistingAsset(program({ program_name: 'Pembrolizumab' }), existing, new Map()).asset).toBeNull();
  });
  it('creates an unmatched preclinical program, refuses one whose code another company owns', () => {
    const create = decideProgram(program({ program_name: 'ACM-301' }), existing, new Map(), new Map());
    expect(create.decision).toMatchObject({ action: 'create', asset_name: 'ACM-301' });
    const foreign = decideProgram(program({ program_name: 'RG6327' }), existing, new Map(), new Map([['RG6327', 'Genentech/Roche']]));
    expect(foreign.decision).toMatchObject({ action: 'skip_foreign_code', foreign_owner: 'Genentech/Roche' });
  });
  it('keeps low-confidence and placeholder programs out of the universe', () => {
    expect(decideProgram(program({ program_name: 'ACM-302', confidence: 40 }), [], new Map(), new Map()).decision.action).toBe('skip_low_confidence');
    expect(decideProgram(program({ program_name: 'Other oncology programs' }), [], new Map(), new Map()).decision.action).toBe('skip_placeholder');
    for (const bucket of ['EMP-CNS', 'EMP-I&I', 'EMP-MSK', 'Sortilin [SORT1] Delivery System']) {
      expect(decideProgram(program({ program_name: bucket }), [], new Map(), new Map()).decision.action).toBe('skip_placeholder');
    }
    expect(decideProgram(program({ program_name: 'EMP-012' }), [], new Map(), new Map()).decision.action).toBe('create');
  });
  it('creates a clinical program only opt-in, with a code nobody has, at high confidence', () => {
    const p = program({ program_name: 'CK-089', stage: 'phase_1', confidence: 90 });
    expect(decideProgram(p, [], new Map(), new Map()).decision.action).toBe('unmatched_clinical');
    const opt = decideProgram(p, [], new Map(), new Map(), { createUnknownClinical: true });
    expect(opt).toMatchObject({ allowClinical: true, decision: { action: 'create' } });
    expect(decideProgram(program({ program_name: 'TL1A antibody', stage: 'phase_1' }), [], new Map(), new Map(), { createUnknownClinical: true }).decision.action).toBe('unmatched_clinical');
    expect(decideProgram(program({ program_name: 'CK-090', stage: 'approved' }), [], new Map(), new Map(), { createUnknownClinical: true }).decision.action).toBe('unmatched_clinical');
    for (const name of ['QUILT-88 pancreatic cancer program', 'ANKTIVA + CPI in pancreatic cancer (QUILT-88)']) {
      expect(decideProgram(program({ program_name: name, stage: 'phase_2', confidence: 95 }), [], new Map(), new Map(), { createUnknownClinical: true }).decision.action).toBe('unmatched_clinical');
    }
    expect(decideProgram(program({ program_name: 'Deudomperidone (CIN-102)', stage: 'phase_2', confidence: 95 }), [], new Map(), new Map(), { createUnknownClinical: true }).decision.action).toBe('create');
    const row = toNewAssetRow(p, CTX, null, { allowClinical: true })!;
    expect(row).toMatchObject({ phase: 'phase_1', stage_detail: null, asset_origin: 'pipeline_page', disclosure_excerpt: p.evidence_quote });
    expect(toNewAssetRow(p, CTX, null)).toBeNull();
  });
});

describe('filer walk', () => {
  const rows = [
    { id: 'a', name: 'Pfizer', cik: '0000078003', active_trials_count: 900 },
    { id: 'b', name: 'Pfizer Oncology', cik: '78003', active_trials_count: 5 },
    { id: 'c', name: 'Small Bio', cik: '0001111111', active_trials_count: 3 },
    { id: 'd', name: 'Read Bio', cik: '0002222222', active_trials_count: 50 },
    { id: 'e', name: 'Read Two', cik: '0003333333', active_trials_count: 1 },
  ];
  it('keeps one row per CIK, unread filers first (busiest first), read filers rotated after the cursor', () => {
    const order = orderFilingQueue(rows, { d: 'acc-1', e: 'acc-2' }, 'd').map(r => r.id);
    expect(order).toEqual(['a', 'c', 'e', 'd']);
  });
  it('keeps the CIK row already read so its accession is not re-extracted under another row', () => {
    expect(orderFilingQueue(rows, { b: 'acc-9' }, null).map(r => r.id)).toEqual(['d', 'c', 'e', 'b']);
  });
});

describe('scheduled mode', () => {
  it('filings every 6 h, HKEX at 10, pages in the other slots only once approved', () => {
    expect(scheduledPreclinicalMode(0, { pagesApproved: true, filingsBacklog: false, lean: true })).toBe('filings');
    expect(scheduledPreclinicalMode(10, { pagesApproved: false, filingsBacklog: false, lean: true })).toBe('hkex');
    expect(scheduledPreclinicalMode(2, { pagesApproved: true, filingsBacklog: false, lean: true })).toBe('pages');
    expect(scheduledPreclinicalMode(2, { pagesApproved: false, filingsBacklog: false, lean: true })).toBeNull();
    expect(scheduledPreclinicalMode(2, { pagesApproved: false, filingsBacklog: true, lean: true })).toBe('filings');
  });
  it('the pages allowance is off until set, then a backlog source of its own', () => {
    const off = backlogPlan({} as unknown as NodeJS.ProcessEnv);
    expect(backlogBlocked('preclinical-pages', {}, 0, off)).toMatch(/not a backlog source/);
    const on = backlogPlan({ AI_BACKLOG_PRECLINICAL_PAGES_USD: '300' } as unknown as NodeJS.ProcessEnv);
    expect(on.totalUsd).toBe(405);
    expect(backlogBlocked('preclinical-pages', { 'asset-classify': 40, 'pipeline-pages': 35, 'preclinical-pipeline': 12, 'hkex-pipeline': 15 }, 0, on)).toBeNull();
  });
});

describe('robots.txt', () => {
  const txt = `
# comment
User-agent: *
Disallow: /private
Allow: /private/pipeline$
Disallow: /*.pdf$

User-agent: BadBot
User-agent: SolidusPipelineBot
Disallow: /science
`;
  const groups = parseRobots(txt);
  it('applies the group naming the bot, else *', () => {
    expect(robotsAllows(groups, BOT_TOKEN, '/science/pipeline')).toBe(false);
    expect(robotsAllows(groups, BOT_TOKEN, '/private/x')).toBe(true);
    expect(robotsAllows(groups, 'OtherBot/1.0', '/private/x')).toBe(false);
    expect(robotsAllows(groups, 'OtherBot/1.0', '/private/pipeline')).toBe(true);
    expect(robotsAllows(groups, 'OtherBot/1.0', '/files/a.pdf')).toBe(false);
    expect(robotsAllows(groups, 'OtherBot/1.0', '/pipeline')).toBe(true);
  });
  it('allows everything with no rules or an empty Disallow', () => {
    expect(robotsAllows([], BOT_TOKEN, '/anything')).toBe(true);
    expect(robotsAllows(parseRobots('User-agent: *\nDisallow:'), BOT_TOKEN, '/pipeline')).toBe(true);
    expect(robotsAllows(parseRobots('User-agent: *\nDisallow: /'), BOT_TOKEN, '/pipeline')).toBe(false);
  });
});

const PIPELINE_HTML = `<html><head><title>Pipeline</title><script>var x = "<td>ignored</td>";</script></head><body>
<nav><a href="/about">About</a><a href="/pipeline">Pipeline</a></nav>
<h1>Our Pipeline</h1>
<table>
<tr><th>Program</th><th>Target</th><th>Indication</th><th>Stage</th></tr>
<tr><td>ACM-101</td><td>TL1A</td><td>Ulcerative colitis</td><td><div class="bar phase-2"></div></td></tr>
<tr><td>ACM-201</td><td>IL-23p19</td><td>Psoriasis</td><td>Preclinical</td></tr>
</table>
<div class="pipeline-row"><span>ACM-301</span><span>KRAS G12D degrader &amp; more</span><div class="stage ind-enabling"></div></div>
<footer>© 2026 Acme Bio. All rights reserved.</footer>
</body></html>`;

describe('HTML to pipeline lines', () => {
  it('joins table cells, appends stage hints from markup, drops scripts, nav and footer', () => {
    const lines = htmlToPageLines(PIPELINE_HTML);
    expect(lines).toContain('ACM-101 · TL1A · Ulcerative colitis · [stage hint: phase 2]');
    expect(lines).toContain('ACM-201 · IL-23p19 · Psoriasis · Preclinical');
    expect(lines.some(l => l.startsWith('ACM-301') && l.includes('KRAS G12D degrader & more') && l.includes('[stage hint: ind enabling]'))).toBe(true);
    expect(lines.join('\n')).not.toMatch(/ignored|All rights reserved|About/);
    expect(htmlToPipelineParagraphs(PIPELINE_HTML).length).toBeGreaterThan(3);
  });
  it('flags app shells for the browser crawler', () => {
    expect(needsBrowserRender('<div id="__next"></div><script src="/app.js"></script>', '')).toBe(true);
    expect(needsBrowserRender(PIPELINE_HTML, 'x'.repeat(500))).toBe(false);
  });
});

describe('pipeline links and site identity', () => {
  const home = `<a href="/about-us">About</a><a href="https://acme.bio/science/pipeline/">Our Pipeline</a>
    <a href="/news/pipeline-update">Pipeline update</a><a href="https://other.com/pipeline">Partner pipeline</a>
    <a href="/research">Research &amp; Development</a><a href="mailto:x@acme.bio">Mail</a><a href="/files/pipeline.pdf">PDF</a>`;
  it('ranks same-site pipeline links, skipping news, PDFs and other sites', () => {
    const links = extractLinks(home, 'https://www.acme.bio/');
    expect(rankPipelineLinks(links, 'https://www.acme.bio/')).toEqual(['https://acme.bio/science/pipeline/', 'https://www.acme.bio/research']);
  });
  it('never reads aggregator or registry hosts as a company site', () => {
    expect(siteBelongsToCompany('https://www.linkedin.com/company/acme')).toBe(false);
    expect(siteBelongsToCompany('https://acme.bio/')).toBe(true);
    expect(siteBelongsToCompany('not a url')).toBe(false);
  });
  it('requires a guessed site to name the company on its homepage', () => {
    expect(companyNameCore('Nested Therapeutics, Inc')).toBe('nested therapeutics');
    expect(companyNameCore('Standard Chem. & Pharm. Co., Ltd.')).toBe('standard chem pharm');
    expect(pageMentionsCompany('<title>Boston.com</title><p>Boston news and sports</p>', 'Boston Therapeutics')).toBe(false);
    expect(pageMentionsCompany('<footer>© 2026 Nested Therapeutics, Inc.</footer>', 'Nested Therapeutics, Inc')).toBe(true);
    expect(pageMentionsCompany('<p>Roger is here</p>', 'Roger')).toBe(false);
  });
  it('builds unique short batch ids', () => {
    expect(batchCustomId('8c1d0a2e-0000-4000-8000-123456789abc', 7)).toBe('p7-8c1d0a2e000040008000123456789abc');
    expect(batchCustomId('8c1d0a2e-0000-4000-8000-123456789abc', 7).length).toBeLessThanOrEqual(64);
  });
});

describe('locating a pipeline page politely', () => {
  function fakeSite(pages: Record<string, { status?: number; html: string }>) {
    const calls: string[] = [];
    const fetcher = async (url: string): Promise<FetchedPage | null> => {
      calls.push(url);
      const p = pages[url];
      if (!p) return { url, status: 404, html: '' };
      return { url, status: p.status ?? 200, html: p.html };
    };
    return { calls, fetcher };
  }
  it('follows the homepage pipeline link and stops there', async () => {
    const site = fakeSite({
      'https://acme.bio/robots.txt': { html: 'User-agent: *\nDisallow: /admin' },
      'https://acme.bio/': { html: '<a href="/our-science/pipeline">Pipeline</a>' },
      'https://acme.bio/our-science/pipeline': { html: PIPELINE_HTML },
    });
    const out = await locatePipelinePageHttp({ website_url: 'https://acme.bio/' }, site.fetcher, 0);
    expect(out.kind).toBe('found');
    expect(site.calls).toEqual(['https://acme.bio/robots.txt', 'https://acme.bio/', 'https://acme.bio/our-science/pipeline']);
  });
  it('honors robots.txt and caps requests per site', async () => {
    const blocked = fakeSite({ 'https://acme.bio/robots.txt': { html: 'User-agent: *\nDisallow: /' } });
    expect((await locatePipelinePageHttp({ website_url: 'https://acme.bio/' }, blocked.fetcher, 0)).kind).toBe('robots_blocked');
    expect(blocked.calls).toHaveLength(1);
    const empty = fakeSite({ 'https://acme.bio/': { html: '<p>' + 'Welcome to Acme. '.repeat(40) + '</p>' } });
    const out = await locatePipelinePageHttp({ website_url: 'https://acme.bio/' }, empty.fetcher, 0);
    expect(out.kind).toBe('no_pipeline_page');
    expect(empty.calls.length).toBeLessThanOrEqual(6);
  });
  it('reads a searched site without the name check, a guessed one only when its homepage names the company', async () => {
    const roche = fakeSite({ 'https://www.roche.com/': { html: '<a href="/pipeline">Pipeline</a><p>' + 'Roche is a global healthcare company. '.repeat(20) + '</p>' }, 'https://www.roche.com/pipeline': { html: PIPELINE_HTML } });
    expect((await locatePipelinePageHttp({ website_url: 'https://www.roche.com/', name: 'N-Gene Research Laboratories, Inc.', website_source: 'domain_guess' }, roche.fetcher, 0)).kind).toBe('site_mismatch');
    expect((await locatePipelinePageHttp({ website_url: 'https://www.roche.com/', name: 'Genentech', website_source: 'web_search' }, roche.fetcher, 0)).kind).toBe('found');
  });
  it('stops at the homepage when a guessed domain belongs to someone else', async () => {
    const other = fakeSite({ 'https://www.boston.com/': { html: '<a href="/pipeline">Pipeline</a><p>' + 'Boston news, sports and weather. '.repeat(30) + '</p>' } });
    const out = await locatePipelinePageHttp({ website_url: 'https://www.boston.com/', name: 'Boston Therapeutics', website_source: 'domain_guess' }, other.fetcher, 0);
    expect(out.kind).toBe('site_mismatch');
    expect(other.calls).toEqual(['https://www.boston.com/robots.txt', 'https://www.boston.com/']);
  });
  it('hands browser-only pages to the Playwright crawler', async () => {
    const shell = fakeSite({ 'https://acme.bio/': { html: '<div id="root"></div><script src="/main.js"></script>' } });
    expect((await locatePipelinePageHttp({ website_url: 'https://acme.bio/' }, shell.fetcher, 0)).kind).toBe('needs_render');
  });
});

describe('text-only extraction keeps the verbatim rule', () => {
  const paragraphs = htmlToPipelineParagraphs(PIPELINE_HTML);
  const reply = (programs: unknown[]) => ({ stop_reason: 'end_turn' as const, content: [{ type: 'text' as const, text: JSON.stringify({ programs }), citations: null }] });
  it('uses the text system prompt without a screenshot', () => {
    const params = buildPageRequestParams('Acme Bio', 'https://acme.bio/pipeline', '2026-11-18', paragraphs, null);
    expect((params.system as Array<{ text: string }>)[0].text).toBe(PIPELINE_PAGE_TEXT_SYSTEM);
    expect(PIPELINE_PAGE_TEXT_SYSTEM).toMatch(/no screenshot/);
    expect(PIPELINE_PAGE_TEXT_SYSTEM).not.toMatch(/when available, a screenshot/);
  });
  it('accepts verbatim quotes and rejects chart labels and paraphrases', () => {
    const base = { aliases: [], target: null, target_class: null, modality: null, therapeutic_area: null, indication_category: null, indication_specific: null, mechanism_short: null, partnered: false, partner_name: null, confidence: 90 };
    const out = parsePageResponse(reply([
      { ...base, program_name: 'ACM-201', stage: 'preclinical', evidence_quote: 'ACM-201 · IL-23p19 · Psoriasis · Preclinical' },
      { ...base, program_name: 'ACM-401', stage: 'discovery', evidence_quote: '[chart] ACM-401 · Discovery' },
      { ...base, program_name: 'ACM-501', stage: 'discovery', evidence_quote: 'ACM-501 is our discovery program for fibrosis.' },
      { ...base, program_name: 'IL-23 franchise program', stage: 'preclinical', evidence_quote: 'ACM-201 · IL-23p19 · Psoriasis · Preclinical' },
    ]) as never, paragraphs, false);
    expect(out.programs.map(p => p.program_name)).toEqual(['ACM-201']);
    expect(out.dropped).toBe(3);
  });
});

describe('replaying recorded disclosures', () => {
  const stored = {
    id: 'd-1', company_id: 'co-9', program_name: 'GTB-3650', aliases: null, stage: 'phase_1', target: null, target_class: null, modality: null,
    therapeutic_area: null, indication_category: null, indication_specific: 'AML', mechanism_short: null, partnered: null, partner_name: null,
    source_type: 'hkex_annual_report', source_id: 'news-1', source_url: 'https://www1.hkexnews.hk/a.pdf', disclosed_at: '2026-04-20T00:00:00Z',
    excerpt: 'GTB-3650 entered a Phase 1 trial.', confidence: 90, model: 'claude-sonnet-5',
  };
  it('rebuilds the program and the context it was recorded under', () => {
    expect(storedToProgram(stored)).toMatchObject({ program_name: 'GTB-3650', aliases: [], stage: 'phase_1', evidence_quote: 'GTB-3650 entered a Phase 1 trial.', partnered: false });
    expect(storedContext(stored, 'GT Biopharma', new Date('2026-11-18T00:00:00Z'))).toMatchObject({ form: 'hkex_annual_report', accession: 'news-1', filing_date: '2026-04-20', origin: 'filing', dataSource: 'hkex_filing' });
    expect(storedToProgram({ ...stored, stage: 'weird' }).stage).toBe('unknown');
  });
});
