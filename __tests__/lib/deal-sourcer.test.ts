/**
 * lib/ingestion/deal-sourcer — the decision rule that attaches a citation.
 * Pure function; no network.
 */
import { decideSource, SOURCE_MIN_CONFIDENCE, type SourceMatch } from '@/lib/ingestion/deal-sourcer';
import { extractCitationUrls } from '@/lib/ingestion/deal-verifier';

const deal = { licensor_name: 'Arrowhead Pharmaceuticals', licensee_name: 'Janssen' };
const good: SourceMatch = {
  exists: true, confidence: 92, licensor_match: true, licensee_match: true,
  asset_match: true, headline_match: true, best_source_url: null,
  corrected_value: null, corrected_date: null, reason: 'press release matches',
};
const pr = 'https://ir.arrowheadpharma.com/news-releases/2018/arrowhead-janssen-hbv';
const trade = 'https://www.fiercebiotech.com/biotech/arrowhead-janssen-hbv-deal';

describe('decideSource', () => {
  it('attaches the press-release citation when everything matches', () => {
    const d = decideSource(good, [trade, pr], deal);
    expect(d.action).toBe('source');
    if (d.action === 'source') {
      expect(d.url).toBe(pr);
      expect(d.sourceType).toBe('press_release');
      expect(d.provenanceTier).toBe('B');
    }
  });

  it('uses the matcher\'s named primary source when it came from the citation list', () => {
    const d = decideSource({ ...good, best_source_url: trade }, [pr, trade], deal);
    expect(d.action).toBe('source');
    if (d.action === 'source') { expect(d.url).toBe(trade); expect(d.path).toBe('matcher'); expect(d.provenanceTier).toBe('C'); }
  });

  it('ignores a best_source_url the search never returned', () => {
    const d = decideSource({ ...good, best_source_url: 'https://evil.example/fake' }, [pr], deal);
    expect(d.action).toBe('source');
    if (d.action === 'source') expect(d.url).toBe(pr);
  });

  it('never falls back to an arbitrary first-https link', () => {
    const d = decideSource({ ...good, best_source_url: null }, ['https://www.forbes.com/some-story'], deal);
    expect(d.action).toBe('skip');
  });

  it('skips when the deal is not confirmed to exist', () => {
    expect(decideSource({ ...good, exists: false }, [pr], deal)).toEqual({ action: 'skip', why: expect.stringContaining('no evidence') });
  });

  it('skips below the confidence floor', () => {
    const d = decideSource({ ...good, confidence: SOURCE_MIN_CONFIDENCE - 1 }, [pr], deal);
    expect(d.action).toBe('skip');
  });

  it('skips when either party does not match', () => {
    expect(decideSource({ ...good, licensee_match: false }, [pr], deal).action).toBe('skip');
    expect(decideSource({ ...good, licensor_match: false }, [pr], deal).action).toBe('skip');
  });

  it('skips when neither the asset nor a headline term matches', () => {
    expect(decideSource({ ...good, asset_match: false, headline_match: false }, [pr], deal).action).toBe('skip');
  });

  it('accepts a headline match even when the asset name is absent', () => {
    expect(decideSource({ ...good, asset_match: false, headline_match: true }, [pr], deal).action).toBe('source');
  });

  it('skips when the search produced no usable URL', () => {
    expect(decideSource(good, [], deal).action).toBe('skip');
  });
});

describe('extractCitationUrls (Responses API shapes)', () => {
  it('reads the search_results output item the fast-search preset returns', () => {
    const body = {
      output: [
        { type: 'search_results', results: [{ url: 'https://www.takeda.com/newsroom/2019/shire' }, { url: 'https://www.forbes.com/x' }] },
        { type: 'message', content: [{ type: 'output_text', text: 'Takeda completed...', annotations: [] }] },
      ],
    };
    expect(extractCitationUrls(body)).toEqual(['https://www.takeda.com/newsroom/2019/shire', 'https://www.forbes.com/x']);
  });

  it('still reads url_citation annotations and chat-completions citations', () => {
    expect(extractCitationUrls({ citations: ['https://a.example/1'] })).toEqual(['https://a.example/1']);
    expect(extractCitationUrls({ output: [{ type: 'message', content: [{ annotations: [{ type: 'url_citation', url: 'https://b.example/2' }] }] }] })).toEqual(['https://b.example/2']);
  });
});
