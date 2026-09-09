import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for Solidus. Usage terms, disclaimers, and legal information.',
  openGraph: {
    title: 'Terms of Service',
    description: 'Terms of service for Solidus.',
    type: 'website',
    url: 'https://solidus.ambrosiaventures.co/terms',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/terms',
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Service',
    description: 'Terms of service for Solidus.',
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
