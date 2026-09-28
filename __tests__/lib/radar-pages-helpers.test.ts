/**
 * Pure helpers behind the Radar section pages: sub-nav section resolution,
 * alert rule descriptions, mandate match tab membership, catalyst day counts.
 */

import { sectionForPath, RADAR_SECTIONS } from '@/components/radar/RadarSubNav';
import { describeRule } from '@/components/radar/alerts/AlertRuleForm';
import { eventTitle } from '@/components/radar/alerts/AlertInbox';
import { matchInTab } from '@/components/radar/mandates/MandateMatchesPage';
import { daysUntil } from '@/components/radar/watchlist/UpcomingCatalysts';

describe('sectionForPath', () => {
  it('maps every section path and nests briefs and mandates under the feed', () => {
    for (const s of RADAR_SECTIONS) expect(sectionForPath(s.href)).toBe(s.key);
    expect(sectionForPath('/radar/0b8f6a3e-1111-4222-8333-444455556666')).toBe('feed');
    expect(sectionForPath('/radar/mandates/0b8f6a3e-1111-4222-8333-444455556666')).toBe('feed');
    expect(sectionForPath('/radar/watchlist/')).toBe('watchlist');
    expect(sectionForPath(null)).toBe('feed');
  });
});

describe('describeRule', () => {
  const base = { id: 'r', channel: 'in_app' as const, is_active: true, created_at: '2026-09-28' };
  it('names the pinned asset off the brief and says "any watched asset" when unpinned', () => {
    const pinned = { ...base, kind: 'score_threshold', config: { asset_id: 'a1', threshold: 70, direction: 'above' } };
    expect(describeRule(pinned, { assetNames: { a1: 'ABC-123' } })).toBe('Score crosses above 70 · ABC-123');
    expect(describeRule(pinned, { onAssetPage: true })).toBe('Score crosses above 70');
    expect(describeRule({ ...base, kind: 'partnership_change', config: {} })).toBe('Partnership status changes · any watched asset');
  });
  it('describes watchlist activity and mandate digests', () => {
    expect(describeRule({ ...base, kind: 'watchlist_activity', config: { min_delta: 8 } })).toBe('Score moves ≥ 8 pts on a watched asset');
    expect(describeRule({ ...base, kind: 'mandate_digest', config: { mandate_id: 'm1' } }, { mandateNames: { m1: 'JP oncology' } })).toBe('Digest for “JP oncology”');
    expect(describeRule({ ...base, kind: 'mandate_digest', config: {} })).toBe('Digest for every active mandate');
    expect(describeRule({ ...base, kind: 'catalyst_upcoming', config: { asset_id: 'a9', days_ahead: 45 } })).toBe('Catalyst within 45 days · one asset');
  });
});

describe('eventTitle', () => {
  const ev = { id: 'e', kind: 'score_threshold', channel: 'in_app', asset_id: null, mandate_id: null, sent_at: '', delivery_status: null, read_at: null };
  it('prefers the payload title, then the digest summary, then the kind', () => {
    expect(eventTitle({ ...ev, payload: { title: 'ABC crossed 70' } })).toBe('ABC crossed 70');
    expect(eventTitle({ ...ev, kind: 'mandate_digest', payload: { digest: { mandate_name: 'KR rights', total_new: 4 } } })).toBe('4 new matches for “KR rights”');
    expect(eventTitle({ ...ev, kind: 'partnership_change', payload: {} })).toBe('partnership change');
  });
});

describe('matchInTab', () => {
  it('new = unread and live; saved = flagged; all = live plus saved stale', () => {
    const live = { is_read: false, is_saved: false, is_stale: false };
    const readLive = { is_read: true, is_saved: false, is_stale: false };
    const staleSaved = { is_read: true, is_saved: true, is_stale: true };
    const staleUnread = { is_read: false, is_saved: false, is_stale: true };
    expect(matchInTab(live, 'new')).toBe(true);
    expect(matchInTab(readLive, 'new')).toBe(false);
    expect(matchInTab(staleUnread, 'new')).toBe(false);
    expect(matchInTab(staleSaved, 'saved')).toBe(true);
    expect(matchInTab(staleSaved, 'all')).toBe(true);
    expect(matchInTab(staleUnread, 'all')).toBe(false);
    expect(matchInTab(readLive, 'all')).toBe(true);
  });
});

describe('daysUntil', () => {
  it('counts whole UTC days from today', () => {
    const now = new Date('2026-09-28T23:30:00Z');
    expect(daysUntil('2026-09-28', now)).toBe(0);
    expect(daysUntil('2026-10-05', now)).toBe(7);
    expect(daysUntil('2026-09-20', now)).toBe(-8);
  });
});
