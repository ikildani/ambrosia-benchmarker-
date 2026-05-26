import { Metadata } from 'next';
import PortfolioAdminLayoutClient from './PortfolioAdminLayoutClient';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Portfolio Admin | Ambrosia Ventures',
};

export default function PortfolioAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortfolioAdminLayoutClient>{children}</PortfolioAdminLayoutClient>;
}
