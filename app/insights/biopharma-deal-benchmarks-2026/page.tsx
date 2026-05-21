import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://calculator.ambrosiaventures.co';
const CANONICAL = `${BASE_URL}/insights/biopharma-deal-benchmarks-2026`;

export const metadata: Metadata = {
  title: 'Biopharma Deal Benchmarks 2026 — Three Patterns from 3,447 Transactions | Ambrosia Ventures',
  description:
    'Three deal-economics patterns from 3,447 verified biopharma licensing transactions: the Phase 2 inflection, the immunology premium, and ADC normalization. From Ambrosia Ventures — boutique LS strategic + M&A advisory.',
  keywords: [
    'biopharma deal benchmarks 2026',
    'biotech licensing data',
    'phase 2 upfront payment',
    'immunology deal premium',
    'ADC licensing deals',
    'biopharma deal intelligence',
    'biotech M&A advisory',
    'life sciences advisory firm',
  ],
  openGraph: {
    title: 'Biopharma Deal Benchmarks 2026 — Three Patterns from 3,447 Transactions',
    description:
      'The Phase 2 inflection. The immunology premium. ADC normalization. Three deal-economics patterns from 3,447 verified transactions.',
    type: 'article',
    url: CANONICAL,
    siteName: 'Ambrosia Ventures',
    images: [
      {
        url: '/api/og?title=Biopharma%20Deal%20Benchmarks%202026&subtitle=Three%20Patterns%20%C2%B7%203%2C447%20Transactions&type=insight',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Biopharma Deal Benchmarks 2026 — Three Patterns',
    description:
      'Phase 2 upfronts jump 2.1x. Immunology Phase 2 deals out-value oncology 4:1. ADCs normalized post-2023.',
  },
  alternates: { canonical: CANONICAL },
};

// ─────────────────────────────────────────────────────────────────
// Data — exact figures kept from prior version, normalized for bars
// ─────────────────────────────────────────────────────────────────
const PHASE_LADDER = [
  { phase: 'Preclinical', upfront: 82, tdv: 888, upfrontPct: 9.7, n: 420, barPct: 4.2 },
  { phase: 'Phase 1', upfront: 140, tdv: 1209, upfrontPct: 11.1, n: 350, barPct: 7.1 },
  { phase: 'Phase 2', upfront: 300, tdv: 1801, upfrontPct: 14.2, n: 426, barPct: 15.3, highlight: true },
  { phase: 'Phase 3', upfront: 678, tdv: 3500, upfrontPct: 16.8, n: 345, barPct: 34.5 },
  { phase: 'Approved', upfront: 1964, tdv: 6750, upfrontPct: 26.5, n: 364, barPct: 100 },
];

const TA_PHASE2 = [
  { ta: 'Metabolic', p2Upfront: 1300, p3Upfront: 4500, multiple: '3.5x', barPct: 100, highlight: true },
  { ta: 'Immunology', p2Upfront: 1250, p3Upfront: 3200, multiple: '2.6x', barPct: 96.2, highlight: true },
  { ta: 'Neurology', p2Upfront: 302, p3Upfront: 838, multiple: '2.8x', barPct: 23.2 },
  { ta: 'Oncology', p2Upfront: 281, p3Upfront: 714, multiple: '2.5x', barPct: 21.6 },
];

const ADC_YEARS = [
  { year: '2019', deals: 17, tdv: 1339, total: 46.2, barPct: 12.4 },
  { year: '2020', deals: 20, tdv: 2663, total: 136.8, barPct: 36.8 },
  { year: '2021', deals: 18, tdv: 1686, total: 76.8, barPct: 20.6 },
  { year: '2022', deals: 25, tdv: 3302, total: 105.1, barPct: 28.3 },
  { year: '2023', deals: 32, tdv: 5932, total: 371.8, barPct: 100, highlight: true },
  { year: '2024', deals: 35, tdv: 1824, total: 104.4, barPct: 28.1 },
  { year: '2025*', deals: 17, tdv: 1598, total: 36.7, barPct: 9.9 },
];

const MODALITY_UPFRONT = [
  { name: 'ADC', upfront: 361, barPct: 100, highlight: true },
  { name: 'Bispecific', upfront: 281, barPct: 77.8 },
  { name: 'mRNA', upfront: 156, barPct: 43.2 },
  { name: 'Gene Therapy', upfront: 100, barPct: 27.7 },
];

const SCHEDULE_URL =
  'mailto:issa@ambrosiaventures.co?subject=Briefing%20Call%20%E2%80%94%20Deal%20Benchmarks%202026&body=Issa%20%E2%80%94%20saw%20the%20benchmarks%20note.%20Available%20to%20speak%20on%3A%20';

export default function DealBenchmarks2026() {
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Biopharma Deal Benchmarks 2026 — Three Patterns from 3,447 Transactions',
    description:
      'Three deal-economics patterns from 3,447 verified biopharma licensing transactions: the Phase 2 inflection, the immunology premium, and ADC normalization.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: BASE_URL },
    publisher: {
      '@type': 'Organization',
      name: 'Ambrosia Ventures',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` },
    },
    datePublished: '2026-03-23',
    dateModified: '2026-05-20',
    mainEntityOfPage: CANONICAL,
    articleSection: 'Biopharma Deal Intelligence',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      {/* Self-contained brand stylesheet — matches firm deck exactly,
          independent of any site-wide CSS variable conflicts. */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700;800&display=swap');

        .av-brief {
          --av-navy-deep: #0a0d1b;
          --av-navy: #1a1e42;
          --av-purple: #8b8eb5;
          --av-teal: #5eead4;
          --av-text-primary: #ffffff;
          --av-text-secondary: #c4c8e8;
          --av-text-muted: #8b8eb5;
          --av-text-dim: #5a5e7e;
          --av-border: rgba(196, 200, 232, 0.08);
          --av-border-strong: rgba(196, 200, 232, 0.18);
          --av-surface: rgba(255, 255, 255, 0.02);
          --av-surface-elev: rgba(255, 255, 255, 0.04);

          background: var(--av-navy-deep);
          color: var(--av-text-primary);
          font-family: 'Inter', -apple-system, system-ui, sans-serif;
          font-weight: 400;
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
        }
        .av-brief * { box-sizing: border-box; }

        .av-brief .av-topbar {
          padding: 16px 6vw;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--av-border);
        }
        .av-brief .av-brand {
          font-family: 'Cormorant Garamond', serif;
          font-size: 19px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--av-text-primary);
          text-decoration: none;
        }
        .av-brief .av-brand span { color: var(--av-purple); font-weight: 400; }
        .av-brief .av-topbar-meta {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--av-text-dim);
        }

        .av-brief .av-section {
          position: relative;
          padding: 72px 6vw;
          border-bottom: 1px solid var(--av-border);
          overflow: hidden;
        }
        .av-brief .av-section.no-border { border-bottom: none; }
        .av-brief .av-section::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 50% at 50% -10%, rgba(94, 234, 212, 0.04), transparent 60%);
          pointer-events: none;
        }
        .av-brief .av-section > * { position: relative; z-index: 1; }
        .av-brief .av-wrap { max-width: 980px; margin: 0 auto; }

        /* Eyebrow */
        .av-brief .av-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--av-teal);
          margin-bottom: 22px;
        }
        .av-brief .av-eyebrow::before {
          content: '';
          width: 32px;
          height: 1px;
          background: var(--av-teal);
        }

        /* Hero */
        .av-brief .av-hero {
          padding-top: 90px;
          padding-bottom: 80px;
        }
        .av-brief .av-hero-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.34em;
          text-transform: uppercase;
          color: var(--av-teal);
          margin-bottom: 28px;
        }
        .av-brief .av-headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(36px, 5.2vw, 64px);
          font-weight: 500;
          line-height: 1.06;
          letter-spacing: -0.02em;
          color: var(--av-text-primary);
          max-width: 22ch;
          margin-bottom: 24px;
        }
        .av-brief .av-headline em {
          font-style: italic;
          color: var(--av-teal);
          font-weight: 500;
        }
        .av-brief .av-lede {
          font-size: clamp(15px, 1.3vw, 18px);
          font-weight: 400;
          color: var(--av-text-secondary);
          line-height: 1.6;
          max-width: 68ch;
          margin-bottom: 36px;
        }

        /* Hero stats */
        .av-brief .av-hero-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
          padding-top: 28px;
          border-top: 1px solid var(--av-border);
          max-width: 600px;
        }
        .av-brief .av-hero-stat .num {
          font-family: 'Cormorant Garamond', serif;
          font-size: 38px;
          font-weight: 500;
          line-height: 1;
          color: var(--av-teal);
          margin-bottom: 6px;
          letter-spacing: -0.02em;
        }
        .av-brief .av-hero-stat .lbl {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--av-text-muted);
        }

        /* Section titles */
        .av-brief .av-section-num {
          display: inline-block;
          font-family: 'Cormorant Garamond', serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.16em;
          color: var(--av-teal);
          text-transform: uppercase;
          margin-bottom: 16px;
        }
        .av-brief .av-section-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(28px, 3.8vw, 44px);
          font-weight: 600;
          line-height: 1.1;
          letter-spacing: -0.018em;
          color: var(--av-text-primary);
          margin-bottom: 20px;
          max-width: 24ch;
        }
        .av-brief .av-section-title .av-accent { color: var(--av-teal); }
        .av-brief .av-body {
          font-size: 16px;
          line-height: 1.7;
          color: var(--av-text-secondary);
          max-width: 70ch;
          margin-bottom: 22px;
        }
        .av-brief .av-body strong {
          color: var(--av-text-primary);
          font-weight: 600;
        }

        /* Bar chart visualizations */
        .av-brief .av-chart {
          margin: 36px 0;
          padding: 28px;
          background: var(--av-surface-elev);
          border: 1px solid var(--av-border-strong);
          border-radius: 14px;
        }
        .av-brief .av-chart-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 22px;
          padding-bottom: 18px;
          border-bottom: 1px solid var(--av-border);
        }
        .av-brief .av-chart-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--av-teal);
        }
        .av-brief .av-chart-source {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.03em;
          color: var(--av-text-dim);
          font-variant-numeric: tabular-nums;
        }
        .av-brief .av-chart-body { display: flex; flex-direction: column; gap: 10px; }

        .av-brief .av-bar-row {
          display: grid;
          grid-template-columns: 140px 1fr 90px;
          gap: 18px;
          align-items: center;
        }
        .av-brief .av-bar-name {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--av-text-secondary);
        }
        .av-brief .av-bar-name.hl { color: var(--av-text-primary); font-weight: 600; }
        .av-brief .av-bar-track {
          height: 10px;
          background: rgba(196, 200, 232, 0.06);
          border-radius: 5px;
          overflow: hidden;
        }
        .av-brief .av-bar-fill {
          height: 100%;
          background: rgba(94, 234, 212, 0.55);
          border-radius: 5px;
          transition: width 0.3s ease;
        }
        .av-brief .av-bar-fill.hl { background: rgba(94, 234, 212, 0.92); }
        .av-brief .av-bar-value {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--av-text-primary);
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .av-brief .av-bar-value.hl { color: var(--av-teal); }

        /* Data table */
        .av-brief .av-table-wrap {
          margin: 32px 0;
          background: var(--av-surface);
          border: 1px solid var(--av-border-strong);
          border-radius: 12px;
          overflow: hidden;
        }
        .av-brief .av-table {
          width: 100%;
          border-collapse: collapse;
          font-variant-numeric: tabular-nums;
        }
        .av-brief .av-table thead tr {
          border-bottom: 1px solid var(--av-border-strong);
          background: rgba(255, 255, 255, 0.02);
        }
        .av-brief .av-table th {
          padding: 14px 18px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--av-text-muted);
          text-align: right;
        }
        .av-brief .av-table th:first-child { text-align: left; }
        .av-brief .av-table td {
          padding: 13px 18px;
          font-size: 14px;
          color: var(--av-text-secondary);
          text-align: right;
          border-bottom: 1px solid rgba(196, 200, 232, 0.04);
        }
        .av-brief .av-table td:first-child { text-align: left; font-weight: 500; color: var(--av-text-primary); }
        .av-brief .av-table tbody tr:last-child td { border-bottom: none; }
        .av-brief .av-table tr.hl td { color: var(--av-teal); font-weight: 600; }
        .av-brief .av-table tr.hl td:first-child { color: var(--av-teal); }

        /* Implication block */
        .av-brief .av-implication {
          margin: 32px 0 0;
          padding: 24px 28px;
          border-left: 2px solid var(--av-teal);
          background: linear-gradient(90deg, rgba(94, 234, 212, 0.04), transparent 70%);
          border-radius: 0 8px 8px 0;
        }
        .av-brief .av-implication .av-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--av-teal);
          margin-bottom: 10px;
        }
        .av-brief .av-implication p {
          font-size: 15px;
          line-height: 1.65;
          color: var(--av-text-secondary);
          margin: 0;
        }

        /* CTA */
        .av-brief .av-cta {
          padding: 96px 6vw 100px;
          text-align: center;
          background:
            radial-gradient(ellipse 70% 60% at 50% 50%, rgba(94, 234, 212, 0.06), transparent 70%);
        }
        .av-brief .av-cta-headline {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(30px, 4.2vw, 52px);
          font-weight: 500;
          line-height: 1.1;
          letter-spacing: -0.018em;
          color: var(--av-text-primary);
          max-width: 24ch;
          margin: 22px auto 22px;
        }
        .av-brief .av-cta-headline em { font-style: italic; color: var(--av-teal); }
        .av-brief .av-cta-sub {
          font-size: 16px;
          line-height: 1.6;
          color: var(--av-text-secondary);
          max-width: 60ch;
          margin: 0 auto 38px;
        }
        .av-brief .av-cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 16px 32px;
          background: var(--av-teal);
          color: var(--av-navy-deep);
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border-radius: 8px;
          text-decoration: none;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .av-brief .av-cta-btn:hover { transform: translateY(-1px); opacity: 0.92; }

        /* Signature */
        .av-brief .av-sig {
          padding: 60px 6vw 80px;
          border-top: 1px solid var(--av-border-strong);
        }
        .av-brief .av-sig-grid {
          max-width: 980px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 40px;
          align-items: end;
        }
        .av-brief .av-sig-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.01em;
          margin-bottom: 6px;
          color: var(--av-text-primary);
        }
        .av-brief .av-sig-title {
          font-size: 12.5px;
          font-weight: 500;
          letter-spacing: 0.06em;
          color: var(--av-text-secondary);
        }
        .av-brief .av-sig-contact { text-align: right; }
        .av-brief .av-sig-contact a {
          display: block;
          font-size: 15px;
          font-weight: 500;
          color: var(--av-text-primary);
          text-decoration: none;
          margin-bottom: 6px;
        }
        .av-brief .av-sig-contact a:hover { color: var(--av-teal); }
        .av-brief .av-sig-contact .small {
          font-size: 11.5px;
          font-weight: 500;
          letter-spacing: 0.04em;
          color: var(--av-text-muted);
        }

        /* Breadcrumb */
        .av-brief .av-crumb {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--av-text-dim);
          margin-bottom: 24px;
        }
        .av-brief .av-crumb a {
          color: var(--av-text-muted);
          text-decoration: none;
        }
        .av-brief .av-crumb a:hover { color: var(--av-teal); }
        .av-brief .av-crumb span { color: var(--av-text-dim); }

        @media (max-width: 820px) {
          .av-brief .av-hero-stats { grid-template-columns: 1fr 1fr; }
          .av-brief .av-bar-row { grid-template-columns: 110px 1fr 70px; gap: 12px; }
          .av-brief .av-sig-grid { grid-template-columns: 1fr; }
          .av-brief .av-sig-contact { text-align: left; }
          .av-brief .av-table th, .av-brief .av-table td { padding: 10px 12px; font-size: 13px; }
        }
      ` }} />

      <main className="av-brief">
        {/* TOP BAR */}
        <div className="av-topbar">
          <Link href="/" className="av-brand">
            Ambrosia<span>Ventures</span>
          </Link>
          <div className="av-topbar-meta">Briefing · Deal Benchmarks · 2026</div>
        </div>

        {/* HERO */}
        <section className="av-section av-hero">
          <div className="av-wrap">
            <nav className="av-crumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <Link href="/insights">Insights</Link>
              <span>/</span>
              <span>Deal Benchmarks 2026</span>
            </nav>

            <p className="av-hero-label">Briefing · Published March 2026 · Updated May 2026</p>
            <h1 className="av-headline">
              Three patterns in 2026 biopharma deal-making — <em>and what they mean for the deals being structured right now.</em>
            </h1>
            <p className="av-lede">
              Below is the read across 3,447 verified biopharma licensing transactions (2020–Q1 2026), sourced from
              SEC EDGAR 8-K filings, FTC premerger notifications, ClinicalTrials.gov, and direct primary research. The
              three patterns most consequential for current dealmaking, in order of how often they reset our clients'
              starting expectations.
            </p>

            <div className="av-hero-stats">
              <div className="av-hero-stat">
                <div className="num">3,447</div>
                <div className="lbl">Verified Transactions</div>
              </div>
              <div className="av-hero-stat">
                <div className="num">12</div>
                <div className="lbl">Therapeutic Areas</div>
              </div>
              <div className="av-hero-stat">
                <div className="num">2020–26</div>
                <div className="lbl">Time Period</div>
              </div>
            </div>
          </div>
        </section>

        {/* INSIGHT 1 — PHASE 2 INFLECTION */}
        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 01</span>
            <h2 className="av-section-title">
              The Phase 2 inflection — <span className="av-accent">where 2.1x compresses overnight.</span>
            </h2>

            <p className="av-body">
              Phase 2 proof-of-concept is the single most valuable inflection point in biopharma deal economics.
              The Phase 1 to Phase 2 jump delivers a <strong>2.1x increase in median upfront</strong> — the largest
              single-phase multiplier in the entire development lifecycle. The risk premium compresses sharply at
              proof-of-concept, and the deal terms move with it.
            </p>

            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">Median upfront at signing, by phase</span>
                <span className="av-chart-source">USD millions · n = 1,905</span>
              </div>
              <div className="av-chart-body">
                {PHASE_LADDER.map((p) => (
                  <div key={p.phase} className="av-bar-row">
                    <span className={`av-bar-name ${p.highlight ? 'hl' : ''}`}>{p.phase}</span>
                    <div className="av-bar-track">
                      <div className={`av-bar-fill ${p.highlight ? 'hl' : ''}`} style={{ width: `${p.barPct}%` }} />
                    </div>
                    <span className={`av-bar-value ${p.highlight ? 'hl' : ''}`}>${p.upfront}M</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="av-table-wrap">
              <table className="av-table">
                <thead>
                  <tr>
                    <th>Phase at Signing</th>
                    <th>Median Upfront</th>
                    <th>Median TDV</th>
                    <th>Upfront % of TDV</th>
                    <th>n</th>
                  </tr>
                </thead>
                <tbody>
                  {PHASE_LADDER.map((p) => (
                    <tr key={p.phase} className={p.highlight ? 'hl' : ''}>
                      <td>{p.phase}</td>
                      <td>${p.upfront}M</td>
                      <td>${p.tdv.toLocaleString()}M</td>
                      <td>{p.upfrontPct}%</td>
                      <td>{p.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="av-implication">
              <div className="av-label">Implication for live processes</div>
              <p>
                A Phase 1 out-license with near-term Phase 2 data should be sequenced carefully. A 6–12 month delay
                to clear proof-of-concept can unlock <strong>more than $150M in additional upfront value</strong>.
                For asset owners considering whether to run a process pre- or post-readout, the multiple is
                rarely worth the development risk only when later-stage capital is genuinely uncertain.
              </p>
            </div>
          </div>
        </section>

        {/* INSIGHT 2 — IMMUNOLOGY PREMIUM */}
        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 02</span>
            <h2 className="av-section-title">
              The therapeutic-area premium has <span className="av-accent">flipped at Phase 2.</span>
            </h2>

            <p className="av-body">
              The conventional view that oncology commands the highest deal premiums is no longer true at Phase 2.
              Immunology and metabolic deals are being repriced in real-time by <strong>TL1A antibodies, oral GLP-1
              programs, and validated $10B+ commercial models</strong>. The Phase 2 immunology median upfront is now
              4.4x the oncology median.
            </p>

            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">Phase 2 median upfront, by therapeutic area</span>
                <span className="av-chart-source">USD millions · top 4 by Phase 2 deal count</span>
              </div>
              <div className="av-chart-body">
                {TA_PHASE2.map((t) => (
                  <div key={t.ta} className="av-bar-row">
                    <span className={`av-bar-name ${t.highlight ? 'hl' : ''}`}>{t.ta}</span>
                    <div className="av-bar-track">
                      <div className={`av-bar-fill ${t.highlight ? 'hl' : ''}`} style={{ width: `${t.barPct}%` }} />
                    </div>
                    <span className={`av-bar-value ${t.highlight ? 'hl' : ''}`}>${t.p2Upfront.toLocaleString()}M</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="av-table-wrap">
              <table className="av-table">
                <thead>
                  <tr>
                    <th>Therapeutic Area</th>
                    <th>Phase 2 Upfront</th>
                    <th>Phase 3 Upfront</th>
                    <th>Ph2 → Ph3 Multiple</th>
                  </tr>
                </thead>
                <tbody>
                  {TA_PHASE2.map((t) => (
                    <tr key={t.ta} className={t.highlight ? 'hl' : ''}>
                      <td>{t.ta}</td>
                      <td>${t.p2Upfront.toLocaleString()}M</td>
                      <td>${t.p3Upfront.toLocaleString()}M</td>
                      <td>{t.multiple}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="av-implication">
              <div className="av-label">Implication for live processes</div>
              <p>
                A Phase 2 immunology asset can out-value a Phase 3 oncology asset on upfront alone. For asset owners
                with multi-TA pipelines, deal sequencing should account for these premiums explicitly — running an
                immunology process ahead of an oncology process can shift the firm's overall upfront capture by
                meaningful multiples.
              </p>
            </div>
          </div>
        </section>

        {/* INSIGHT 3 — ADC NORMALIZATION */}
        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 03</span>
            <h2 className="av-section-title">
              ADC deal-making peaked at $372B in 2023 — <span className="av-accent">then normalized.</span>
            </h2>

            <p className="av-body">
              2023 was a once-in-a-generation moment for ADC dealmaking, driven by the <strong>$43B Pfizer–Seagen
              acquisition</strong> and a wave of platform-level mega-deals. Deal volume has continued to grow, but
              the era of acquiring the platform has given way to focused single-asset licensing. ADCs nevertheless
              remain the highest-valued modality on upfront — the premium is real, just structured differently.
            </p>

            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">ADC deal volume, by year</span>
                <span className="av-chart-source">Total deal value, USD billions</span>
              </div>
              <div className="av-chart-body">
                {ADC_YEARS.map((y) => (
                  <div key={y.year} className="av-bar-row">
                    <span className={`av-bar-name ${y.highlight ? 'hl' : ''}`}>{y.year}</span>
                    <div className="av-bar-track">
                      <div className={`av-bar-fill ${y.highlight ? 'hl' : ''}`} style={{ width: `${y.barPct}%` }} />
                    </div>
                    <span className={`av-bar-value ${y.highlight ? 'hl' : ''}`}>${y.total}B</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="av-table-wrap">
              <table className="av-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>ADC Deals</th>
                    <th>Median TDV</th>
                    <th>Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {ADC_YEARS.map((y) => (
                    <tr key={y.year} className={y.highlight ? 'hl' : ''}>
                      <td>{y.year}</td>
                      <td>{y.deals}</td>
                      <td>${y.tdv.toLocaleString()}M</td>
                      <td>${y.total}B</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="av-body" style={{ marginTop: '32px' }}>
              Despite the normalization in total value, ADCs remain the highest-valued modality on upfront — outpacing
              bispecifics, mRNA, and gene therapy:
            </p>

            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">Median upfront, by modality (2024–2026)</span>
                <span className="av-chart-source">USD millions · Phase 2 deals</span>
              </div>
              <div className="av-chart-body">
                {MODALITY_UPFRONT.map((m) => (
                  <div key={m.name} className="av-bar-row">
                    <span className={`av-bar-name ${m.highlight ? 'hl' : ''}`}>{m.name}</span>
                    <div className="av-bar-track">
                      <div className={`av-bar-fill ${m.highlight ? 'hl' : ''}`} style={{ width: `${m.barPct}%` }} />
                    </div>
                    <span className={`av-bar-value ${m.highlight ? 'hl' : ''}`}>${m.upfront}M</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="av-implication">
              <div className="av-label">Implication for ADC licensors</div>
              <p>
                The market has shifted from <em>"acquire the platform"</em> to <em>"license the best asset"</em>.
                Positioning should focus on target differentiation, payload novelty, and Phase 2 data quality —
                that's where the upfront premium has migrated to. Platform-level pitches now run cold.
              </p>
            </div>
          </div>
        </section>

        {/* CTA — INTRO BRIEFING */}
        <section className="av-section av-cta no-border">
          <div className="av-wrap">
            <p className="av-hero-label">Begin the conversation</p>
            <h2 className="av-cta-headline">
              For a live read on <em>your</em> deal — at peer level.
            </h2>
            <p className="av-cta-sub">
              Twenty minutes is usually enough to know if there's a fit. Confidential, no-obligation conversation
              about the specific deal context where outside transaction perspective would be useful.
            </p>
            <a href={SCHEDULE_URL} className="av-cta-btn">
              Schedule a Briefing Call
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </section>

        {/* SIGNATURE */}
        <section className="av-sig">
          <div className="av-sig-grid">
            <div>
              <div className="av-sig-name">Issa Kildani</div>
              <div className="av-sig-title">Managing Partner · Ambrosia Ventures</div>
            </div>
            <div className="av-sig-contact">
              <a href="mailto:issa@ambrosiaventures.co">issa@ambrosiaventures.co</a>
              <div className="small">
                ambrosiaventures.co &nbsp;·&nbsp; Detroit &nbsp;·&nbsp; New York &nbsp;·&nbsp; Global
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
