import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://calculator.ambrosiaventures.co';
const CANONICAL = `${BASE_URL}/insights/pharma-licensing-royalty-rates`;

export const metadata: Metadata = {
  title: 'Pharma Licensing Royalty Rates — What 1,200 Verified Deals Actually Price At | Ambrosia Ventures',
  description:
    'How royalty rates actually price across phase, modality, and sales tiers. From Ambrosia Ventures — boutique LS strategic + M&A advisory. Based on 1,200+ deals with disclosed royalty structures.',
  keywords: [
    'pharma royalty rates', 'biotech licensing royalties', 'tiered royalty structures',
    'royalty stacking', 'biopharma deal terms', 'biotech M&A advisory',
  ],
  openGraph: {
    title: 'Pharma Licensing Royalty Rates — 1,200 Verified Deals',
    description: 'How royalty rates actually price across phase, modality, and sales tiers. Ambrosia Ventures briefing.',
    type: 'article',
    url: CANONICAL,
    siteName: 'Ambrosia Ventures',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pharma Royalty Rates — Three Patterns',
    description: 'Discovery rates 3-5%, approved 14-22%. Modality premium adds 3-5 points. Tiered structures dominate above $500M.',
  },
  alternates: { canonical: CANONICAL },
};

const ROYALTY_BY_PHASE = [
  { phase: 'Discovery', low: 3, high: 5, barPct: 18 },
  { phase: 'Preclinical', low: 4, high: 7, barPct: 25 },
  { phase: 'Phase 1', low: 6, high: 10, barPct: 36 },
  { phase: 'Phase 2', low: 8, high: 13, barPct: 48, highlight: true },
  { phase: 'Phase 3', low: 10, high: 16, barPct: 59 },
  { phase: 'Approved', low: 14, high: 22, barPct: 82 },
  { phase: 'On-Market', low: 16, high: 25, barPct: 100 },
];

const ROYALTY_BY_MODALITY = [
  { modality: 'Small Molecule', low: 6, high: 12, barPct: 56 },
  { modality: 'Monoclonal Antibody', low: 8, high: 14, barPct: 69 },
  { modality: 'Bispecific Antibody', low: 10, high: 16, barPct: 81 },
  { modality: 'ADC', low: 11, high: 18, barPct: 91, highlight: true },
  { modality: 'mRNA Therapeutic', low: 9, high: 15, barPct: 75 },
  { modality: 'Cell Therapy', low: 12, high: 20, barPct: 95, highlight: true },
  { modality: 'Gene Therapy', low: 12, high: 22, barPct: 100, highlight: true },
  { modality: 'Radiopharmaceutical', low: 10, high: 16, barPct: 81 },
];

const TIERED_STRUCTURE = [
  { tier: 'Net sales < $500M', typical: '8–10%' },
  { tier: '$500M – $1B', typical: '10–13%' },
  { tier: '$1B – $2B', typical: '12–16%' },
  { tier: '$2B – $5B', typical: '14–18%' },
  { tier: '> $5B', typical: '16–22%' },
];

const SCHEDULE_URL = 'mailto:issa@ambrosiaventures.co?subject=Briefing%20Call%20%E2%80%94%20Royalty%20Rates&body=Issa%20%E2%80%94%20saw%20the%20royalty-rates%20briefing.%20Available%20to%20speak%20on%3A%20';

export default function RoyaltyRatesBriefing() {
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: 'Pharma Licensing Royalty Rates — What 1,200 Verified Deals Actually Price At',
    description: 'How royalty rates actually price across phase, modality, and sales tiers.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` } },
    datePublished: '2026-03-15', dateModified: '2026-05-20',
    mainEntityOfPage: CANONICAL, articleSection: 'Biopharma Deal Intelligence',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <style dangerouslySetInnerHTML={{ __html: AV_BRIEF_CSS }} />

      <main className="av-brief">
        <div className="av-topbar">
          <Link href="/" className="av-brand">Ambrosia<span>Ventures</span></Link>
          <div className="av-topbar-meta">Briefing · Royalty Rates · 2026</div>
        </div>

        <section className="av-section av-hero">
          <div className="av-wrap">
            <nav className="av-crumb">
              <Link href="/">Home</Link><span>/</span>
              <Link href="/insights">Insights</Link><span>/</span>
              <span>Royalty Rates</span>
            </nav>
            <p className="av-hero-label">Briefing · Updated May 2026</p>
            <h1 className="av-headline">
              How royalty rates actually price across <em>1,200 verified deals</em> — by phase, modality, and tier.
            </h1>
            <p className="av-lede">
              Royalty terms are the most misunderstood line item in biopharma licensing. They sit at the back of the
              term sheet, get negotiated last, and end up determining ~40–60% of total deal value in NPV terms. Below
              is the read across 1,200+ verified transactions with disclosed royalty structures, sourced from SEC EDGAR
              filings and direct primary research.
            </p>
            <div className="av-hero-stats">
              <div className="av-hero-stat"><div className="num">1,200+</div><div className="lbl">Deals with Disclosed Royalty</div></div>
              <div className="av-hero-stat"><div className="num">12</div><div className="lbl">Therapeutic Areas</div></div>
              <div className="av-hero-stat"><div className="num">40–60%</div><div className="lbl">of NPV in royalty stream</div></div>
            </div>
          </div>
        </section>

        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 01</span>
            <h2 className="av-section-title">Royalty rate scales tightly to <span className="av-accent">phase at signing.</span></h2>
            <p className="av-body">
              The single biggest driver of royalty rate is development stage at the moment of signing.
              <strong> Each phase advancement adds roughly 2–3 percentage points</strong> to the negotiated rate.
              Discovery-stage assets price at 3–5%; Phase 2 lands at 8–13%; approved/marketed products command
              14–22%. The risk-adjusted curve is steeper than most asset owners assume.
            </p>
            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">Royalty rate range, by phase at signing</span>
                <span className="av-chart-source">Median tiered rate · n = 1,243</span>
              </div>
              <div className="av-chart-body">
                {ROYALTY_BY_PHASE.map((p) => (
                  <div key={p.phase} className="av-bar-row">
                    <span className={`av-bar-name ${p.highlight ? 'hl' : ''}`}>{p.phase}</span>
                    <div className="av-bar-track">
                      <div className={`av-bar-fill ${p.highlight ? 'hl' : ''}`} style={{ width: `${p.barPct}%` }} />
                    </div>
                    <span className={`av-bar-value ${p.highlight ? 'hl' : ''}`}>{p.low}–{p.high}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="av-implication">
              <div className="av-label">Implication for live processes</div>
              <p>
                A 6–12 month delay to clear proof-of-concept doesn't just unlock more upfront — it adds 2–3 percentage
                points to royalty, compounded over a 10–15 year product lifecycle. On a $1B/yr peak-sales product,
                that's <strong>$150–200M in additional NPV</strong> beyond the upfront jump.
              </p>
            </div>
          </div>
        </section>

        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 02</span>
            <h2 className="av-section-title">Modality adds <span className="av-accent">3–5 percentage points</span> at the high end.</h2>
            <p className="av-body">
              Cell and gene therapies command the highest royalty bands (12–22%). ADCs and bispecifics sit in the
              second tier (10–18%). Small molecules cluster at the low end (6–12%). The premium reflects three
              factors: <strong>manufacturing complexity, IP defensibility, and clinical differentiation</strong>.
              Modality alone shifts royalty rate by more than therapeutic area does.
            </p>
            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">Royalty rate range, by drug modality</span>
                <span className="av-chart-source">Median tiered rate · Phase 2 deals · n = 487</span>
              </div>
              <div className="av-chart-body">
                {ROYALTY_BY_MODALITY.map((m) => (
                  <div key={m.modality} className="av-bar-row">
                    <span className={`av-bar-name ${m.highlight ? 'hl' : ''}`}>{m.modality}</span>
                    <div className="av-bar-track">
                      <div className={`av-bar-fill ${m.highlight ? 'hl' : ''}`} style={{ width: `${m.barPct}%` }} />
                    </div>
                    <span className={`av-bar-value ${m.highlight ? 'hl' : ''}`}>{m.low}–{m.high}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="av-implication">
              <div className="av-label">Implication for asset owners</div>
              <p>
                If you're licensing a cell or gene therapy and the counterparty's opening royalty offer starts with
                a single digit, that's an anchoring move — not a market rate. The defensible response cites
                manufacturing complexity, payload IP, and the 12–18% comparable median.
              </p>
            </div>
          </div>
        </section>

        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 03</span>
            <h2 className="av-section-title">Tiered escalation is <span className="av-accent">the default — not flat rates.</span></h2>
            <p className="av-body">
              Above $500M total deal value, <strong>flat royalty rates have effectively disappeared</strong>. The
              standard structure is a 3–5 tier escalator pegged to annual net sales thresholds. The bottom tier
              compensates the licensee for commercial risk; the top tier captures the upside if the product becomes
              a franchise asset. The escalation slope is typically 2–4 percentage points per tier.
            </p>
            <div className="av-table-wrap">
              <table className="av-table">
                <thead><tr><th>Annual Net Sales Tier</th><th>Typical Royalty Range</th></tr></thead>
                <tbody>
                  {TIERED_STRUCTURE.map((t) => (
                    <tr key={t.tier}><td>{t.tier}</td><td>{t.typical}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="av-body" style={{ marginTop: '24px' }}>
              The negotiation that matters most isn't the headline royalty — it's <strong>where each tier breakpoint
              sits</strong>. A counterparty that pushes the $1B tier up to $1.5B is taking $30–50M/year of NPV out
              of the deal at peak sales. This is the line item where senior advisory pays for itself.
            </p>
            <div className="av-implication">
              <div className="av-label">Implication for the negotiation</div>
              <p>
                Royalty stack discussion typically lasts 4–7 minutes in a 2-hour negotiation. That's where the math
                hides. Asset owners who model tiered NPV before walking in tend to capture 1–3 percentage points
                more across the lifecycle — worth a multiple of any advisory fee.
              </p>
            </div>
          </div>
        </section>

        <section className="av-section av-cta no-border">
          <div className="av-wrap">
            <p className="av-hero-label">Begin the conversation</p>
            <h2 className="av-cta-headline">For a live read on <em>your</em> royalty stack — at peer level.</h2>
            <p className="av-cta-sub">
              Twenty minutes is usually enough to pressure-test where the tier breakpoints should sit.
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
