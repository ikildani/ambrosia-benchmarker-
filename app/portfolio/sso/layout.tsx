import type { Metadata } from 'next';

// Invite/auth flow — never indexable. The page itself is a client component
// and cannot export metadata, so the noindex lives here.
export const metadata: Metadata = {
  title: 'Portfolio SSO Sign-In',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
