// Weekly traffic digest: real visitors by source, separated from bots, plus signups and
// calculations. Posted to Slack from the Monday seo-performance cron.
import type { SupabaseClient } from '@supabase/supabase-js';

type SessionRow = { created_at: string; anonymous_id: string | null; event_data: Record<string, unknown> | null };

export type SourceKey = 'google' | 'bing_ddg' | 'ai' | 'linkedin' | 'ambrosia' | 'other_ref' | 'direct';

const SOURCES: { key: SourceKey; label: string; re?: RegExp }[] = [
  { key: 'ai', label: 'AI assistants', re: /chatgpt|openai|perplexity|claude\.ai|gemini|copilot|doubao|liner\.com|you\.com|phind/i },
  { key: 'google', label: 'Google', re: /google\.|vertexaisearch/i },
  { key: 'bing_ddg', label: 'Bing / DuckDuckGo / other search', re: /bing\.com|duckduckgo|yahoo|baidu|yandex|ecosia/i },
  { key: 'linkedin', label: 'LinkedIn', re: /linkedin|lnkd\.in/i },
  { key: 'ambrosia', label: 'ambrosiaventures.co', re: /(^|\/\/|\.)ambrosiaventures\.co/i },
  { key: 'other_ref', label: 'Other referrers' },
  { key: 'direct', label: 'Direct / no referrer' },
];

export function classifySource(referrer: string, utmSource?: string | null): SourceKey {
  const r = `${referrer || ''} ${utmSource || ''}`.trim();
  if (/solidus\.ambrosiaventures\.co/i.test(referrer) && !utmSource) return 'direct';
  if (!r) return 'direct';
  if (utmSource === 'ambrosiaventures') return 'ambrosia';
  for (const s of SOURCES) if (s.re && s.re.test(r)) return s.key;
  return 'other_ref';
}

type Week = { sessions: number; bots: number; humans: Record<SourceKey, Set<string>>; landing: Map<string, number> };

function emptyWeek(): Week {
  return {
    sessions: 0,
    bots: 0,
    humans: Object.fromEntries(SOURCES.map((s) => [s.key, new Set<string>()])) as Record<SourceKey, Set<string>>,
    landing: new Map(),
  };
}

async function fetchSessions(supabase: SupabaseClient, sinceIso: string): Promise<SessionRow[]> {
  const out: SessionRow[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase
      .from('events')
      .select('created_at, anonymous_id, event_data')
      .eq('event_type', 'session_started')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(from, from + 999);
    if (error || !data?.length) break;
    out.push(...(data as SessionRow[]));
    if (data.length < 1000) break;
  }
  return out;
}

export async function buildTrafficDigest(supabase: SupabaseClient, now = new Date()) {
  const end = new Date(now);
  const curStart = new Date(end.getTime() - 7 * 86400000);
  const prevStart = new Date(end.getTime() - 14 * 86400000);
  const rows = await fetchSessions(supabase, prevStart.toISOString());

  const weeks = { cur: emptyWeek(), prev: emptyWeek() };
  for (const r of rows) {
    const w = new Date(r.created_at) >= curStart ? weeks.cur : weeks.prev;
    const d = r.event_data || {};
    w.sessions++;
    const referrer = String(d.referrer || '');
    const uaClass = d.ua_class as string | undefined;
    const src = classifySource(referrer, (d.utm_source as string) || null);
    // A session counts as a person when the server classified the browser as human. Rows
    // from before ua_class existed count as a person only when they carry a referrer.
    const human = uaClass ? uaClass === 'human' : src !== 'direct';
    if (!human) {
      w.bots++;
      continue;
    }
    w.humans[src].add(r.anonymous_id || `${r.created_at}`);
    const path = typeof d.landing_path === 'string' ? d.landing_path : '';
    if (path && src !== 'direct') w.landing.set(path, (w.landing.get(path) || 0) + 1);
  }

  const [signupsCur, signupsPrev, calcsCur] = await Promise.all([
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('created_at', curStart.toISOString()),
    supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', prevStart.toISOString())
      .lt('created_at', curStart.toISOString()),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'calculation_completed')
      .gte('created_at', curStart.toISOString()),
  ]);

  const sizes = (w: Week) => Object.fromEntries(SOURCES.map((s) => [s.key, w.humans[s.key].size])) as Record<SourceKey, number>;
  const cur = sizes(weeks.cur);
  const prev = sizes(weeks.prev);
  const total = (x: Record<SourceKey, number>) => Object.values(x).reduce((a, b) => a + b, 0);

  return {
    period: { start: curStart.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
    sessions: weeks.cur.sessions,
    bots: weeks.cur.bots,
    people: total(cur),
    peoplePrev: total(prev),
    bySource: SOURCES.map((s) => ({ key: s.key, label: s.label, cur: cur[s.key], prev: prev[s.key] })),
    topLanding: [...weeks.cur.landing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    signups: signupsCur.count ?? 0,
    signupsPrev: signupsPrev.count ?? 0,
    calculations: calcsCur.count ?? 0,
  };
}

export type TrafficDigest = Awaited<ReturnType<typeof buildTrafficDigest>>;

function delta(cur: number, prev: number) {
  const d = cur - prev;
  return `${d >= 0 ? '+' : ''}${d}`;
}

export function formatTrafficDigest(t: TrafficDigest): string {
  const lines = [
    `*Week ${t.period.start} to ${t.period.end}*`,
    `People: *${t.people}* (${delta(t.people, t.peoplePrev)} vs prior week). Sessions logged: ${t.sessions}, of which ${t.bots} bots or no-referrer.`,
    `Signups: *${t.signups}* (${delta(t.signups, t.signupsPrev)}). Calculations run: ${t.calculations}.`,
    '',
    '*People by source*',
    ...t.bySource.map((s) => `• ${s.label}: ${s.cur} (${delta(s.cur, s.prev)})`),
  ];
  if (t.topLanding.length) {
    lines.push('', '*Top landing pages from search, AI and referrals*', ...t.topLanding.map(([p, n]) => `• ${p}: ${n}`));
  }
  return lines.join('\n');
}

export async function postTrafficDigest(supabase: SupabaseClient): Promise<TrafficDigest | null> {
  const digest = await buildTrafficDigest(supabase);
  const webhook = process.env.SLACK_SEO_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (webhook) {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `:bar_chart: Solidus weekly traffic\n${formatTrafficDigest(digest)}` }),
    }).catch(() => {});
  }
  await supabase
    .from('seo_metrics')
    .upsert(
      { metric_date: digest.period.end, metric_type: 'traffic_weekly', data: digest },
      { onConflict: 'metric_date,metric_type' },
    )
    .then(
      () => undefined,
      () => undefined,
    );
  return digest;
}
