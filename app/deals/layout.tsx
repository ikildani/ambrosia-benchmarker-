import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Biotech & Pharma Deal Database | 500+ Licensing Transactions | Ambrosia Ventures',
  description: 'Browse 500+ biotech and pharma licensing deals. Filter by modality, indication, phase, and territory. Access upfront payments, milestones, and deal terms from real transactions.',
  keywords: [
    'biotech deals database',
    'pharma licensing deals',
    'biopharma transactions',
    'drug licensing database',
    'oncology deals',
    'licensing deal terms',
    'upfront payments database',
    'pharma partnerships',
  ],
  openGraph: {
    title: 'Biotech & Pharma Deal Database | 500+ Transactions',
    description: 'Browse and analyze 500+ real licensing deals. Filter by modality, indication, phase, and territory.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/deals',
    images: [
      {
        url: '/api/og?title=Deal%20Database&subtitle=500%2B%20Biotech%20%26%20Pharma%20Transactions',
        width: 1200,
        height: 630,
        alt: 'Ambrosia Ventures Deal Database',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biotech & Pharma Deal Database | 500+ Transactions',
    description: 'Browse and analyze 500+ real licensing deals with full deal terms.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/deals',
  },
};

export default function DealsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
