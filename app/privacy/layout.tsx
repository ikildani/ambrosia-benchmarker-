import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for Solidus. Learn how we collect, use, and protect your data.',
  openGraph: {
    title: 'Privacy Policy',
    description: 'Privacy policy for Solidus.',
    type: 'website',
    url: 'https://solidus.ambrosiaventures.co/privacy',
  },
  alternates: {
    canonical: 'https://solidus.ambrosiaventures.co/privacy',
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy',
    description: 'Privacy policy for Solidus.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
