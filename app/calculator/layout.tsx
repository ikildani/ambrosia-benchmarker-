import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deal Terms Calculator | Biotech & Pharma Licensing | Ambrosia Ventures',
  description: 'Calculate upfront payments, milestone payments, and royalties for biotech and pharma licensing deals. Powered by 500+ real transactions from oncology, neurology, rare disease, and more.',
  keywords: [
    'biotech deal calculator',
    'pharma licensing calculator',
    'upfront payment calculator',
    'milestone payments',
    'royalty rates',
    'licensing deal terms',
    'biopharma deal valuation',
    'drug licensing calculator',
  ],
  openGraph: {
    title: 'Deal Terms Calculator | Biotech & Pharma Licensing',
    description: 'Calculate upfront payments, milestones, and royalties based on 500+ real biopharma deals. Free instant estimates.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/calculator',
    images: [
      {
        url: '/api/og?title=Deal%20Terms%20Calculator&subtitle=Powered%20by%20500%2B%20Real%20Transactions',
        width: 1200,
        height: 630,
        alt: 'Ambrosia Ventures Deal Calculator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Deal Terms Calculator | Biotech & Pharma Licensing',
    description: 'Calculate upfront payments, milestones, and royalties based on 500+ real biopharma deals.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/calculator',
  },
};

export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
