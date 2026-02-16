import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Deal Terms Calculator | Biotech & Pharma Licensing | Ambrosia Ventures',
  description: 'Calculate upfront payments, milestone payments, and royalties for biotech and pharma licensing deals across oncology, immunology/autoimmune, and neurology/CNS. Powered by 600+ real transactions.',
  keywords: [
    'biotech deal calculator',
    'pharma licensing calculator',
    'upfront payment calculator',
    'milestone payments',
    'royalty rates',
    'licensing deal terms',
    'biopharma deal valuation',
    'drug licensing calculator',
    'immunology deal calculator',
    'autoimmune licensing deals',
    'CAR-T deal valuation',
    'oncology licensing terms',
    'neurology CNS deal calculator',
    'biologics deal benchmarks',
    'anti-TL1A deal terms',
    'cell therapy licensing',
  ],
  openGraph: {
    title: 'Deal Terms Calculator | Biotech & Pharma Licensing',
    description: 'Calculate upfront payments, milestones, and royalties for oncology, immunology, and neurology deals. Powered by 600+ real biopharma transactions.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/calculator',
    images: [
      {
        url: '/api/og?title=Deal%20Terms%20Calculator&subtitle=Powered%20by%20600%2B%20Real%20Transactions',
        width: 1200,
        height: 630,
        alt: 'Ambrosia Ventures Deal Calculator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Deal Terms Calculator | Biotech & Pharma Licensing',
    description: 'Calculate upfront payments, milestones, and royalties for oncology, immunology, and neurology deals. Powered by 600+ real biopharma transactions.',
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
