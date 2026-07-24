import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Company Profile | Competitive Intelligence | Solidus',
  description: 'Company deal history, pipeline analysis, patent cliff timeline, and benchmark comparisons for biotech competitive intelligence.',
  openGraph: {
    title: 'Company Profile | Solidus',
    description: 'Biotech company competitive intelligence — deal history, pipeline, patent cliffs, and benchmark analysis.',
    type: 'website',
  },
};

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
