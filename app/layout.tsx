import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { TrackingProvider } from "@/components/TrackingProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
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
        url: "https://calculator.ambrosiaventures.co/api/og",
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
    images: ["https://calculator.ambrosiaventures.co/api/og"],
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = false;

                  if (theme === 'dark') {
                    isDark = true;
                  } else if (theme === 'light') {
                    isDark = false;
                  } else {
                    isDark = systemDark;
                  }

                  var root = document.documentElement;

                  // Set CSS custom properties for theme colors
                  if (isDark) {
                    root.classList.add('dark');
                    root.classList.remove('light');
                    root.setAttribute('data-theme', 'dark');
                    root.style.colorScheme = 'dark';
                    root.style.setProperty('--page-bg', 'linear-gradient(to bottom right, #0f172a, #0f172a, #1e293b)');
                    root.style.setProperty('--header-bg', 'rgba(15, 23, 42, 0.95)');
                    root.style.setProperty('--header-border', 'rgba(51, 65, 85, 0.8)');
                    root.style.setProperty('--card-bg', '#1e293b');
                    root.style.setProperty('--card-border', '#334155');
                    root.style.setProperty('--text-primary', '#f1f5f9');
                    root.style.setProperty('--text-secondary', '#94a3b8');
                  } else {
                    root.classList.remove('dark');
                    root.classList.add('light');
                    root.setAttribute('data-theme', 'light');
                    root.style.colorScheme = 'light';
                    root.style.setProperty('--page-bg', 'linear-gradient(to bottom right, #f8fafc, #ffffff, rgba(240, 253, 250, 0.2))');
                    root.style.setProperty('--header-bg', 'rgba(255, 255, 255, 0.95)');
                    root.style.setProperty('--header-border', 'rgba(226, 232, 240, 0.8)');
                    root.style.setProperty('--card-bg', '#ffffff');
                    root.style.setProperty('--card-border', '#e2e8f0');
                    root.style.setProperty('--text-primary', '#0f172a');
                    root.style.setProperty('--text-secondary', '#64748b');
                  }

                  // Apply to body when available
                  function applyToBody() {
                    var body = document.body;
                    if (!body) {
                      requestAnimationFrame(applyToBody);
                      return;
                    }
                    if (isDark) {
                      body.classList.add('dark-mode');
                      body.classList.remove('light-mode');
                    } else {
                      body.classList.add('light-mode');
                      body.classList.remove('dark-mode');
                    }
                  }
                  if (document.body) {
                    applyToBody();
                  } else {
                    document.addEventListener('DOMContentLoaded', applyToBody);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <GlobalJsonLd />
        <ThemeProvider>
          <AuthProvider>
            <TrackingProvider>{children}</TrackingProvider>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
