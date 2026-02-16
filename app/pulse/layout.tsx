import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Market Pulse | Weekly Deal Intelligence | Ambrosia Benchmarker',
  description: 'Weekly biotech licensing intelligence — deal activity, benchmark shifts, modality trends, and trial updates. Know what moved before your next board meeting.',
  openGraph: {
    title: 'Market Pulse | Ambrosia Benchmarker',
    description: 'Weekly biotech deal intelligence, benchmark shifts, and modality trends for BD professionals.',
    type: 'website',
  },
};

export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
