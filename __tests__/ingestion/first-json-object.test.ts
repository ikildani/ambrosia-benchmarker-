import { firstJsonObject } from '@/lib/ingestion/press-releases';

describe('firstJsonObject', () => {
  it('returns the first complete object when notes with braces follow', () => {
    const t = '{"licensor":"NextCure","licensee":"Avere","deal_type":"acquisition"}\n\nNote: the {merger} closes in Q4.';
    expect(JSON.parse(firstJsonObject(t)!)).toEqual({ licensor: 'NextCure', licensee: 'Avere', deal_type: 'acquisition' });
  });
  it('takes the first of two objects', () => {
    const t = '{"a":1}\n{"b":2}';
    expect(firstJsonObject(t)).toBe('{"a":1}');
  });
  it('ignores braces and escaped quotes inside strings', () => {
    const t = 'Here: {"notes":"uses {x} and \\"quoted\\" text","n":{"m":1}} trailing';
    expect(JSON.parse(firstJsonObject(t)!)).toEqual({ notes: 'uses {x} and "quoted" text', n: { m: 1 } });
  });
  it('returns null when there is no complete object', () => {
    expect(firstJsonObject('no json here')).toBeNull();
    expect(firstJsonObject('{"a":1')).toBeNull();
  });
});
