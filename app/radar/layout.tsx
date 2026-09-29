import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { radarAccessible } from '@/lib/radar/launch-server';
import { LIVE_DEAL_COUNT, formatDealCount } from '@/lib/config/constants';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Search & Evaluation — Clinical Asset Intelligence | Solidus',
  description:
    `Screen unpartnered clinical-stage programs from registries in 100 countries, with a licensing-intent score shown against peers, predicted deal terms from ${formatDealCount(LIVE_DEAL_COUNT)} comparable transactions, and the evidence behind each number.`,
  alternates: { canonical: `${BASE_URL}/radar` },
  openGraph: {
    title: 'Search & Evaluation — Clinical Asset Intelligence | Solidus',
    description: 'Discover unpartnered clinical-stage assets with licensing intent signals and predicted deal terms.',
    type: 'website',
    url: `${BASE_URL}/radar`,
    siteName: 'Solidus',
    images: [{
      url: '/api/og?title=Search%20%26%20Evaluation&subtitle=Clinical-stage%20asset%20intelligence%20for%20BD%20teams',
      width: 1200,
      height: 630,
      alt: 'Search & Evaluation — clinical asset intelligence',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Search & Evaluation | Solidus',
    description: 'Clinical-stage asset intelligence. Licensing intent signals and predicted deal terms.',
  },
  // Pre-launch: never index /radar, whether or not NEXT_PUBLIC_RADAR_ENABLED
  // is on (the page 404s when it is off). Flip to index:true at launch.
  robots: {
    index: false,
    follow: false,
  },
};

// Launch gate, evaluated on the server so the response is a real 404. Public
// once NEXT_PUBLIC_RADAR_ENABLED=true; before that, internal preview accounts
// (@ambrosiaventures.co, NEXT_PUBLIC_RADAR_PREVIEW_EMAILS) can open it in
// production and everyone else gets a 404 (lib/radar/launch.ts).
export default async function RadarLayout({ children }: { children: React.ReactNode }) {
  if (!(await radarAccessible())) notFound();
  return <>{children}</>;
}
