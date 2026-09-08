import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome to Ambrosia Pro',
  description: 'Set up your Ambrosia Pro account and explore 14 institutional-grade deal intelligence engines.',
  robots: { index: false, follow: false },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
