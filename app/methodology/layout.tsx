import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Methodology — How We Build Our Deal Benchmarks',
  description: 'Our benchmarks are calibrated against 3,400+ verified biopharma transactions from SEC filings, FTC pre-merger filings, press releases, and regulatory databases. Multi-factor regression, Monte Carlo simulation, and semantic deal matching.',
  openGraph: {
    title: 'Methodology — Ambrosia Ventures Deal Intelligence',
    description: 'How we build institutional-grade biopharma deal benchmarks from 3,000+ verified transactions.',
    images: [{ url: '/api/og?title=Methodology&subtitle=How+We+Build+Our+Deal+Benchmarks', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Methodology — Ambrosia Ventures Deal Intelligence',
    description: 'Multi-factor regression, Monte Carlo simulation, and semantic matching from 3,000+ verified transactions.',
  },
  keywords: ['biopharma deal methodology', 'deal benchmarking methodology', 'rNPV methodology', 'Monte Carlo pharma', 'hedonic regression deals', 'semantic deal matching'],
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/methodology',
  },
};

export default function MethodologyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
