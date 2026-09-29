/**
 * /radar — the Search & Evaluation feed.
 *
 * Server shell: the launch gate (NEXT_PUBLIC_RADAR_ENABLED, also enforced in
 * layout.tsx so the response is a real 404) and one read of the active model
 * so the upgrade gate's copy is true: it only says "backtested against
 * announced deals" when a backtest has actually activated a model. Everything
 * interactive lives in RadarFeedClient.
 */

import { notFound } from 'next/navigation';
import { radarBacktested } from '@/lib/radar/backtested';
import { radarAccessible } from '@/lib/radar/launch-server';
import { RadarFeedClient } from '@/components/radar/feed/RadarFeedClient';

export const dynamic = 'force-dynamic';

export default async function RadarPage() {
  if (!(await radarAccessible())) notFound();
  const backtested = await radarBacktested();
  return <RadarFeedClient backtested={backtested} />;
}
