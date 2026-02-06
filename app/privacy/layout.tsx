import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Ambrosia Ventures',
  description: 'Privacy policy for Ambrosia Ventures Deal Calculator. Learn how we collect, use, and protect your data.',
  openGraph: {
    title: 'Privacy Policy | Ambrosia Ventures',
    description: 'Privacy policy for Ambrosia Ventures Deal Calculator.',
    type: 'website',
    url: 'https://calculator.ambrosiaventures.co/privacy',
  },
  alternates: {
    canonical: 'https://calculator.ambrosiaventures.co/privacy',
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
