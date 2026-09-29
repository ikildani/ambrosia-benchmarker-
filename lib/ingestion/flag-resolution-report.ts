/**
 * Slack report of flagged deals and how each was resolved.
 *
 * Why (Issa, Sep 29 2026): "whenever you flag a deal for review through Slack you are
 * automatically resolving it; I shouldn't have to review it. I just want to see deals
 * that were flagged by our system and what you did to resolve it." The verification
 * cron used to post "N Deals Flagged for Review". It now hands every flagged deal to the
 * flag-fixer in the same run and posts one line per deal: why it was flagged, then the
 * action taken. No line asks for a decision.
 */
import type { FixOutcome } from './flag-fixer';

const SITE = 'https://solidus.ambrosiaventures.co';

function shortUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `<${url}|${u.hostname.replace(/^www\./, '')}>`;
  } catch {
    return url;
  }
}

function trim(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** One mrkdwn line per outcome: flagged because X → action. */
export function describeOutcome(o: FixOutcome): string {
  const head = `*${trim(o.label, 90)}*\n   _Flagged:_ ${trim(o.flaggedBecause, 180)}`;
  switch (o.kind) {
    case 'fixed':
      return `${head}\n   _Resolved:_ :white_check_mark: corrected and verified from ${shortUrl(o.url)}${o.diff.length ? ` (${trim(o.diff.join('; '), 200)})` : ' (record matched the source)'}`;
    case 'duplicate':
      return `${head}\n   _Resolved:_ :link: retired as a duplicate of <${SITE}/admin/deals/${o.keeperId}|${o.keeperId.slice(0, 8)}>, which already holds this deal with a primary citation`;
    case 'rejected':
      return `${head}\n   _Resolved:_ :no_entry: rejected, ${trim(o.reason, 180)}; removed from every count`;
    case 'unresolved':
      return `${head}\n   _Resolved:_ :hourglass_flowing_sand: held out of every count; ${trim(o.reason, 140)}. Attempt ${o.attempt} of 3; retries ${o.retryOn}, rejected automatically if still unsourced`;
  }
}

export interface FlagResolutionSummary {
  outcomes: FixOutcome[];
  /** Flagged this run but not reached inside the time budget; the hourly fixer takes them next. */
  queued: Array<{ label: string; reason: string }>;
  errors: string[];
}

/** Slack attachments + fallback text, or null when there is nothing to report. */
export function buildFlagResolutionSlack(s: FlagResolutionSummary): { text: string; attachments: Array<{ color: string; blocks: object[] }> } | null {
  if (s.outcomes.length === 0 && s.queued.length === 0) return null;
  const n = (k: FixOutcome['kind']) => s.outcomes.filter(o => o.kind === k).length;
  const summary = `Corrected ${n('fixed')} · Duplicates retired ${n('duplicate')} · Rejected ${n('rejected')} · Held out of counts ${n('unresolved')}${s.queued.length ? ` · Next fixer run ${s.queued.length}` : ''}`;
  const blocks: object[] = [
    { type: 'header', text: { type: 'plain_text', text: `Flagged deals, resolved automatically (${s.outcomes.length + s.queued.length})`, emoji: true } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: summary }] },
  ];
  // Slack caps a section at 3,000 characters; chunk the lines.
  let chunk = '';
  for (const line of s.outcomes.map(describeOutcome)) {
    if (chunk.length + line.length + 2 > 2800) { blocks.push({ type: 'section', text: { type: 'mrkdwn', text: chunk } }); chunk = ''; }
    chunk += (chunk ? '\n\n' : '') + line;
  }
  for (const q of s.queued) {
    const line = `*${trim(q.label, 90)}*\n   _Flagged:_ ${trim(q.reason, 180)}\n   _Resolved:_ :hourglass_flowing_sand: held out of every count; the fixer resolves it on its next run (within the hour)`;
    if (chunk.length + line.length + 2 > 2800) { blocks.push({ type: 'section', text: { type: 'mrkdwn', text: chunk } }); chunk = ''; }
    chunk += (chunk ? '\n\n' : '') + line;
  }
  if (chunk) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: chunk } });
  if (s.errors.length) blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `Fixer errors (retried next run): ${trim(s.errors.slice(0, 3).join(' | '), 400)}` }] });
  // Slack allows 50 blocks per message.
  const capped = blocks.slice(0, 48);
  const allResolved = s.outcomes.every(o => o.kind !== 'unresolved') && s.queued.length === 0;
  return {
    text: `Flagged deals resolved automatically: ${summary}`,
    attachments: [{ color: allResolved ? '#1a9b85' : '#5fd4e3', blocks: capped }],
  };
}
