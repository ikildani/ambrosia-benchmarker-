import type { Metadata } from 'next';

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
  robots: {
    index: true,
    follow: true,
  },
};

export default function RadarLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
