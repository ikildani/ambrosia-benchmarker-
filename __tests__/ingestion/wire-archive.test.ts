import { headlineLooksLikeDeal, monthsBetween, monthBounds, dateFromGnwUrl } from '@/lib/ingestion/wire-archive';

describe('headlineLooksLikeDeal', () => {
  it('keeps licence, collaboration, option and acquisition headlines about drugs', () => {
    expect(headlineLooksLikeDeal('Merck Enters into Exclusive Global License Agreement with SciBrunch Therapeutics for SPR2015')).toBe(true);
    expect(headlineLooksLikeDeal('Jazz Pharmaceuticals Enters Definitive Agreement with Redx Pharma to Acquire Global Rights to KRAS Inhibitor Program')).toBe(true);
    expect(headlineLooksLikeDeal('Verastem Oncology Enters Discovery and Development Collaboration with GenFleet Therapeutics')).toBe(true);
    expect(headlineLooksLikeDeal('Bayer and Kumquat Biosciences enter global exclusive license and collaboration in precision oncology')).toBe(true);
  });
  it('drops earnings, offerings, conferences and personnel releases', () => {
    expect(headlineLooksLikeDeal('Rhythm Pharmaceuticals to Report Fourth Quarter and Full Year 2023 Financial Results')).toBe(false);
    expect(headlineLooksLikeDeal('Acme Therapeutics Announces Pricing of $100 Million Public Offering')).toBe(false);
    expect(headlineLooksLikeDeal('Acme Bio to Present at the 42nd Annual J.P. Morgan Healthcare Conference')).toBe(false);
    expect(headlineLooksLikeDeal('Acme Pharma Appoints Jane Doe as Chief Medical Officer')).toBe(false);
  });
  it('drops agreement headlines with no life-science cue', () => {
    expect(headlineLooksLikeDeal('Acme Logistics Signs License Agreement for Warehouse Software')).toBe(false);
  });
});

describe('month helpers', () => {
  it('walks months newest first, inclusive', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2026-02', '2026-01', '2025-12', '2025-11']);
    expect(monthsBetween('2024-05', '2024-05')).toEqual(['2024-05']);
  });
  it('gives calendar bounds', () => {
    expect(monthBounds('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthBounds('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
  it('reads the release date from a GlobeNewswire URL', () => {
    expect(dateFromGnwUrl('https://www.globenewswire.com/news-release/2024/01/31/2821239/24226/en/orgenesis.html')).toBe('2024-01-31');
    expect(dateFromGnwUrl('https://www.globenewswire.com/search/keyword/x')).toBeNull();
  });
});

describe('PR Newswire sitemap helpers', () => {
  const { titleFromPrnUrl, prnDateFromHtml } = require('@/lib/ingestion/wire-archive');
  it('reads the headline from the release slug', () => {
    expect(titleFromPrnUrl('https://www.prnewswire.com/news-releases/abbvie-to-expand-oncology-presence-through-acquisition-of-stemcentrx-300259263.html'))
      .toBe('abbvie to expand oncology presence through acquisition of stemcentrx');
    expect(titleFromPrnUrl('https://www.prnewswire.com/news-releases/')).toBeNull();
  });
  it('reads the release date from the page meta tag', () => {
    expect(prnDateFromHtml(`<meta name='date' content="2016-04-28T07:20:00-04:00"/>`)).toBe('2016-04-28');
    expect(prnDateFromHtml('<meta name="description" content="x"/>')).toBeNull();
  });
});
