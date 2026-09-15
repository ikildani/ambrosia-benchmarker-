/**
 * The trial lifecycle copy must obey the rules from the Sep 2026 cohort
 * campaign on every track and touch, with and without the offer flags.
 */
import {
  buildTouch,
  planForToday,
  lintEmail,
  touchDue,
  pickTrack,
  isEligible,
  offersFromEnv,
  formatMoney,
  indicationSearchTerm,
  textToHtml,
  BANNED_PHRASES,
  PRICING_URL,
  type SequenceContext,
  type SequenceProfile,
  type Track,
  type Touch,
} from '@/lib/lifecycle/trial-sequence';

const NOW = new Date('2026-09-09T13:00:00.000Z');

const profile: SequenceProfile = {
  id: 'u1',
  email: 'chensu@example.com',
  fullName: 'Chensu Wang',
  tier: 'pro',
  proExpiresAt: '2026-09-14T00:00:00.000Z',
  proEngagementType: 'auto-trial',
  subscriptionStatus: 'trialing',
};

const calc = {
  therapeuticArea: 'oncology',
  indication: 'lung_nsclc',
  phase: 'phase2',
  modality: 'smallMolecule',
  dealType: 'licensing',
  createdAt: '2026-09-04T10:00:00.000Z',
};

const comps = [
  { licensorName: 'HUTCHMED', licenseeName: 'GSK', assetName: 'HMPL-A830', phaseAtSigning: 'phase_1', upfrontUsd: 110e6, totalDealValueUsd: 1.29e9, announcedDate: '2026-09-03', verified: true },
  { licensorName: 'Old Co', licenseeName: 'Big Pharma', assetName: null, phaseAtSigning: 'phase_2', upfrontUsd: 50e6, totalDealValueUsd: 900e6, announcedDate: '2024-01-01', verified: false },
];

function ctx(over: Partial<SequenceContext> = {}): SequenceContext {
  return { profile, calculations: [calc], comps, indicationDealCount: 35, offers: { terrainAccess: false, searchModule: false }, now: NOW, ...over };
}

const TRACKS: Track[] = ['active', 'zero_calc', 'winback'];
const TOUCHES: Touch[] = ['t1', 't2', 't3'];

describe('copy rules hold on every track and touch', () => {
  for (const flags of [{ terrainAccess: false, searchModule: false }, { terrainAccess: true, searchModule: true }]) {
    for (const track of TRACKS) {
      for (const touch of TOUCHES) {
        it(`${track}/${touch} terrain=${flags.terrainAccess}`, () => {
          const calcs = track === 'zero_calc' ? [] : [{ ...calc, dealType: 'codevelopment' }];
          const p = track === 'winback' ? { ...profile, proEngagementType: 'winback-sep2026' } : profile;
          const email = buildTouch(track, touch, ctx({ calculations: calcs, offers: flags, profile: p }));
          expect(lintEmail(email)).toEqual([]);
          const words = email.subject.trim().split(/\s+/).length;
          expect(words).toBeGreaterThanOrEqual(4);
          expect(words).toBeLessThanOrEqual(9);
          expect(email.subject).not.toMatch(/\$\d/);
          const lower = email.text.toLowerCase();
          for (const b of BANNED_PHRASES) expect(lower).not.toContain(b);
          expect(email.text).toMatch(/Issa Kildani\nAmbrosia Ventures$/);
          expect(email.text).not.toMatch(/\b\d+ (sessions|times|runs)\b/i);
          const urls = email.text.match(/https?:\/\/\S+/g) || [];
          if (touch === 't2') expect(urls).toHaveLength(1);
          expect(urls.length).toBeGreaterThanOrEqual(1);
          expect((email.text.match(/\$299/g) || []).length).toBeLessThanOrEqual(1);
          expect((email.text.match(/\$199/g) || []).length).toBeLessThanOrEqual(1);
          // Plain text carries raw URLs: no entities, and every deep link keeps both query parameters.
          expect(email.text).not.toMatch(/&(amp|lt|gt|quot|#\d+);/);
          for (const u of urls) {
            const parsed = new URL(u);
            if (parsed.pathname === '/calculator' && parsed.search) {
              expect(parsed.searchParams.get('therapeuticArea')).toBe('oncology');
              expect(parsed.searchParams.get('modality')).toBe('smallMolecule');
            }
          }
        });
      }
    }
  }
});

describe('active T1', () => {
  it('leads with the verified comp, deep-links the program, prices once and late', () => {
    const e = buildTouch('active', 't1', ctx());
    expect(e.subject).toBe('NSCLC Phase 2, the comp that matters');
    expect(e.text).toContain("HUTCHMED's HMPL-A830 licence to GSK at $110M upfront and $1.29B total");
    expect(e.cta).toBe('https://solidus.ambrosiaventures.co/calculator?therapeuticArea=oncology&modality=smallMolecule');
    expect(e.text).toContain('Your trial runs through Monday.');
    const priceIdx = e.text.indexOf('$299');
    expect(priceIdx).toBeGreaterThan(e.text.indexOf(e.cta));
    expect(e.text).not.toContain('Terrain');
  });

  it('prefers a verified comp over a more recent unverified one', () => {
    const e = buildTouch('active', 't1', ctx({ comps: [{ ...comps[1], announcedDate: '2026-09-08', verified: false }, comps[0]] }));
    expect(e.text).toContain('HUTCHMED');
  });

  it('falls back to a disclosed-deal count, then to an honest no-comps line, with a subject to match', () => {
    const withCount = buildTouch('active', 't1', ctx({ comps: [], indicationDealCount: 35 }));
    expect(withCount.text).toContain('NSCLC has 35 deals with disclosed terms');
    expect(withCount.subject).toBe('NSCLC Phase 2: what buyers actually quote');
    const none = buildTouch('active', 't1', ctx({ comps: [], indicationDealCount: 0, calculations: [{ ...calc, indication: 'tbi', therapeuticArea: 'neurology' }] }));
    expect(none.text).toContain('has no disclosed licence with terms in the last decade');
    expect(none.subject).toBe('traumatic brain injury Phase 2: what buyers actually quote');
    // T2 replies to whichever T1 subject was used.
    expect(buildTouch('active', 't2', ctx({ comps: [], indicationDealCount: 0 })).subject).toBe('re: NSCLC Phase 2: what buyers actually quote');
  });

  it('adds the Terrain close only when the flag is on, and never in the subject', () => {
    const e = buildTouch('active', 't1', ctx({ offers: { terrainAccess: true, searchModule: false } }));
    expect(e.text).toContain('60 days of Terrain');
    expect(e.text).toContain('by Sep 14');
    expect(e.subject).not.toContain('Terrain');
  });

  it('mentions the Search module only for buyer-side runs when the flag is on', () => {
    const seller = buildTouch('active', 't1', ctx({ offers: { terrainAccess: false, searchModule: true } }));
    expect(seller.text).not.toContain('Search and Evaluation');
    const buyer = buildTouch('active', 't1', ctx({ offers: { terrainAccess: false, searchModule: true }, calculations: [{ ...calc, dealType: 'codevelopment' }] }));
    expect(buyer.text).toContain('Search and Evaluation');
  });

  it('names the scope honestly when the comp only matched the therapeutic area', () => {
    const e = buildTouch('active', 't1', ctx({ compsScope: 'ta', calculations: [{ ...calc, therapeuticArea: 'neurology', indication: 'ms' }] }));
    expect(e.text).toContain('The most recent disclosed neurology comp is');
    expect(e.text).not.toContain('disclosed multiple sclerosis comp');
  });

  it('phrases acquisitions from the buyer side and handles possessives', () => {
    const e = buildTouch('active', 't1', ctx({ comps: [{ licensorName: 'Neurona Therapeutics', licenseeName: 'UCB', assetName: 'NRTX-1001', phaseAtSigning: 'acquisition', upfrontUsd: 650e6, totalDealValueUsd: 1.15e9, announcedDate: '2026-06-01', verified: true }] }));
    expect(e.text).toContain("UCB's acquisition of Neurona Therapeutics for NRTX-1001 at $650M upfront and $1.15B total");
    const e2 = buildTouch('active', 't1', ctx({ comps: [{ licensorName: 'Immatics', licenseeName: 'Bayer', assetName: null, phaseAtSigning: 'phase_1', upfrontUsd: 55e6, totalDealValueUsd: null, announcedDate: '2026-06-01', verified: true }] }));
    expect(e2.text).toContain("Immatics' licence to Bayer at $55M upfront.");
  });

  it('greets without a name when the profile has none', () => {
    const e = buildTouch('active', 't1', ctx({ profile: { ...profile, fullName: null } }));
    expect(e.text.startsWith('Hello,')).toBe(true);
  });
});

describe('plain-text and HTML alternatives', () => {
  it('keeps a raw ampersand in the text body and escapes only the HTML twin', () => {
    const e = buildTouch('active', 't1', ctx());
    expect(e.text).toContain('therapeuticArea=oncology&modality=smallMolecule');
    expect(e.text).not.toContain('&amp;');
    const html = textToHtml(e.text);
    expect(html).toContain('href="https://solidus.ambrosiaventures.co/calculator?therapeuticArea=oncology&amp;modality=smallMolecule"');
    expect(html).not.toMatch(/href="[^"]*[^;]&modality/);
  });
  it('lint rejects a text body carrying an HTML entity', () => {
    const bad = { track: 'active' as const, touch: 't1' as const, subject: 'a b c d', text: 'x https://solidus.ambrosiaventures.co/calculator?a=1&amp;b=2', cta: '' };
    expect(lintEmail(bad)).toContain('html entity in plain-text body');
  });
});

describe('day-of and post-expiry touches', () => {
  it('T2 is one line, one pricing link', () => {
    const e = buildTouch('active', 't2', ctx());
    expect(e.text).toContain('Trial closes today.');
    expect(e.text.match(/https?:\/\/\S+/g)).toEqual([PRICING_URL]);
  });
  it('T3 says the work is intact and does not push', () => {
    const e = buildTouch('active', 't3', ctx());
    expect(e.text).toContain('Everything you built is intact.');
    expect(e.text.toLowerCase()).not.toContain('today');
  });
});

describe('zero-calc and win-back tracks', () => {
  it('zero-calc T1 offers to build the benchmark and never claims a fact', () => {
    const e = buildTouch('zero_calc', 't1', ctx({ calculations: [] }));
    expect(e.subject).toBe('let me build your first benchmark');
    expect(e.text).toContain('Reply with the indication, the stage and the modality');
    expect(e.text).not.toContain('HUTCHMED');
  });
  it('win-back T1 reopens access and dates the change to their last run', () => {
    const e = buildTouch('winback', 't1', ctx({ profile: { ...profile, proEngagementType: 'winback-sep2026' }, calculations: [{ ...calc, createdAt: '2026-05-22T00:00:00.000Z' }] }));
    expect(e.subject).toBe('NSCLC terms have moved since May');
    expect(e.text).toContain('I have reopened Pro on your account for seven days, no card.');
  });
  it('win-back with no comps uses a subject that matches the fallback body', () => {
    const wb = { ...profile, proEngagementType: 'winback-sep2026' };
    const e = buildTouch('winback', 't1', ctx({ profile: wb, comps: [], indicationDealCount: 0 }));
    expect(e.subject).toBe('NSCLC: what buyers actually quote');
    expect(e.text).not.toContain('set has grown');
    expect(e.text).not.toContain('terms have moved');
    expect(e.text).toContain('Partner matching now shows buyer intent');
    expect(buildTouch('winback', 't2', ctx({ profile: wb, comps: [], indicationDealCount: 0 })).subject).toBe('re: NSCLC: what buyers actually quote');
  });
  it('win-back T2 names the closing weekday', () => {
    const e = buildTouch('winback', 't2', ctx({ profile: { ...profile, proEngagementType: 'winback-sep2026', proExpiresAt: '2026-09-16T03:00:00.000Z' } }));
    expect(e.text).toContain('closes Wednesday');
  });
});

describe('scheduling', () => {
  const at = (iso: string) => ({ ...profile, proExpiresAt: iso });
  it('active: T1 five days out, T2 day-of, T3 three days after, nothing otherwise', () => {
    expect(touchDue(at('2026-09-14T00:00:00Z'), 'active', NOW)).toBe('t1');
    expect(touchDue(at('2026-09-09T20:00:00Z'), 'active', NOW)).toBe('t2');
    expect(touchDue(at('2026-09-06T00:00:00Z'), 'active', NOW)).toBe('t3');
    expect(touchDue(at('2026-09-20T00:00:00Z'), 'active', NOW)).toBeNull();
    expect(touchDue(at('2026-08-01T00:00:00Z'), 'active', NOW)).toBeNull();
  });
  it('win-back: T1 on the reopen day, T2 two days before close', () => {
    expect(touchDue(at('2026-09-16T00:00:00Z'), 'winback', NOW)).toBe('t1');
    expect(touchDue(at('2026-09-11T00:00:00Z'), 'winback', NOW)).toBe('t2');
  });
  it('picks the track from engagement type and calculations', () => {
    expect(pickTrack(profile, [calc])).toBe('active');
    expect(pickTrack(profile, [])).toBe('zero_calc');
    expect(pickTrack({ ...profile, proEngagementType: 'winback-sep2026' }, [])).toBe('winback');
  });
  it('excludes paying, portfolio, internal and complimentary accounts', () => {
    expect(isEligible(profile)).toBe(true);
    expect(isEligible({ ...profile, subscriptionStatus: 'active' })).toBe(false);
    expect(isEligible({ ...profile, tier: 'portfolio' })).toBe(false);
    expect(isEligible({ ...profile, proEngagementType: 'internal_team' })).toBe(false);
    expect(isEligible({ ...profile, proEngagementType: 'complimentary' })).toBe(false);
    expect(isEligible({ ...profile, proExpiresAt: null })).toBe(false);
  });
  it('planForToday returns null when nothing is due and an email when it is', () => {
    expect(planForToday(ctx({ profile: at('2026-09-25T00:00:00Z') }))).toBeNull();
    expect(planForToday(ctx())?.touch).toBe('t1');
  });
});

describe('helpers', () => {
  it('reads offer flags from the environment, default off', () => {
    expect(offersFromEnv({} as NodeJS.ProcessEnv)).toEqual({ terrainAccess: false, searchModule: false });
    expect(offersFromEnv({ TRIAL_OFFER_TERRAIN: '1', TRIAL_OFFER_SEARCH_MODULE: 'true' } as unknown as NodeJS.ProcessEnv)).toEqual({ terrainAccess: true, searchModule: true });
  });
  it('maps abbreviation keys to searchable terms and rejects stubs', () => {
    expect(indicationSearchTerm('ms')).toBe('multiple sclerosis');
    expect(indicationSearchTerm('lung_nsclc')).toBe('lung');
    expect(indicationSearchTerm('schizophrenia')).toBe('schizophrenia');
    expect(indicationSearchTerm('tb')).toBeNull();
    expect(indicationSearchTerm(null)).toBeNull();
  });
  it('formats money the way the emails do', () => {
    expect(formatMoney(110e6)).toBe('$110M');
    expect(formatMoney(1.29e9)).toBe('$1.29B');
    expect(formatMoney(7.1e9)).toBe('$7.1B');
    expect(formatMoney(0)).toBeNull();
  });
  it('lint catches a usage count and a discount', () => {
    const bad = { track: 'active' as const, touch: 't1' as const, subject: 'a b c d', text: 'You opened Solidus four times. 20% off. https://x.y', cta: 'https://x.y' };
    const v = lintEmail(bad);
    expect(v.some(x => x.includes('usage count'))).toBe(true);
    expect(v.some(x => x.includes('banned phrase: % off'))).toBe(true);
  });
});
