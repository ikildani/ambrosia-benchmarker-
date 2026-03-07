import { Metadata } from 'next';
import { generateHowToSchema, generatePricingSchema, generateBreadcrumbSchema } from '@/lib/seo/structured-data';

const howToSchema = generateHowToSchema();
const pricingSchema = generatePricingSchema();
const breadcrumbSchema = generateBreadcrumbSchema([
  { name: 'Home', url: 'https://calculator.ambrosiaventures.co' },
  { name: 'Deal Calculator' },
]);

export const metadata: Metadata = {
  title: 'Deal Terms Calculator — Biotech & Pharma Licensing Benchmarks',
  description: 'Calculate upfront payments, milestone structures, and royalty rates for biopharma licensing deals. rNPV analysis, Monte Carlo simulation, sensitivity analysis, and AI deal memos across oncology, neurology, immunology, metabolic, cardiovascular, and more. Powered by 600+ real transactions.',
  keywords: [
    'biotech deal calculator', 'pharma licensing calculator', 'drug deal valuation tool',
    'upfront payment benchmarks', 'milestone payment calculator', 'royalty rate estimator',
    'biopharma deal valuation', 'licensing deal terms calculator',
    'oncology licensing terms', 'neurology CNS deal calculator', 'immunology deal calculator',
    'autoimmune licensing deals', 'metabolic obesity deal benchmarks', 'cardiovascular deal terms',
    'CAR-T deal valuation', 'ADC licensing terms', 'gene therapy deal calculator',
    'bispecific antibody deals', 'cell therapy licensing', 'biologics deal benchmarks',
    'rNPV calculator pharma', 'Monte Carlo simulation biotech',
    'deal sensitivity analysis', 'comparable deal analysis',
    'pharma licensing negotiation', 'biotech term sheet benchmarks',
  ],
  openGraph: {
    title: 'Deal Terms Calculator — Instant Biopharma Licensing Benchmarks',
    description: 'Calculate upfront payments, milestones, and royalties with rNPV analysis and Monte Carlo simulation. 600+ real biopharma transactions, 8 therapeutic areas.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/calculator',
    images: [
      {
        url: '/api/og?title=Deal%20Terms%20Calculator&subtitle=rNPV%20%C2%B7%20Monte%20Carlo%20%C2%B7%20600%2B%20Real%20Transactions',
        width: 1200,
        height: 630,
        alt: 'Ambrosia Ventures Deal Calculator — rNPV, Monte Carlo, and benchmarks from 600+ real biopharma deals',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Deal Terms Calculator — Instant Biopharma Licensing Benchmarks',
    description: 'rNPV analysis, Monte Carlo simulation, and AI deal intelligence from 600+ real transactions. 8 therapeutic areas.',
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
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {children}
    </>
  );
}
