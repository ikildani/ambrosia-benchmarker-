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
import CookieConsent from "@/components/CookieConsent";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", variable: "--font-display", weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: {
    default: "Life Sciences Deal Calculator | Biopharma Licensing Benchmarks | Ambrosia Ventures",
    template: "%s | Ambrosia Ventures",
  },
  description: "Instant deal benchmarks, rNPV analysis, Monte Carlo simulation, and real-time market intelligence for biopharma licensing deals across 12 therapeutic areas. 2,500+ real transactions, 850+ company profiles. Free to start.",
  keywords: [
    "biotech deal calculator", "pharma licensing benchmarks", "biopharma deal terms",
    "rNPV analysis tool", "Monte Carlo simulation pharma", "deal benchmarking",
    "oncology licensing deals", "neurology CNS deal terms", "immunology autoimmune licensing",
    "metabolic obesity GLP-1 deals", "cardiovascular drug deals", "infectious disease licensing",
    "ophthalmology deal benchmarks", "women health biopharma",
    "upfront payment benchmarks", "milestone payment calculator", "royalty rate benchmarks",
    "ADC deal valuation", "CAR-T licensing terms", "gene therapy deal benchmarks",
    "bispecific antibody licensing", "small molecule deal terms",
    "biotech M&A valuation", "life sciences partner matching", "deal intelligence platform",
    "pharma competitive intelligence", "drug licensing calculator",
  ],
  authors: [{ name: "Ambrosia Ventures" }],
  creator: "Ambrosia Ventures",
  publisher: "Ambrosia Ventures",
  metadataBase: new URL("https://calculator.ambrosiaventures.co"),
  verification: {
    google: "iAzMTWYwwCcC_foIWu0oPFBXKfYOT61aCgqs3vQ0r4c",
  },
  alternates: {
    canonical: "https://calculator.ambrosiaventures.co",
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  category: "Life Sciences",
  openGraph: {
    title: "Life Sciences Deal Calculator — Instant Biopharma Licensing Benchmarks",
    description: "rNPV modeling, Monte Carlo simulation, and AI market intelligence for biopharma licensing deals. 2,500+ real transactions, 850+ company profiles, 12 therapeutic areas. Free to start.",
    type: "website",
    url: "https://calculator.ambrosiaventures.co",
    siteName: "Ambrosia Ventures",
    locale: "en_US",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Life Sciences Deal Calculator — Instant benchmarks from 2,500+ real biopharma licensing transactions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Life Sciences Deal Calculator — Instant Biopharma Licensing Benchmarks",
    description: "rNPV, Monte Carlo & AI deal intelligence for biopharma licensing. 2,500+ deals, 850+ companies, 12 TAs. Free to start.",
    images: ["/api/og"],
    creator: "@AmbrosiaVC",
    site: "@AmbrosiaVC",
  },
  other: {
    "msapplication-TileColor": "#0EA5A5",
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
        <link rel="alternate" type="application/rss+xml" title="Ambrosia Ventures" href="/feed.xml" />
        <link rel="preconnect" href="https://va.vercel-scripts.com" />
        <link rel="dns-prefetch" href="https://va.vercel-scripts.com" />
        {/* LinkedIn Insight Tag — retargeting pixel for calculator visitors */}
        {process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                _linkedin_partner_id = "${process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID}";
                window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
                window._linkedin_data_partner_ids.push(_linkedin_partner_id);
                (function(l) {
                  if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
                  window.lintrk.q=[]}
                  var s = document.getElementsByTagName("script")[0];
                  var b = document.createElement("script");
                  b.type = "text/javascript";b.async = true;
                  b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
                  s.parentNode.insertBefore(b, s);})(window.lintrk);
              `,
            }}
          />
        )}
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
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
