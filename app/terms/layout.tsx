import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Ambrosia Ventures',
  description: 'Terms of service for Ambrosia Ventures Deal Calculator. Usage terms, disclaimers, and legal information.',
  openGraph: {
    title: 'Terms of Service | Ambrosia Ventures',
    description: 'Terms of service for Ambrosia Ventures Deal Calculator.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/terms',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/terms',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
