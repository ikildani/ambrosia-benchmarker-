import { decideCompanyCountry, edgarAddressCountry, siteConsensusCountry } from '@/lib/radar/company-geography';

describe('edgarAddressCountry', () => {
  it('reads a US state code as the US, not the country with that ISO code', () => {
    // Kura Oncology: San Diego, stateOrCountry "CA", isForeignLocation null
    expect(edgarAddressCountry({ stateOrCountry: 'CA', stateOrCountryDescription: 'CA' })).toBe('US');
  });
  it('reads foreign addresses from the country description', () => {
    expect(edgarAddressCountry({ stateOrCountry: 'F4', stateOrCountryDescription: 'CHINA' })).toBe('CN');
    expect(edgarAddressCountry({ stateOrCountry: 'X0', stateOrCountryDescription: 'UNITED KINGDOM' })).toBe('GB');
  });
  it('returns null without an address', () => {
    expect(edgarAddressCountry(null)).toBeNull();
  });
});

describe('siteConsensusCountry', () => {
  it('needs three sites and a clear majority', () => {
    expect(siteConsensusCountry([{ iso: 'DE', n: 2 }])).toBeNull();
    expect(siteConsensusCountry([{ iso: 'DE', n: 3 }])).toBe('DE');
    expect(siteConsensusCountry([{ iso: 'DE', n: 8 }, { iso: 'FR', n: 2 }])).toBe('DE');
    expect(siteConsensusCountry([{ iso: 'DE', n: 6 }, { iso: 'FR', n: 4 }])).toBeNull();
  });
  it('never trusts Australia or New Zealand alone (foreign Phase 1 sites)', () => {
    expect(siteConsensusCountry([{ iso: 'AU', n: 12 }])).toBeNull();
  });
});

const base = { stored: null, storedSource: null, edgar: null, wikidata: null, sites: [] };

describe('decideCompanyCountry', () => {
  it('overrides a stored country when an independent signal disagrees uncontested', () => {
    const d = decideCompanyCountry({ ...base, name: 'Kura Oncology, Inc.', stored: 'CA', storedSource: 'registry:health_canada', edgar: 'US' });
    expect(d).toMatchObject({ country: 'US', changed: true, reason: 'override', basis: ['sec_edgar'] });
  });
  it('keeps the stored country when the signals agree with it', () => {
    expect(decideCompanyCountry({ ...base, name: 'Acme Bio', stored: 'US', edgar: 'US' })).toMatchObject({ changed: false, reason: 'agreed' });
  });
  it('leaves a tie alone', () => {
    const d = decideCompanyCountry({ ...base, name: 'Acme Bio', stored: 'US', edgar: 'US', wikidata: 'DK' });
    expect(d).toMatchObject({ country: 'US', changed: false, reason: 'contested' });
  });
  it('fills a missing country', () => {
    expect(decideCompanyCountry({ ...base, name: 'Acme Bio', wikidata: 'JP' })).toMatchObject({ country: 'JP', changed: true, reason: 'filled' });
  });
  it('clears a foreign-registry stamp with no other evidence', () => {
    expect(decideCompanyCountry({ ...base, name: 'Acme Bio', stored: 'GB', storedSource: 'registry:isrctn' }))
      .toMatchObject({ country: null, changed: true, reason: 'cleared' });
  });
  it('keeps a domestic-registry or sweep country with no other evidence', () => {
    expect(decideCompanyCountry({ ...base, name: 'Acme Bio', stored: 'CN', storedSource: 'registry:cde' })).toMatchObject({ changed: false, reason: 'kept' });
  });
});
