import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "sonner";
import { TrackingProvider } from "@/components/TrackingProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/lib/theme";
import { GlobalJsonLd } from "./json-ld";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Life Sciences Deal Calculator | Ambrosia Ventures",
  description: "Estimate upfront payments, milestones, and royalties for biopharma licensing deals across oncology, neurology, and immunology. Powered by Ambrosia Ventures.",
  keywords: ["biotech", "licensing", "deal terms", "oncology", "neurology", "CNS", "immunology", "autoimmune", "milestones", "royalties", "M&A", "life sciences"],
  authors: [{ name: "Ambrosia Ventures" }],
  metadataBase: new URL("https://calculator.ambrosiaventures.co"),
  verification: {
    google: "iAzMTWYwwCcC_foIWu0oPFBXKfYOT61aCgqs3vQ0r4c",
  },
  alternates: {
    canonical: "https://calculator.ambrosiaventures.co",
  },
  openGraph: {
    title: "Life Sciences Deal Calculator",
    description: "Data-driven estimates for biopharma licensing deals across oncology, neurology, and immunology",
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
    description: "Data-driven estimates for biopharma licensing deals",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="alternate" type="application/rss+xml" title="Ambrosia Ventures Blog" href="/feed.xml" />
      </head>
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-lg focus:outline-none"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <GlobalJsonLd />
          <AuthProvider>
            <TrackingProvider>{children}</TrackingProvider>
          </AuthProvider>
          <Toaster richColors position="top-right" />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
