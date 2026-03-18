import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Methodology — How We Build Our Deal Benchmarks',
  description: 'Our benchmarks are calibrated against 3,000+ verified biopharma transactions from SEC filings, press releases, and regulatory databases. Multi-factor regression, Monte Carlo simulation, and semantic deal matching.',
  openGraph: {
    title: 'Methodology — Ambrosia Ventures Deal Intelligence',
    description: 'How we build institutional-grade biopharma deal benchmarks from 3,000+ verified transactions.',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/methodology',
  },
};

export default function MethodologyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
