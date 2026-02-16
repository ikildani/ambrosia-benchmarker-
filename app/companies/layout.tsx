import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Company Profiles | Competitive Intelligence | Ambrosia Benchmarker',
  description: 'Explore biotech and pharma company profiles — deal history, pipeline data, patent cliffs, and benchmark comparisons for competitive intelligence.',
  openGraph: {
    title: 'Company Profiles | Ambrosia Benchmarker',
    description: 'Biotech competitive intelligence — company deal history, pipelines, patent cliffs, and benchmark analysis.',
    type: 'website',
  },
};

export default function CompaniesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
