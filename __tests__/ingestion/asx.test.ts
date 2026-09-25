import { isAsxDealHeadline, idsIdFromDocumentKey, ASX_BIOTECH_CODES } from '@/lib/ingestion/exchanges/asx';

describe('ASX headline filter', () => {
  it('keeps licensing and partnering headlines', () => {
    expect(isAsxDealHeadline('Telix and ITM Join Forces: Exclusive Licence Agreement for TLX250')).toBe(true);
    expect(isAsxDealHeadline('Mesoblast enters strategic partnership with Grünenthal')).toBe(true);
    expect(isAsxDealHeadline('Neuren signs term sheet for NNZ-2591 in Japan')).toBe(true);
  });
  it('drops routine ASX paperwork', () => {
    expect(isAsxDealHeadline('Appendix 3Y Change in Director Interest-D Gill')).toBe(false);
    expect(isAsxDealHeadline('Change in substantial holding')).toBe(false);
    expect(isAsxDealHeadline('Application for quotation of securities - TLX')).toBe(false);
    expect(isAsxDealHeadline('Update - Notification of buy-back - CSL')).toBe(false);
    expect(isAsxDealHeadline('Investor Presentation - licensing strategy update')).toBe(false);
  });
});

describe('ASX documentKey', () => {
  it('extracts the idsId used by the interstitial', () => {
    expect(idsIdFromDocumentKey('2924-03140218-3A702575')).toBe('03140218');
    expect(idsIdFromDocumentKey('garbage')).toBeNull();
  });
  it('has a non-empty, de-duplicated code list', () => {
    expect(ASX_BIOTECH_CODES.length).toBeGreaterThan(20);
    expect(new Set(ASX_BIOTECH_CODES).size).toBe(ASX_BIOTECH_CODES.length);
  });
});

import { parseAsxYearPage } from '@/lib/ingestion/exchanges/asx';

describe('ASX legacy year page parser', () => {
  const html = `
<table><tr><th>Date</th><th></th><th>Headline</th></tr>
<tr><td>19/11/2024 8:22 am</td><td><img src="/images/price_sensitive.gif"></td><td><a href="/asx/statistics/displayAnnouncement.do?display=pdf&amp;idsId=02883329">Presentation to Accompany FAP-Targeting Acquisition</a> 14 pages 1.5MB</td></tr>
<tr><td>28/11/2024 8:27 am</td><td></td><td><a href="/asx/statistics/displayAnnouncement.do?display=pdf&amp;idsId=02888235">Application for quotation of securities - TLX</a> 6 pages 18.6KB</td></tr>
</table>`;
  it('parses date, idsId and headline without the size suffix', () => {
    const rows = parseAsxYearPage(html, 'tlx');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ code: 'TLX', idsId: '02883329', dateIso: '2024-11-19', headline: 'Presentation to Accompany FAP-Targeting Acquisition', isPriceSensitive: true });
    expect(rows[1].headline).toBe('Application for quotation of securities - TLX');
  });
});
