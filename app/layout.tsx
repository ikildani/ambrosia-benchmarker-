import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TrackingProvider } from "@/components/TrackingProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalJsonLd } from "./json-ld";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Life Sciences Deal Calculator | Ambrosia Ventures",
  description: "Estimate upfront payments, milestones, and royalties for oncology asset licensing deals. Powered by Ambrosia Ventures.",
  keywords: ["biotech", "licensing", "deal terms", "oncology", "milestones", "royalties", "M&A", "life sciences"],
  authors: [{ name: "Ambrosia Ventures" }],
  metadataBase: new URL("https://calculator.ambrosiaventures.co"),
  verification: {
    google: "iAzMTWYwwCcC_foIWu0oPFBXKfYOT61aCgqs3vQ0r4c",
  },
  openGraph: {
    title: "Life Sciences Deal Calculator",
    description: "Data-driven estimates for oncology licensing deals",
    type: "website",
    url: "https://calculator.ambrosiaventures.co",
    siteName: "Ambrosia Ventures",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Life Sciences Deal Calculator by Ambrosia Ventures",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Life Sciences Deal Calculator",
    description: "Data-driven estimates for oncology licensing deals",
    images: ["/api/og"],
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
        <GlobalJsonLd />
        <AuthProvider>
          <TrackingProvider>{children}</TrackingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
