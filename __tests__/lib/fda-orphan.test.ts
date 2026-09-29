/**
 * FDA orphan export parsing and sponsor handling (no network).
 */

import { assetNameFromDesignation, companyKey, countryCode, designationKey, parseFdaOrphanExport, sponsorLooksLikeCompany, usDateToIso } from '@/lib/ingestion/fda-orphan';

const HTML = `<table border="1">
<tr><th>Generic Name</th><th>Trade Name</th><th>Date Designated</th><th>Orphan Designation</th><th>Orphan Designation Status</th><th>Date Designation Withdrawn or Revoked</th><th>FDA Orphan Approval Status</th><th>Approved Labeled Indication</th><th>Marketing Approval Date</th><th>Exclusivity End Date</th><th>Exclusivity Protected Indication</th><th>Sponsor Company</th><th>Sponsor Address 1</th><th>Sponsor Address 2</th><th>Sponsor City</th><th>Sponsor State</th><th>Sponsor Zip</th><th>Sponsor Country</th><th>CF Grid Key</th></tr>
<tr><td>AAV-mediated anti-PROX1 gene therapy (AAV2-anti-PROX1-scFvFc)</td><td></td><td>09/23/2026</td><td>treatment of retinitis pigmentosa</td><td>Designated</td><td></td><td>Not FDA Approved for Orphan Indication</td><td></td><td></td><td></td><td></td><td>Celliaz Ltd.</td><td>1 Road</td><td></td><td>Tel Aviv</td><td></td><td></td><td>Israel</td><td>x</td></tr>
<tr><td>caffeine citrate</td><td>Cafcit</td><td>01/02/2015</td><td>treatment of apnea of prematurity</td><td>Designated/Approved</td><td></td><td>Approved for Orphan Indication</td><td>apnea of prematurity</td><td>09/21/2016</td><td>09/21/2023</td><td>apnea</td><td>Hikma Pharmaceuticals USA Inc.</td><td></td><td></td><td>Columbus</td><td>OH</td><td>43228</td><td>United States</td><td>y</td></tr>
</table>`;

describe('parseFdaOrphanExport', () => {
  it('reads rows by header name', () => {
    const rows = parseFdaOrphanExport(HTML);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ generic_name: 'AAV-mediated anti-PROX1 gene therapy (AAV2-anti-PROX1-scFvFc)', designated_at: '2026-09-23', indication: 'treatment of retinitis pigmentosa', approved_at: null, sponsor_name: 'Celliaz Ltd.', sponsor_country: 'Israel' });
    expect(rows[1]).toMatchObject({ trade_name: 'Cafcit', approved_at: '2016-09-21', sponsor_country: 'United States', approval_status: 'Approved for Orphan Indication' });
  });
  it('returns nothing for a page without the table', () => {
    expect(parseFdaOrphanExport('<html><body>Session expired</body></html>')).toEqual([]);
  });
});

describe('sponsor helpers', () => {
  it('normalises company names for matching', () => {
    expect(companyKey('Kalevala Therapeutics, Inc.')).toBe('kalevala therapeutics');
    expect(companyKey('Hikma Pharmaceuticals USA Inc.')).toBe('hikma pharmaceuticals usa');
    expect(companyKey('Celliaz Ltd.')).toBe(companyKey('CELLIAZ LIMITED'));
  });
  it('tells companies from institutions and individuals', () => {
    expect(sponsorLooksLikeCompany('Celliaz Ltd.')).toBe(true);
    expect(sponsorLooksLikeCompany('Signature Biologics')).toBe(true);
    expect(sponsorLooksLikeCompany('University of Pennsylvania')).toBe(false);
    expect(sponsorLooksLikeCompany("Children's Hospital of Philadelphia")).toBe(false);
    expect(sponsorLooksLikeCompany('John Smith, MD')).toBe(false);
  });
  it('maps countries and dates', () => {
    expect(countryCode('United States')).toBe('US');
    expect(countryCode('Israel')).toBe('IL');
    expect(countryCode('Atlantis')).toBeNull();
    expect(usDateToIso('9/3/2026')).toBe('2026-09-03');
    expect(usDateToIso('')).toBeNull();
  });
  it('names assets from the trade name or the first clause of a long generic name', () => {
    expect(assetNameFromDesignation('caffeine citrate', 'Cafcit')).toBe('Cafcit');
    expect(assetNameFromDesignation('zoldonrasib', null)).toBe('zoldonrasib');
    expect(assetNameFromDesignation('antibody drug conjugate composed of recombinant humanized anti-CDH17 IgG1 monoclonal antibody conjugated to exatecan, a DNA topoisomerase 1 inhibitor', null)).toBe('antibody drug conjugate');
    expect(assetNameFromDesignation('Allogeneic gamma delta T cells modified by messenger RNA encoding a VHH based CAR targeting HLA G', null)).toBe('Allogeneic gamma delta T cells');
  });
  it('builds a stable designation key', () => {
    const k = designationKey({ generic_name: 'Caffeine Citrate', sponsor_name: 'Hikma Pharmaceuticals USA Inc.', designated_at: '2015-01-02', indication: 'treatment of apnea of prematurity' });
    expect(k).toMatch(/^caffeinecitrate\|hikma pharmaceuticals usa\|2015-01-02\|/);
  });
});
