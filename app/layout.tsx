import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TrackingProvider } from "@/components/TrackingProvider";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Life Sciences Deal Calculator | Ambrosia Ventures",
  description: "Estimate upfront payments, milestones, and royalties for oncology asset licensing deals. Powered by Ambrosia Ventures.",
  keywords: ["biotech", "licensing", "deal terms", "oncology", "milestones", "royalties", "M&A", "life sciences"],
  authors: [{ name: "Ambrosia Ventures" }],
  openGraph: {
    title: "Life Sciences Deal Calculator",
    description: "Estimate deal terms for oncology asset licensing",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <TrackingProvider>{children}</TrackingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
