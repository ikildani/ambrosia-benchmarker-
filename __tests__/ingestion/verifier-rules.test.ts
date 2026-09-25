/**
 * Rules added Sep 25 2026 to the deal verifier and Perplexity discovery:
 *  - which flagged rows the web check re-adjudicates
 *  - which asset names sharpen the web search
 *  - query rotation for lists longer than the per-run cap
 */
import { isReverifiable, searchableAssetName } from '@/lib/ingestion/deal-verifier';
import { rotateQueries, HISTORICAL_QUERY_KEYS, withRecencyWindow } from '@/lib/ingestion/perplexity-deals';

describe('isReverifiable', () => {
  it('re-adjudicates rows flagged by the web check itself', () => {
    expect(isReverifiable('The deal exists but the announced date in the DB is 2024-10-29 and web sources say December 2024.')).toBe(true);
    expect(isReverifiable(null)).toBe(true);
    expect(isReverifiable('')).toBe(true);
  });

  it('leaves duplicate, outlier and backtest verdicts to their own jobs', () => {
    expect(isReverifiable('Potential duplicate of deal 9e5d7629 (Pfizer / Flagship). Higher-confidence version retained.')).toBe(false);
    expect(isReverifiable('Auto-flagged: outlier upfront 4.2 sigma above TA median')).toBe(false);
    expect(isReverifiable('Deal exists. | BACKTEST 2026-09-20: previously verified, now flagged')).toBe(false);
  });
});

describe('searchableAssetName', () => {
  it('keeps compound codes and brand names', () => {
    expect(searchableAssetName('NM26')).toBe('NM26');
    expect(searchableAssetName('GLPG3067')).toBe('GLPG3067');
    expect(searchableAssetName('Casgevy')).toBe('Casgevy');
  });

  it('drops bare indications and placeholders that would narrow the search wrongly', () => {
    expect(searchableAssetName('psoriasis')).toBeNull();
    expect(searchableAssetName('atopic_dermatitis')).toBeNull();
    expect(searchableAssetName(null)).toBeNull();
    expect(searchableAssetName('multi-program R&D platform collaboration for oncology and immunology')).toBeNull();
  });
});

describe('rotateQueries', () => {
  const qs = ['a', 'b', 'c', 'd', 'e'];

  it('starts at the offset and wraps', () => {
    expect(rotateQueries(qs, 0)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(rotateQueries(qs, 2)).toEqual(['c', 'd', 'e', 'a', 'b']);
    expect(rotateQueries(qs, 7)).toEqual(['c', 'd', 'e', 'a', 'b']);
    expect(rotateQueries(qs, -1)).toEqual(['e', 'a', 'b', 'c', 'd']);
    expect(rotateQueries([], 3)).toEqual([]);
  });

  it('reaches every query over successive passes with a cap of two', () => {
    const seen = new Set<string>();
    for (let pass = 0; pass < 3; pass++) rotateQueries(qs, pass * 2).slice(0, 2).forEach(q => seen.add(q));
    expect(seen.size).toBe(5);
  });
});

describe('historical query sets', () => {
  it('the preclinical set keeps its year windows', () => {
    expect(HISTORICAL_QUERY_KEYS.has('_preclinical_deals')).toBe(true);
    expect(HISTORICAL_QUERY_KEYS.has('oncology')).toBe(false);
  });

  it('the recency window still strips years for rotation sets', () => {
    const q = withRecencyWindow('Preclinical oncology deals 2019-2023 with terms', '2026-08-11', 45);
    expect(q).not.toMatch(/2019|2023/);
    expect(q).toMatch(/2026-08-11/);
  });
});
