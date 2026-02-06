import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Press & Media | Ambrosia Ventures',
  description: 'Press resources, media kit, and company information for Ambrosia Ventures. Access logos, fact sheets, and contact information for press inquiries.',
  keywords: [
    'Ambrosia Ventures press',
    'biotech deal data',
    'pharma licensing intelligence',
    'biopharma market data',
    'life sciences analytics',
  ],
  openGraph: {
    title: 'Press & Media | Ambrosia Ventures',
    description: 'Press resources and media information for Ambrosia Ventures.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/press',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/press',
  },
};

export default function PressLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
