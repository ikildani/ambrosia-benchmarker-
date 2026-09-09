import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Asset Radar — Clinical Asset Intelligence | Solidus',
  description:
    'Discover unpartnered clinical-stage assets with licensing intent signals, predicted deal terms from 1,800+ comparable transactions, and competitive intelligence. Updated daily from ClinicalTrials.gov.',
  alternates: { canonical: `${BASE_URL}/radar` },
  openGraph: {
    title: 'Asset Radar — Clinical Asset Intelligence | Solidus',
    description: 'Discover unpartnered clinical-stage assets with licensing intent signals and predicted deal terms.',
    type: 'website',
    url: `${BASE_URL}/radar`,
    siteName: 'Solidus',
    images: [{
      url: '/api/og?title=Asset%20Radar&subtitle=Clinical-stage%20asset%20intelligence%20for%20BD%20teams',
      width: 1200,
      height: 630,
      alt: 'Asset Radar — clinical asset intelligence',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Asset Radar | Solidus',
    description: 'Clinical-stage asset intelligence. Licensing intent signals and predicted deal terms.',
  },
  // Pre-launch: never index /radar, whether or not NEXT_PUBLIC_RADAR_ENABLED
  // is on (the page 404s when it is off). Flip to index:true at launch.
  robots: {
    index: false,
    follow: false,
  },
};

// Launch gate, evaluated on the server so the response is a real 404 (the
// page-level check in page.tsx runs in a client component, which renders the
// not-found UI but still returns HTTP 200). On in development when unset,
// otherwise only when NEXT_PUBLIC_RADAR_ENABLED=true.
const RADAR_ENABLED =
  process.env.NEXT_PUBLIC_RADAR_ENABLED === 'true' ||
  (!process.env.NEXT_PUBLIC_RADAR_ENABLED && process.env.NODE_ENV === 'development');

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  if (!RADAR_ENABLED) notFound();
  return <>{children}</>;
}
