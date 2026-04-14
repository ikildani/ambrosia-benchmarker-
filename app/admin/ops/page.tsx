/**
 * Admin Ops Dashboard — /admin/ops
 *
 * Internal-only view of platform health. Auth-gated by the existing
 * app/admin/layout.tsx (ADMIN_EMAILS allowlist). Shows:
 *   - Event volume by type (last 30d)
 *   - Calculations run (daily trend)
 *   - Share link views
 *   - Top counterparty premiums (for spot-checking data drift)
 *   - Latest backtest baseline accuracy (from baseline-errors.json)
 *   - User signups + authenticated sessions
 *
 * Purely diagnostic. No writes. Server component — data loaded at render.
 */

import { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { loadAccuracyData } from '@/lib/accuracy-dashboard-data';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Ops Dashboard | Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function fmtNumber(n: number): string {
  return n.toLocaleString('en-US');
}

interface EventRow {
  event_type: string;
  count: number;
}

interface BuyerRow {
  company_name: string;
  premium_multiplier: number;
  sample_size: number;
  confidence: string;
}

async function loadOpsData() {
  const supabase = createServiceClient();

  // 30-day window
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalEventsResp,
    sharesResp,
    buyersResp,
    usersResp,
  ] = await Promise.all([
    supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since),
    supabase
      .from('shared_calculations')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true),
    supabase
      .from('counterparty_premiums')
      .select('company_name, premium_multiplier, sample_size, confidence')
      .order('sample_size', { ascending: false })
      .limit(10),
    supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true }),
  ]);

  // Group event types client-side — events table small enough in prod.
  let eventsByType: EventRow[] = [];
  const fallback = await supabase
    .from('events')
    .select('event_type')
    .gte('created_at', since)
    .limit(10000);
  if (fallback.data) {
    const tally = new Map<string, number>();
    for (const row of fallback.data) {
      tally.set(row.event_type, (tally.get(row.event_type) ?? 0) + 1);
    }
    eventsByType = [...tally.entries()]
      .map(([event_type, count]) => ({ event_type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }

  return {
    eventsByType,
    totalEvents: totalEventsResp.count ?? 0,
    totalShares: sharesResp.count ?? 0,
    topBuyers: (buyersResp.data as BuyerRow[]) ?? [],
    totalUsers: usersResp.count ?? 0,
  };
}

export default async function OpsDashboard() {
  const [opsData, accuracy] = await Promise.all([
    loadOpsData(),
    Promise.resolve(loadAccuracyData()),
  ]);

  const calculationCount = opsData.eventsByType.find(e => e.event_type === 'calculation_completed')?.count ?? 0;
  const sessionCount = opsData.eventsByType.find(e => e.event_type === 'session_started')?.count ?? 0;
  const shareViewCount = opsData.eventsByType.find(e => e.event_type === 'share_view')?.count ?? 0;
  const reportCount = opsData.eventsByType.find(e => e.event_type === 'report_generated_server')?.count ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Ops Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Platform health · last 30 days · auto-refreshing on page load
          </p>
        </div>

        {/* Top-line stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Sessions (30d)" value={fmtNumber(sessionCount)} sublabel={`${fmtNumber(opsData.totalEvents)} total events`} />
          <StatCard label="Calculations" value={fmtNumber(calculationCount)} sublabel="calculation_completed events" />
          <StatCard label="Share views" value={fmtNumber(shareViewCount)} sublabel={`${fmtNumber(opsData.totalShares)} total share links`} />
          <StatCard label="Registered users" value={fmtNumber(opsData.totalUsers)} sublabel={`${fmtNumber(reportCount)} PDF reports generated`} />
        </div>

        {/* Engine accuracy — current state */}
        {accuracy && (
          <Card title="Engine accuracy (current state)">
            <div className="grid gap-4 sm:grid-cols-3">
              <AccuracyTile label="Core ±25%" value={pct(accuracy.coreScope.hit25)} target="60%" hits={accuracy.coreScope.hit25 >= 0.6} />
              <AccuracyTile label="Core ±35%" value={pct(accuracy.coreScope.hit35)} target="70%" hits={accuracy.coreScope.hit35 >= 0.7} />
              <AccuracyTile label="Core ±50%" value={pct(accuracy.coreScope.hit50)} target="80%" hits={accuracy.coreScope.hit50 >= 0.8} />
            </div>
            {accuracy.holdout && (
              <div className="mt-4 rounded border border-slate-200 bg-white p-3 text-xs text-slate-600">
                <div className="font-medium text-slate-700">Held-out test (n={accuracy.holdout.test.n}):</div>
                <div className="mt-1">
                  ±25% {pct(accuracy.holdout.test.hit25)} ·
                  {' '}±35% {pct(accuracy.holdout.test.hit35)} ·
                  {' '}±50% {pct(accuracy.holdout.test.hit50)}
                  {' '}· gap vs train {pct(accuracy.holdout.overfittingGap.hit25)}
                </div>
              </div>
            )}
            <div className="mt-3 text-xs text-slate-500">
              Dashboard hidden from public;{' '}
              <Link href="/accuracy" className="underline hover:text-slate-700">
                direct URL
              </Link>
            </div>
          </Card>
        )}

        {/* Event volume breakdown */}
        <Card title="Event volume by type (30d)" className="mt-6">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2 text-left font-normal">Event</th>
                <th className="pb-2 text-right font-normal">Count</th>
                <th className="pb-2 text-right font-normal">% of total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {opsData.eventsByType.map(e => (
                <tr key={e.event_type}>
                  <td className="py-2 text-slate-700">{e.event_type}</td>
                  <td className="py-2 text-right font-mono text-slate-900">{fmtNumber(e.count)}</td>
                  <td className="py-2 text-right font-mono text-slate-500">
                    {opsData.totalEvents > 0 ? pct(e.count / opsData.totalEvents) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Top buyers in counterparty_premiums */}
        <Card title="Top counterparty premiums (for drift monitoring)" className="mt-6">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2 text-left font-normal">Buyer</th>
                <th className="pb-2 text-right font-normal">Premium</th>
                <th className="pb-2 text-right font-normal">n</th>
                <th className="pb-2 text-left font-normal">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {opsData.topBuyers.map(b => (
                <tr key={b.company_name}>
                  <td className="py-2 text-slate-700">{b.company_name}</td>
                  <td className={`py-2 text-right font-mono ${b.premium_multiplier > 1.2 ? 'text-teal-600' : b.premium_multiplier < 0.9 ? 'text-amber-600' : 'text-slate-900'}`}>
                    ×{Number(b.premium_multiplier).toFixed(2)}
                  </td>
                  <td className="py-2 text-right font-mono text-slate-500">{b.sample_size}</td>
                  <td className="py-2 text-xs text-slate-600 capitalize">{b.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-xs text-slate-500">
            Premium drift &gt;15% between quarterly refreshes signals a data issue;
            look into the cron at /api/cron/counterparty-calibration.
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-3xl font-semibold text-slate-900">{value}</div>
      {sublabel && <div className="mt-1 text-xs text-slate-500">{sublabel}</div>}
    </div>
  );
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h2 className="mb-4 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function AccuracyTile({ label, value, target, hits }: { label: string; value: string; target: string; hits: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${hits ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold ${hits ? 'text-teal-700' : 'text-slate-900'}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">target {target}</div>
    </div>
  );
}
