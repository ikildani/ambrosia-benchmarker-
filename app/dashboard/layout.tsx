import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | Ambrosia Ventures',
  description: 'Your deal analysis dashboard — saved calculations, watchlist, history, and settings.',
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
