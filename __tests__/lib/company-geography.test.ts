import {
  decideCompanyCountry, edgarAddressCountry, edgarNameMatches, isUsSubsidiaryName, nameStatedCountry, siteConsensusCountry,
} from '@/lib/radar/company-geography';

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

  // Nov 9 2026 spot-check cases
  it('does not let a single Wikidata hit override a stored country', () => {
    expect(decideCompanyCountry({ ...base, name: 'Applied Biology, Inc.', stored: 'US', storedSource: 'clinicaltrials_sweep', wikidata: 'CZ' }))
      .toMatchObject({ country: 'US', changed: false, reason: 'single_source' });
  });
  it('lets two agreeing signals override', () => {
    expect(decideCompanyCountry({ ...base, name: 'Cellectis S.A.', stored: 'US', storedSource: 'clinicaltrials_sweep', edgar: 'FR', wikidata: 'FR' }))
      .toMatchObject({ country: 'FR', changed: true, reason: 'override' });
  });
  it('still lets one signal fill a blank or replace a foreign-registry stamp', () => {
    expect(decideCompanyCountry({ ...base, name: 'Calliditas Therapeutics', wikidata: 'SE' })).toMatchObject({ country: 'SE', reason: 'filled' });
    expect(decideCompanyCountry({ ...base, name: 'Fibrogen Incorporated', stored: 'CA', storedSource: 'registry:health_canada', wikidata: 'US' }))
      .toMatchObject({ country: 'US', reason: 'override' });
  });
  it('keeps a group member out of its parent country', () => {
    expect(decideCompanyCountry({ ...base, name: 'Genentech, Inc., a Member of the Roche Group', stored: 'US', storedSource: 'fda_orphan' }))
      .toMatchObject({ country: 'US', changed: false });
    expect(decideCompanyCountry({ ...base, name: 'Sanofi US Services Inc.', stored: 'US', storedSource: 'fda_orphan' }))
      .toMatchObject({ country: 'US', changed: false });
  });
  it('uses a country stated in the name instead of clearing a registry stamp', () => {
    expect(decideCompanyCountry({ ...base, name: 'Danone Research B.V. (Netherlands)', stored: 'GB', storedSource: 'registry:isrctn' }))
      .toMatchObject({ country: 'NL', changed: true });
    expect(decideCompanyCountry({ ...base, name: 'Synairgen Research Limited (UK)', stored: 'GB', storedSource: 'registry:isrctn' }))
      .toMatchObject({ country: 'GB', changed: false, reason: 'agreed' });
    expect(decideCompanyCountry({ ...base, name: 'Alveron Pharma UK Ltd', stored: 'GB', storedSource: 'registry:isrctn' }))
      .toMatchObject({ country: 'GB', changed: false });
  });
});

describe('name helpers', () => {
  it('matches an EDGAR filer only when it is the same company', () => {
    expect(edgarNameMatches('Bicycle Health', ['BICYCLE THERAPEUTICS PLC'])).toBe(false);
    expect(edgarNameMatches('Kura Oncology', ['KURA ONCOLOGY, INC.'])).toBe(true);
    expect(edgarNameMatches('Jazz Pharmaceuticals', ['Jazz Pharmaceuticals plc'])).toBe(true);
    expect(edgarNameMatches('Acme Bio', ['Other Co', 'ACME BIO INC'])).toBe(true);
  });
  it('reads a stated country', () => {
    expect(nameStatedCountry('Vectorite Biomedica Inc. (Taiwan)')).toBe('TW');
    expect(nameStatedCountry('Oxigene (USA)')).toBe('US');
    expect(nameStatedCountry('Not applicable (company does not exist any more)')).toBeNull();
    expect(nameStatedCountry('Dalcor Pharma Ukltd, Swiss Branch')).toBeNull();
  });
  it('spots US arms of foreign groups', () => {
    expect(isUsSubsidiaryName('Knight Therapeutics (USA) Inc')).toBe(true);
    expect(isUsSubsidiaryName('Mitsubishi Tanabe Pharma Development America Inc')).toBe(true);
    expect(isUsSubsidiaryName('Opus Genetics')).toBe(false);
  });
});
