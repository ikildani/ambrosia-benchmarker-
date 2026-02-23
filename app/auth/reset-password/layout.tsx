import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Password | Ambrosia Ventures',
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
