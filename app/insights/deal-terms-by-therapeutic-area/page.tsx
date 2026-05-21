import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://calculator.ambrosiaventures.co';
const CANONICAL = `${BASE_URL}/insights/deal-terms-by-therapeutic-area`;

export const metadata: Metadata = {
  title: 'Biopharma Deal Terms by Therapeutic Area — A 12-TA Comparison | Ambrosia Ventures',
  description:
    'Compare biopharma licensing deal benchmarks across 12 therapeutic areas. Metabolic/obesity commands $4.5B Phase 3 medians; immunology leads Phase 2 at $1.25B; oncology has compressed. Ambrosia Ventures briefing.',
  keywords: [
    'deal terms by therapeutic area', 'biopharma TA benchmarks', 'metabolic deal premium',
    'immunology deal premium', 'oncology deal benchmarks', 'biotech M&A advisory',
  ],
  openGraph: {
    title: 'Biopharma Deal Terms by Therapeutic Area — 12-TA Comparison',
    description: 'Metabolic leads at $4.5B Phase 3. Immunology Phase 2 at $1.25B. Oncology compressed.',
    type: 'article',
    url: CANONICAL,
    siteName: 'Ambrosia Ventures',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Deal Terms by TA — 12 TAs Compared',
    description: 'Where the premiums actually sit in biopharma BD math, by TA.',
  },
  alternates: { canonical: CANONICAL },
};

const P2_BY_TA = [
  { ta: 'Metabolic / Obesity', upfront: 1300, barPct: 100, highlight: true },
  { ta: 'Immunology', upfront: 1250, barPct: 96, highlight: true },
  { ta: 'Rare Disease', upfront: 320, barPct: 25 },
  { ta: 'Neurology / CNS', upfront: 302, barPct: 23 },
  { ta: 'Oncology', upfront: 281, barPct: 22 },
  { ta: 'Hematology', upfront: 220, barPct: 17 },
  { ta: 'Cardiovascular', upfront: 175, barPct: 13 },
  { ta: 'Infectious Disease', upfront: 140, barPct: 11 },
  { ta: 'Ophthalmology', upfront: 130, barPct: 10 },
  { ta: 'Dermatology', upfront: 110, barPct: 8 },
  { ta: 'Gastroenterology', upfront: 95, barPct: 7 },
  { ta: "Women's Health", upfront: 75, barPct: 6 },
];

const P3_BY_TA = [
  { ta: 'Metabolic / Obesity', upfront: 4500, barPct: 100, highlight: true },
  { ta: 'Immunology', upfront: 3200, barPct: 71, highlight: true },
  { ta: 'Rare Disease', upfront: 900, barPct: 20 },
  { ta: 'Neurology / CNS', upfront: 838, barPct: 19 },
  { ta: 'Oncology', upfront: 714, barPct: 16 },
  { ta: 'Hematology', upfront: 580, barPct: 13 },
  { ta: 'Cardiovascular', upfront: 470, barPct: 10 },
  { ta: 'Ophthalmology', upfront: 380, barPct: 8 },
  { ta: 'Infectious Disease', upfront: 340, barPct: 8 },
  { ta: 'Dermatology', upfront: 290, barPct: 6 },
  { ta: 'Gastroenterology', upfront: 240, barPct: 5 },
  { ta: "Women's Health", upfront: 180, barPct: 4 },
];

const MARQUEE_DEALS = [
  { ta: 'Metabolic / Obesity', deal: 'Roche–Carmot ($2.7B upfront, GLP-1, Dec 2023)' },
  { ta: 'Immunology', deal: 'Merck–Prometheus ($10.8B, TL1A platform, 2023)' },
  { ta: 'Oncology', deal: 'BMS–Karuna ($14B acquisition, KarXT, 2023)' },
  { ta: 'Rare Disease', deal: 'Pfizer–Biohaven ($11.6B acquisition, migraine, 2022)' },
  { ta: 'Cardiovascular', deal: 'BMS–MyoKardia ($13.1B, mavacamten, 2020)' },
  { ta: 'Hematology', deal: 'Pfizer–Seagen ($43B ADC platform, 2023)' },
  { ta: 'Neurology / CNS', deal: 'AbbVie–Cerevel ($8.7B, neuropsych, 2023)' },
  { ta: 'Ophthalmology', deal: 'Astellas–Iveric ($5.9B, geographic atrophy, 2023)' },
];

const SCHEDULE_URL = 'mailto:issa@ambrosiaventures.co?subject=Briefing%20Call%20%E2%80%94%20TA%20Deal%20Terms&body=Issa%20%E2%80%94%20saw%20the%20TA%20benchmarks%20briefing.%20Available%20to%20speak%20on%3A%20';

export default function TADealTermsBriefing() {
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: 'Biopharma Deal Terms by Therapeutic Area — A 12-TA Comparison',
    description: 'Comparative deal benchmarks across 12 therapeutic areas at Phase 2 and Phase 3.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` } },
    datePublished: '2026-03-25', dateModified: '2026-05-20',
    mainEntityOfPage: CANONICAL, articleSection: 'Biopharma Deal Intelligence',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <style dangerouslySetInnerHTML={{ __html: AV_BRIEF_CSS }} />

      <main className="av-brief">
        <div className="av-topbar">
          <Link href="/" className="av-brand">Ambrosia<span>Ventures</span></Link>
          <div className="av-topbar-meta">Briefing · TA Comparison · 2026</div>
        </div>

        <section className="av-section av-hero">
          <div className="av-wrap">
            <nav className="av-crumb">
              <Link href="/">Home</Link><span>/</span>
              <Link href="/insights">Insights</Link><span>/</span>
              <span>Deal Terms by TA</span>
            </nav>
            <p className="av-hero-label">Briefing · Updated May 2026</p>
            <h1 className="av-headline">
              How deal terms actually differ across <em>12 therapeutic areas.</em>
            </h1>
            <p className="av-lede">
              The therapeutic area you operate in is the single largest exogenous driver of deal economics. Across
              2,500+ verified transactions, the spread between the highest-priced TA (metabolic at $1.3B Phase 2
              median) and the lowest (women's health at $75M) is more than 17x. Below is the read at Phase 2 and
              Phase 3, with marquee deals that anchor each TA's negotiating range.
            </p>
            <div className="av-hero-stats">
              <div className="av-hero-stat"><div className="num">17x</div><div className="lbl">Highest to Lowest TA Spread</div></div>
              <div className="av-hero-stat"><div className="num">12</div><div className="lbl">Therapeutic Areas Tracked</div></div>
              <div className="av-hero-stat"><div className="num">2,500+</div><div className="lbl">Verified Transactions</div></div>
            </div>
          </div>
        </section>

        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 01</span>
            <h2 className="av-section-title">Phase 2 upfronts <span className="av-accent">vary 17x across TAs.</span></h2>
            <p className="av-body">
              Metabolic/obesity ($1.3B) and immunology ($1.25B) lead Phase 2 dealmaking by a wide margin — driven
              by the GLP-1 wave and TL1A-class antibody validation respectively. <strong>Oncology, despite being the
              highest-volume TA, has compressed to $281M Phase 2 median</strong>. Rare disease and neurology cluster
              in the middle. Women's health, gastroenterology, and dermatology trail.
            </p>
            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">Phase 2 median upfront, by therapeutic area</span>
                <span className="av-chart-source">USD millions · n = 426</span>
              </div>
              <div className="av-chart-body">
                {P2_BY_TA.map((t) => (
                  <div key={t.ta} className="av-bar-row">
                    <span className={`av-bar-name ${t.highlight ? 'hl' : ''}`}>{t.ta}</span>
                    <div className="av-bar-track">
                      <div className={`av-bar-fill ${t.highlight ? 'hl' : ''}`} style={{ width: `${t.barPct}%` }} />
                    </div>
                    <span className={`av-bar-value ${t.highlight ? 'hl' : ''}`}>${t.upfront.toLocaleString()}M</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="av-implication">
              <div className="av-label">Implication for asset owners</div>
              <p>
                A Phase 2 metabolic asset can out-value a Phase 3 oncology asset on upfront alone. For platform
                biotechs operating across multiple TAs, the BD sequencing decision is structural: anchor the
                conversation in your highest-priced TA first to set comparable expectations for the rest of the
                portfolio.
              </p>
            </div>
          </div>
        </section>

        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 02</span>
            <h2 className="av-section-title">Phase 3 widens the gap, <span className="av-accent">it doesn't compress it.</span></h2>
            <p className="av-body">
              The TA premium persists — and amplifies — at Phase 3. Metabolic reaches a <strong>$4.5B Phase 3 median
              upfront, 25x the women's-health figure</strong>. Immunology's $3.2B is 4.5x oncology's $714M. The
              market is rewarding TAs with commercial-stage validation (Mounjaro, Zepbound, dupilumab class) and
              punishing TAs where commercial peaks remain uncertain or capped.
            </p>
            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">Phase 3 median upfront, by therapeutic area</span>
                <span className="av-chart-source">USD millions · n = 345</span>
              </div>
              <div className="av-chart-body">
                {P3_BY_TA.map((t) => (
                  <div key={t.ta} className="av-bar-row">
                    <span className={`av-bar-name ${t.highlight ? 'hl' : ''}`}>{t.ta}</span>
                    <div className="av-bar-track">
                      <div className={`av-bar-fill ${t.highlight ? 'hl' : ''}`} style={{ width: `${t.barPct}%` }} />
                    </div>
                    <span className={`av-bar-value ${t.highlight ? 'hl' : ''}`}>${t.upfront.toLocaleString()}M</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="av-implication">
              <div className="av-label">Implication for live processes</div>
              <p>
                The TA-specific Phase 2 → Phase 3 multiplier compounds with the underlying TA premium. A metabolic
                asset that holds through Phase 3 captures both the 3.5x phase multiple <strong>and</strong> the $4.5B
                Phase 3 anchor — meaningfully more than oncology Phase 3's $714M. Timing strategy needs to be
                modeled at the TA level, not industry-wide.
              </p>
            </div>
          </div>
        </section>

        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 03</span>
            <h2 className="av-section-title">Marquee deals <span className="av-accent">anchor TA-specific ranges.</span></h2>
            <p className="av-body">
              Every BD conversation lives in the shadow of the marquee deal in that TA. The negotiating counterparty
              has them in mind; the asset owner should too. Below is the reference deal that most often comes up in
              each TA — the one that resets buyer expectations and creates anchor points for current term-sheet
              discussions.
            </p>
            <div className="av-table-wrap">
              <table className="av-table">
                <thead>
                  <tr><th>Therapeutic Area</th><th style={{ textAlign: 'left' }}>Marquee Deal</th></tr>
                </thead>
                <tbody>
                  {MARQUEE_DEALS.map((m) => (
                    <tr key={m.ta}>
                      <td>{m.ta}</td>
                      <td style={{ textAlign: 'left', color: 'var(--av-text-secondary)' }}>{m.deal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="av-implication">
              <div className="av-label">Implication for the negotiation</div>
              <p>
                If you're walking into a TL1A immunology conversation without the Prometheus comp in your head,
                you've ceded the anchor. The right BD prep cites the marquee deal upfront, frames your asset
                relative to that comparable, and forces the counterparty to argue with the precedent rather than
                with you.
              </p>
            </div>
          </div>
        </section>

        <section className="av-section av-cta no-border">
          <div className="av-wrap">
            <p className="av-hero-label">Begin the conversation</p>
            <h2 className="av-cta-headline">For a live read on <em>your</em> TA-specific deal — at peer level.</h2>
            <p className="av-cta-sub">
              Twenty minutes is usually enough to pressure-test where your asset sits in the TA distribution.
              Confidential, no-obligation conversation.
            </p>
            <a href={SCHEDULE_URL} className="av-cta-btn">
              Schedule a Briefing Call
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </section>

        <section className="av-sig">
          <div className="av-sig-grid">
            <div>
              <div className="av-sig-name">Issa Kildani</div>
              <div className="av-sig-title">Managing Partner · Ambrosia Ventures</div>
            </div>
            <div className="av-sig-contact">
              <a href="mailto:issa@ambrosiaventures.co">issa@ambrosiaventures.co</a>
              <div className="small">ambrosiaventures.co &nbsp;·&nbsp; Detroit &nbsp;·&nbsp; New York &nbsp;·&nbsp; Global</div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

const AV_BRIEF_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700;800&display=swap');
.av-brief { --av-navy-deep: #0a0d1b; --av-navy: #1a1e42; --av-purple: #8b8eb5; --av-teal: #5eead4; --av-text-primary: #ffffff; --av-text-secondary: #c4c8e8; --av-text-muted: #8b8eb5; --av-text-dim: #5a5e7e; --av-border: rgba(196, 200, 232, 0.08); --av-border-strong: rgba(196, 200, 232, 0.18); --av-surface: rgba(255, 255, 255, 0.02); --av-surface-elev: rgba(255, 255, 255, 0.04); background: var(--av-navy-deep); color: var(--av-text-primary); font-family: 'Inter', -apple-system, system-ui, sans-serif; font-weight: 400; -webkit-font-smoothing: antialiased; min-height: 100vh; }
.av-brief * { box-sizing: border-box; }
.av-brief .av-topbar { padding: 16px 6vw; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--av-border); }
.av-brief .av-brand { font-family: 'Cormorant Garamond', serif; font-size: 19px; font-weight: 600; letter-spacing: -0.01em; color: var(--av-text-primary); text-decoration: none; }
.av-brief .av-brand span { color: var(--av-purple); font-weight: 400; }
.av-brief .av-topbar-meta { font-size: 10px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: var(--av-text-dim); }
.av-brief .av-section { position: relative; padding: 72px 6vw; border-bottom: 1px solid var(--av-border); overflow: hidden; }
.av-brief .av-section.no-border { border-bottom: none; }
.av-brief .av-section::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 70% 50% at 50% -10%, rgba(94, 234, 212, 0.04), transparent 60%); pointer-events: none; }
.av-brief .av-section > * { position: relative; z-index: 1; }
.av-brief .av-wrap { max-width: 980px; margin: 0 auto; }
.av-brief .av-hero { padding-top: 90px; padding-bottom: 80px; }
.av-brief .av-hero-label { font-size: 10px; font-weight: 700; letter-spacing: 0.34em; text-transform: uppercase; color: var(--av-teal); margin-bottom: 28px; }
.av-brief .av-headline { font-family: 'Cormorant Garamond', serif; font-size: clamp(36px, 5.2vw, 64px); font-weight: 500; line-height: 1.06; letter-spacing: -0.02em; color: var(--av-text-primary); max-width: 22ch; margin-bottom: 24px; }
.av-brief .av-headline em { font-style: italic; color: var(--av-teal); font-weight: 500; }
.av-brief .av-lede { font-size: clamp(15px, 1.3vw, 18px); font-weight: 400; color: var(--av-text-secondary); line-height: 1.6; max-width: 68ch; margin-bottom: 36px; }
.av-brief .av-hero-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; padding-top: 28px; border-top: 1px solid var(--av-border); max-width: 600px; }
.av-brief .av-hero-stat .num { font-family: 'Cormorant Garamond', serif; font-size: 38px; font-weight: 500; line-height: 1; color: var(--av-teal); margin-bottom: 6px; letter-spacing: -0.02em; }
.av-brief .av-hero-stat .lbl { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--av-text-muted); }
.av-brief .av-section-num { display: inline-block; font-family: 'Cormorant Garamond', serif; font-size: 14px; font-weight: 700; letter-spacing: 0.16em; color: var(--av-teal); text-transform: uppercase; margin-bottom: 16px; }
.av-brief .av-section-title { font-family: 'Cormorant Garamond', serif; font-size: clamp(28px, 3.8vw, 44px); font-weight: 600; line-height: 1.1; letter-spacing: -0.018em; color: var(--av-text-primary); margin-bottom: 20px; max-width: 24ch; }
.av-brief .av-section-title .av-accent { color: var(--av-teal); }
.av-brief .av-body { font-size: 16px; line-height: 1.7; color: var(--av-text-secondary); max-width: 70ch; margin-bottom: 22px; }
.av-brief .av-body strong { color: var(--av-text-primary); font-weight: 600; }
.av-brief .av-chart { margin: 36px 0; padding: 28px; background: var(--av-surface-elev); border: 1px solid var(--av-border-strong); border-radius: 14px; }
.av-brief .av-chart-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid var(--av-border); }
.av-brief .av-chart-title { font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--av-teal); }
.av-brief .av-chart-source { font-size: 11px; font-weight: 500; letter-spacing: 0.03em; color: var(--av-text-dim); font-variant-numeric: tabular-nums; }
.av-brief .av-chart-body { display: flex; flex-direction: column; gap: 10px; }
.av-brief .av-bar-row { display: grid; grid-template-columns: 180px 1fr 100px; gap: 18px; align-items: center; }
.av-brief .av-bar-name { font-size: 13.5px; font-weight: 500; color: var(--av-text-secondary); }
.av-brief .av-bar-name.hl { color: var(--av-text-primary); font-weight: 600; }
.av-brief .av-bar-track { height: 10px; background: rgba(196, 200, 232, 0.06); border-radius: 5px; overflow: hidden; }
.av-brief .av-bar-fill { height: 100%; background: rgba(94, 234, 212, 0.55); border-radius: 5px; transition: width 0.3s ease; }
.av-brief .av-bar-fill.hl { background: rgba(94, 234, 212, 0.92); }
.av-brief .av-bar-value { font-size: 13.5px; font-weight: 600; color: var(--av-text-primary); text-align: right; font-variant-numeric: tabular-nums; }
.av-brief .av-bar-value.hl { color: var(--av-teal); }
.av-brief .av-table-wrap { margin: 32px 0; background: var(--av-surface); border: 1px solid var(--av-border-strong); border-radius: 12px; overflow: hidden; }
.av-brief .av-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.av-brief .av-table thead tr { border-bottom: 1px solid var(--av-border-strong); background: rgba(255, 255, 255, 0.02); }
.av-brief .av-table th { padding: 14px 18px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--av-text-muted); text-align: right; }
.av-brief .av-table th:first-child { text-align: left; }
.av-brief .av-table td { padding: 13px 18px; font-size: 14px; color: var(--av-text-secondary); text-align: right; border-bottom: 1px solid rgba(196, 200, 232, 0.04); }
.av-brief .av-table td:first-child { text-align: left; font-weight: 500; color: var(--av-text-primary); }
.av-brief .av-table tbody tr:last-child td { border-bottom: none; }
.av-brief .av-table tr.hl td { color: var(--av-teal); font-weight: 600; }
.av-brief .av-table tr.hl td:first-child { color: var(--av-teal); }
.av-brief .av-implication { margin: 32px 0 0; padding: 24px 28px; border-left: 2px solid var(--av-teal); background: linear-gradient(90deg, rgba(94, 234, 212, 0.04), transparent 70%); border-radius: 0 8px 8px 0; }
.av-brief .av-implication .av-label { font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--av-teal); margin-bottom: 10px; }
.av-brief .av-implication p { font-size: 15px; line-height: 1.65; color: var(--av-text-secondary); margin: 0; }
.av-brief .av-cta { padding: 96px 6vw 100px; text-align: center; background: radial-gradient(ellipse 70% 60% at 50% 50%, rgba(94, 234, 212, 0.06), transparent 70%); }
.av-brief .av-cta-headline { font-family: 'Cormorant Garamond', serif; font-size: clamp(30px, 4.2vw, 52px); font-weight: 500; line-height: 1.1; letter-spacing: -0.018em; color: var(--av-text-primary); max-width: 24ch; margin: 22px auto 22px; }
.av-brief .av-cta-headline em { font-style: italic; color: var(--av-teal); }
.av-brief .av-cta-sub { font-size: 16px; line-height: 1.6; color: var(--av-text-secondary); max-width: 60ch; margin: 0 auto 38px; }
.av-brief .av-cta-btn { display: inline-flex; align-items: center; gap: 10px; padding: 16px 32px; background: var(--av-teal); color: var(--av-navy-deep); font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; border-radius: 8px; text-decoration: none; transition: transform 0.15s ease, opacity 0.15s ease; }
.av-brief .av-cta-btn:hover { transform: translateY(-1px); opacity: 0.92; }
.av-brief .av-sig { padding: 60px 6vw 80px; border-top: 1px solid var(--av-border-strong); }
.av-brief .av-sig-grid { max-width: 980px; margin: 0 auto; display: grid; grid-template-columns: 1fr auto; gap: 40px; align-items: end; }
.av-brief .av-sig-name { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 600; letter-spacing: -0.01em; margin-bottom: 6px; color: var(--av-text-primary); }
.av-brief .av-sig-title { font-size: 12.5px; font-weight: 500; letter-spacing: 0.06em; color: var(--av-text-secondary); }
.av-brief .av-sig-contact { text-align: right; }
.av-brief .av-sig-contact a { display: block; font-size: 15px; font-weight: 500; color: var(--av-text-primary); text-decoration: none; margin-bottom: 6px; }
.av-brief .av-sig-contact a:hover { color: var(--av-teal); }
.av-brief .av-sig-contact .small { font-size: 11.5px; font-weight: 500; letter-spacing: 0.04em; color: var(--av-text-muted); }
.av-brief .av-crumb { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--av-text-dim); margin-bottom: 24px; }
.av-brief .av-crumb a { color: var(--av-text-muted); text-decoration: none; }
.av-brief .av-crumb a:hover { color: var(--av-teal); }
.av-brief .av-crumb span { color: var(--av-text-dim); }
@media (max-width: 820px) { .av-brief .av-hero-stats { grid-template-columns: 1fr 1fr; } .av-brief .av-bar-row { grid-template-columns: 130px 1fr 80px; gap: 12px; } .av-brief .av-sig-grid { grid-template-columns: 1fr; } .av-brief .av-sig-contact { text-align: left; } .av-brief .av-table th, .av-brief .av-table td { padding: 10px 12px; font-size: 13px; } }
`;
