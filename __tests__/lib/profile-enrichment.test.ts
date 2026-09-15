import { emailDomain, isAcademicDomain, isFreeMailDomain } from '@/lib/enrichment/free-mail-domains';
import {
  apolloCompanyType,
  computeEnrichment,
  guessCompanyNameFromDomain,
  matchCompanyByDomain,
  normalizeCompanyToken,
  summarizeSource,
} from '@/lib/enrichment/profile-enrichment';
import { companyClause, firstNameFrom, salutation } from '@/lib/email/greeting';

function fakeSupabase(rows: Array<{ name: string; name_variations: string[] | null; company_type: string | null }>) {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'ilike', 'limit', 'update', 'eq', 'insert']) builder[m] = jest.fn(() => builder);
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null });
  return builder as never;
}

describe('free-mail and domain helpers', () => {
  it('classifies free-mail, academic and corporate domains', () => {
    expect(isFreeMailDomain('gmail.com')).toBe(true);
    expect(isFreeMailDomain('Hotmail.SE')).toBe(true);
    expect(isFreeMailDomain('apogeepharma.ca')).toBe(false);
    expect(isAcademicDomain('bcm.edu')).toBe(true);
    expect(isAcademicDomain('uni-muenster.de')).toBe(true);
    expect(isAcademicDomain('ucd.ie')).toBe(false);
  });

  it('extracts the domain safely', () => {
    expect(emailDomain('Jason.Zhang@HuishengVC.com')).toBe('huishengvc.com');
    expect(emailDomain('nope')).toBeNull();
    expect(emailDomain('')).toBeNull();
  });

  it('guesses a readable company name from the domain label', () => {
    expect(guessCompanyNameFromDomain('wego-solutions.com')).toBe('Wego Solutions');
    expect(guessCompanyNameFromDomain('biper-tx.com')).toBe('Biper TX');
    expect(guessCompanyNameFromDomain('apogeepharma.ca')).toBe('Apogee Pharma');
    expect(guessCompanyNameFromDomain('huishengvc.com')).toBe('Huisheng VC');
    expect(guessCompanyNameFromDomain('isomorphiclabs.com')).toBe('Isomorphic Labs');
    expect(guessCompanyNameFromDomain('eumederis.com')).toBe('Eumederis');
  });

  it('normalizes corporate suffixes for matching', () => {
    expect(normalizeCompanyToken('Apogee Pharma Inc.')).toBe('apogee');
    expect(normalizeCompanyToken('apogeepharma')).toBe('apogee');
  });
});

describe('matchCompanyByDomain', () => {
  it('matches when the normalized domain label equals the company name', async () => {
    const sb = fakeSupabase([
      { name: 'Apogee Therapeutics', name_variations: null, company_type: 'biotech' },
      { name: 'Apogee Pharma Inc', name_variations: ['Apogee Pharmaceuticals'], company_type: 'pharma_mid' },
    ]);
    const m = await matchCompanyByDomain(sb, 'apogeepharma.ca');
    expect(m?.name).toBe('Apogee Therapeutics');
  });

  it('returns null when nothing matches', async () => {
    const sb = fakeSupabase([{ name: 'Apollo Health', name_variations: null, company_type: null }]);
    expect(await matchCompanyByDomain(sb, 'apogeepharma.ca')).toBeNull();
  });
});

describe('computeEnrichment', () => {
  it('skips free-mail addresses without inventing a company', async () => {
    const r = await computeEnrichment(fakeSupabase([]), { id: 'u', email: 'someone@gmail.com' }, { apolloApiKey: null });
    expect(r.filled.company_name).toBeUndefined();
    expect(r.filled.company_domain).toBeUndefined();
    expect(r.skipped).toBe('free_mail');
  });

  it('fills domain, and falls back to a domain guess for an unmatched corporate address', async () => {
    const r = await computeEnrichment(fakeSupabase([]), { id: 'u', email: 'jaidyn@wego-solutions.com' }, { apolloApiKey: null });
    expect(r.filled.company_domain).toBe('wego-solutions.com');
    expect(r.filled.company_name).toBe('Wego Solutions');
    expect(r.sources.company_name).toBe('domain');
    expect(summarizeSource(r.sources)).toBe('domain');
  });

  it('never overwrites what the user typed', async () => {
    const r = await computeEnrichment(
      fakeSupabase([{ name: 'Huisheng', name_variations: null, company_type: 'investor_vc' }]),
      { id: 'u', email: 'ellis.yuan@huishengvc.com', full_name: 'Ellis Yuan', company_name: 'Huisheng Capital', company_type: 'investor_vc', job_title: 'Partner' },
      { apolloApiKey: null },
    );
    expect(r.skipped).toBe('complete');
    expect(r.filled).toEqual({});
  });

  it('does not treat an academic domain as a company', async () => {
    const r = await computeEnrichment(fakeSupabase([]), { id: 'u', email: 'sarah@bcm.edu' }, { apolloApiKey: null });
    expect(r.filled.company_name).toBeUndefined();
    expect(r.filled.company_domain).toBe('bcm.edu');
  });
});

describe('apolloCompanyType', () => {
  it('maps industry and headcount to the profile vocabulary', () => {
    expect(apolloCompanyType('Pharmaceuticals', 50000)).toBe('pharma_large');
    expect(apolloCompanyType('Biotechnology', 120)).toBe('biotech');
    expect(apolloCompanyType('Venture Capital & Private Equity', 20)).toBe('investor_pe');
    expect(apolloCompanyType('Management Consulting', 10)).toBe('advisor');
    expect(apolloCompanyType('Retail', 10)).toBeNull();
  });
});

describe('greeting helpers', () => {
  it('never greets with an email address', () => {
    expect(salutation('tyglesias@supradvisory.com')).toBe('Hi there,');
    expect(salutation('Mehdi Chelbi')).toBe('Hi Mehdi,');
    expect(salutation(null)).toBe('Hi there,');
    expect(firstNameFrom('  ')).toBeNull();
    expect(companyClause('BiPER Therapeutics')).toBe(' at BiPER Therapeutics');
    expect(companyClause(null)).toBe('');
  });
});
