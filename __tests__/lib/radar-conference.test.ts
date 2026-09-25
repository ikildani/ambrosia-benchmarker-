/**
 * Conference detection (licensing-intent factor 3) matches whole words only.
 * The old substring test counted "cash", "accelerated" and "adaptive"
 * headlines as ASH / ACC / ADA presentations.
 */

import { mentionsConference } from '@/lib/radar/signal-detection';

describe('mentionsConference', () => {
  it('matches conference acronyms as whole words', () => {
    expect(mentionsConference('Company to present Phase 2 data at ASCO 2026')).toBe(true);
    expect(mentionsConference('Late-breaking abstract accepted for ASH annual meeting')).toBe(true);
    expect(mentionsConference('Poster presentation at AACR')).toBe(true);
    expect(mentionsConference('Presenting at BIO-Europe in Stockholm')).toBe(true);
    expect(mentionsConference('Oral presentation at (ESMO) congress')).toBe(true);
  });

  it('does not match acronyms buried inside ordinary words', () => {
    expect(mentionsConference('Company reports $120M cash position')).toBe(false);
    expect(mentionsConference('FDA grants accelerated approval')).toBe(false);
    expect(mentionsConference('Adaptive trial design announced')).toBe(false);
    expect(mentionsConference('European regulators accept filing')).toBe(false);
    expect(mentionsConference('Pharmaceutical company names new CFO')).toBe(false);
    expect(mentionsConference('Roth IRA guidance')).toBe(true); // 'roth' is a banking conference; kept on purpose
  });

  it('keeps the generic presentation cues as whole words', () => {
    expect(mentionsConference('Two posters accepted at the annual meeting')).toBe(false); // "posters" is not "poster"
    expect(mentionsConference('Poster accepted at the annual meeting')).toBe(true);
    expect(mentionsConference('Abstracts now available online')).toBe(true);
    expect(mentionsConference('Company completes abstraction of records')).toBe(false);
  });
});
