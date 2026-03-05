import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "sonner";
import { TrackingProvider } from "@/components/TrackingProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/lib/theme";
import { GlobalJsonLd } from "./json-ld";
import ProgressBarProvider from "@/components/ProgressBarProvider";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--font-display", weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Life Sciences Deal Calculator | Ambrosia Ventures",
  description: "Instant deal benchmarks, rNPV analysis, Monte Carlo simulation, and AI-powered market intelligence for biopharma licensing deals across 8 therapeutic areas. 600+ deals, 120+ company profiles.",
  keywords: ["biotech", "licensing", "deal terms", "rNPV", "Monte Carlo", "deal benchmarks", "oncology", "neurology", "CNS", "immunology", "autoimmune", "metabolic", "obesity", "GLP-1", "milestones", "royalties", "M&A", "life sciences", "partner matching"],
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
    description: "rNPV modeling, Monte Carlo simulation, and AI market intelligence for biopharma licensing deals. 600+ deals, 120+ company profiles, 8 therapeutic areas.",
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
    description: "rNPV, Monte Carlo & AI deal intelligence for biopharma licensing. 600+ deals, 120+ companies.",
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
        <link rel="preconnect" href="https://va.vercel-scripts.com" />
        <link rel="dns-prefetch" href="https://va.vercel-scripts.com" />
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans`}>
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
          <ProgressBarProvider />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
