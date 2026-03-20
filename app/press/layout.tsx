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
    images: [{ url: '/api/og?title=Press+%26+Media&subtitle=Ambrosia+Ventures', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Press & Media | Ambrosia Ventures',
    description: 'Press resources for the biopharma deal intelligence platform.',
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
