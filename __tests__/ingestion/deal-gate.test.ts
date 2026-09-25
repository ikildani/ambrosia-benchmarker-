import { regexDealGate, gateMode } from '@/lib/ingestion/deal-gate';

describe('regexDealGate', () => {
  it('keeps a license agreement with economics', () => {
    const text = 'On September 1, 2026, Simcere Zaiming entered into an exclusive license agreement with Roche for SIM0660. Simcere is eligible to receive up to $1.53 billion including a $75 million upfront payment and tiered royalties.';
    const r = regexDealGate(text);
    expect(r.keep).toBe(true);
    expect(r.reason).toBe('regex:agreement_and_terms');
  });

  it('rejects an earnings release with no agreement language', () => {
    const text = 'Acme Therapeutics reports second quarter 2026 financial results. Revenue was $12.4 million. The company will host a conference call to discuss results at 8:30 a.m. ET.';
    const r = regexDealGate(text);
    expect(r.keep).toBe(false);
    expect(r.reason).toBe('regex:earnings_release');
  });

  it('rejects a governance-only 8-K', () => {
    const text = 'Item 5.02. On September 3, 2026 the Board approved the appointment of director Jane Doe. The annual meeting of stockholders will be held on June 5.';
    const r = regexDealGate(text);
    expect(r.keep).toBe(false);
    expect(r.reason).toBe('regex:governance_only');
  });

  it('rejects text with neither agreement nor economics', () => {
    const r = regexDealGate('The company announced topline data from its Phase 2 study showing a statistically significant improvement in the primary endpoint.');
    expect(r.keep).toBe(false);
    expect(r.reason).toBe('regex:no_agreement_terms');
  });

  it('keeps an agreement whose terms may sit deeper than the head', () => {
    const r = regexDealGate('EXCLUSIVE LICENSE AGREEMENT between Licensor and Licensee. ARTICLE 1 DEFINITIONS. 1.1 "Affiliate" means any entity controlling the party.');
    expect(r.keep).toBe(true);
    expect(r.reason).toBe('regex:agreement_no_economics');
  });

  it('keeps an earnings release that also announces a license with terms', () => {
    const text = 'Reports first-quarter results and announces exclusive license agreement with Pfizer including a $50 million upfront payment and milestone payments.';
    expect(regexDealGate(text).keep).toBe(true);
  });
});

describe('gateMode', () => {
  const prev = process.env.EXTRACTION_GATE;
  afterEach(() => { if (prev === undefined) delete process.env.EXTRACTION_GATE; else process.env.EXTRACTION_GATE = prev; });

  it('defaults to haiku', () => { delete process.env.EXTRACTION_GATE; expect(gateMode()).toBe('haiku'); });
  it('honours regex and none', () => {
    process.env.EXTRACTION_GATE = 'regex'; expect(gateMode()).toBe('regex');
    process.env.EXTRACTION_GATE = 'NONE'; expect(gateMode()).toBe('none');
  });
  it('falls back to haiku on garbage', () => { process.env.EXTRACTION_GATE = 'opus'; expect(gateMode()).toBe('haiku'); });
});
