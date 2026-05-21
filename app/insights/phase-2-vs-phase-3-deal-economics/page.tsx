import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://calculator.ambrosiaventures.co';
const CANONICAL = `${BASE_URL}/insights/phase-2-vs-phase-3-deal-economics`;

export const metadata: Metadata = {
  title: 'Phase 2 vs Phase 3 Deal Economics — The Proof-of-Concept Inflection | Ambrosia Ventures',
  description:
    'How deal value inflects at proof-of-concept: Phase 2 upfronts jump 2.1x from Phase 1; Phase 3 delivers another 2.3x. When to out-license at each stage. Ambrosia Ventures briefing.',
  keywords: [
    'phase 2 vs phase 3 deal', 'proof of concept inflection', 'biotech licensing timing',
    'phase 2 upfront premium', 'biopharma deal economics', 'biotech M&A advisory',
  ],
  openGraph: {
    title: 'Phase 2 vs Phase 3 Deal Economics — The PoC Inflection',
    description: 'Phase 2 upfronts jump 2.1x from Phase 1. Phase 3 delivers another 2.3x. When to license.',
    type: 'article',
    url: CANONICAL,
    siteName: 'Ambrosia Ventures',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Phase 2 vs Phase 3 — The Inflection Math',
    description: 'PoC compresses risk premium sharply. The 2.1x multiplier is the largest in the development lifecycle.',
  },
  alternates: { canonical: CANONICAL },
};

const PHASE_LADDER = [
  { phase: 'Preclinical', upfront: 82, barPct: 4.2 },
  { phase: 'Phase 1', upfront: 140, barPct: 7.1 },
  { phase: 'Phase 2', upfront: 300, barPct: 15.3, highlight: true },
  { phase: 'Phase 3', upfront: 678, barPct: 34.5, highlight: true },
  { phase: 'Approved', upfront: 1964, barPct: 100 },
];

const TA_MULTIPLIERS = [
  { ta: 'Metabolic', p2: 1300, p3: 4500, multiple: '3.5x', barPct: 100, highlight: true },
  { ta: 'Immunology', p2: 1250, p3: 3200, multiple: '2.6x', barPct: 71.1, highlight: true },
  { ta: 'Neurology', p2: 302, p3: 838, multiple: '2.8x', barPct: 18.6 },
  { ta: 'Oncology', p2: 281, p3: 714, multiple: '2.5x', barPct: 15.9 },
  { ta: 'Rare Disease', p2: 250, p3: 700, multiple: '2.8x', barPct: 15.6 },
  { ta: 'Hematology', p2: 220, p3: 580, multiple: '2.6x', barPct: 12.9 },
];

const UPFRONT_PCT = [
  { phase: 'Phase 1', upfrontPct: 11.1, barPct: 42 },
  { phase: 'Phase 2', upfrontPct: 14.2, barPct: 54, highlight: true },
  { phase: 'Phase 3', upfrontPct: 16.8, barPct: 63 },
  { phase: 'Approved', upfrontPct: 26.5, barPct: 100 },
];

const SCHEDULE_URL = 'mailto:issa@ambrosiaventures.co?subject=Briefing%20Call%20%E2%80%94%20PoC%20Inflection&body=Issa%20%E2%80%94%20saw%20the%20Phase%202%20vs%20Phase%203%20briefing.%20Available%20to%20speak%20on%3A%20';

export default function Phase2vs3Briefing() {
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: 'Phase 2 vs Phase 3 Deal Economics — The Proof-of-Concept Inflection',
    description: 'The 2.1x multiplier from Phase 1 to Phase 2 is the largest in the development lifecycle.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` } },
    datePublished: '2026-03-20', dateModified: '2026-05-20',
    mainEntityOfPage: CANONICAL, articleSection: 'Biopharma Deal Intelligence',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <style dangerouslySetInnerHTML={{ __html: AV_BRIEF_CSS }} />

      <main className="av-brief">
        <div className="av-topbar">
          <Link href="/" className="av-brand">Ambrosia<span>Ventures</span></Link>
          <div className="av-topbar-meta">Briefing · PoC Inflection · 2026</div>
        </div>

        <section className="av-section av-hero">
          <div className="av-wrap">
            <nav className="av-crumb">
              <Link href="/">Home</Link><span>/</span>
              <Link href="/insights">Insights</Link><span>/</span>
              <span>Phase 2 vs Phase 3</span>
            </nav>
            <p className="av-hero-label">Briefing · Updated May 2026</p>
            <h1 className="av-headline">
              The proof-of-concept inflection — <em>where the upfront math actually flips.</em>
            </h1>
            <p className="av-lede">
              Phase 2 readout is the single most consequential moment in biopharma deal economics. Across 2,500+
              verified transactions, the Phase 1 → Phase 2 jump delivers a 2.1x increase in median upfront — the
              largest single-phase multiplier in the entire development lifecycle. Below is the read on when to
              out-license at each stage, and what the math actually says.
            </p>
            <div className="av-hero-stats">
              <div className="av-hero-stat"><div className="num">2.1x</div><div className="lbl">P1 → P2 Upfront Multiple</div></div>
              <div className="av-hero-stat"><div className="num">2.3x</div><div className="lbl">P2 → P3 Multiple</div></div>
              <div className="av-hero-stat"><div className="num">1,121</div><div className="lbl">P2+P3 Deals Analyzed</div></div>
            </div>
          </div>
        </section>

        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 01</span>
            <h2 className="av-section-title">The inflection is <span className="av-accent">sharp and asymmetric.</span></h2>
            <p className="av-body">
              Median upfront moves <strong>$140M (Phase 1) → $300M (Phase 2) → $678M (Phase 3)</strong>. The Phase 1
              → Phase 2 jump is 2.1x; the Phase 2 → Phase 3 jump is 2.3x. The compounding effect: a Phase 1 asset
              that runs through PoC and a positive Phase 3 readout commands ~5x its preclinical upfront — without
              ever changing the underlying biology.
            </p>
            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">Median upfront, by phase at signing</span>
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
            <div className="av-implication">
              <div className="av-label">Implication for live processes</div>
              <p>
                The 6–12 months between Phase 1 lock and Phase 2 readout is the highest-leverage development period
                in licensing economics. A 12-month delay to clear PoC unlocks <strong>~$160M in additional upfront</strong>
                at median — and that's before factoring tighter royalty rates and lower discount factors on the
                back end.
              </p>
            </div>
          </div>
        </section>

        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 02</span>
            <h2 className="av-section-title">The inflection multiplier <span className="av-accent">varies by TA.</span></h2>
            <p className="av-body">
              Phase 2 → Phase 3 multiples cluster between 2.5x and 3.5x, but not uniformly. <strong>Metabolic
              (3.5x) and rare disease (2.8x) deliver the steepest jumps</strong>; oncology and immunology compress
              tighter at 2.5–2.6x. The structural reason: in TAs where Phase 2 is already accepted as a strong
              de-risk signal (metabolic GLP-1 readouts, rare disease pivotal-equivalent P2), Phase 3 is more
              confirmatory than transformative.
            </p>
            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">Phase 2 → Phase 3 upfront multiplier, by TA</span>
                <span className="av-chart-source">USD millions · top TAs by P2+P3 volume</span>
              </div>
              <div className="av-chart-body">
                {TA_MULTIPLIERS.map((t) => (
                  <div key={t.ta} className="av-bar-row">
                    <span className={`av-bar-name ${t.highlight ? 'hl' : ''}`}>{t.ta}</span>
                    <div className="av-bar-track">
                      <div className={`av-bar-fill ${t.highlight ? 'hl' : ''}`} style={{ width: `${t.barPct}%` }} />
                    </div>
                    <span className={`av-bar-value ${t.highlight ? 'hl' : ''}`}>{t.multiple}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="av-table-wrap">
              <table className="av-table">
                <thead><tr><th>Therapeutic Area</th><th>P2 Upfront</th><th>P3 Upfront</th><th>Multiple</th></tr></thead>
                <tbody>
                  {TA_MULTIPLIERS.map((t) => (
                    <tr key={t.ta} className={t.highlight ? 'hl' : ''}>
                      <td>{t.ta}</td>
                      <td>${t.p2.toLocaleString()}M</td>
                      <td>${t.p3.toLocaleString()}M</td>
                      <td>{t.multiple}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="av-implication">
              <div className="av-label">Implication for asset owners</div>
              <p>
                If you're sitting on a Phase 2 metabolic or rare disease asset and weighing P2 out-license vs. P3
                pursuit, the multiplier math leans heavily toward holding through Phase 3 — assuming financing exists.
                The 3.5x metabolic multiplier is worth ~$3.2B on a typical asset; the cost of capital to run Phase 3
                is rarely more than $500M.
              </p>
            </div>
          </div>
        </section>

        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 03</span>
            <h2 className="av-section-title">Upfront % of TDV <span className="av-accent">tells the negotiation story.</span></h2>
            <p className="av-body">
              The headline upfront is half the picture. The other half is <strong>what percentage of total deal value
              the upfront represents</strong>. At Phase 1, upfront is 11.1% of TDV — most of the value sits in
              milestones and royalties. By the time an asset is approved, upfront jumps to 26.5% of TDV — the
              licensee has fewer reasons to back-load risk. The mid-stage band (Phase 2 at 14.2%) is the negotiated
              sweet spot.
            </p>
            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">Upfront as % of total deal value, by phase</span>
                <span className="av-chart-source">Median ratio · n = 1,905</span>
              </div>
              <div className="av-chart-body">
                {UPFRONT_PCT.map((p) => (
                  <div key={p.phase} className="av-bar-row">
                    <span className={`av-bar-name ${p.highlight ? 'hl' : ''}`}>{p.phase}</span>
                    <div className="av-bar-track">
                      <div className={`av-bar-fill ${p.highlight ? 'hl' : ''}`} style={{ width: `${p.barPct}%` }} />
                    </div>
                    <span className={`av-bar-value ${p.highlight ? 'hl' : ''}`}>{p.upfrontPct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="av-implication">
              <div className="av-label">Implication for the negotiation</div>
              <p>
                A Phase 2 out-license with an upfront below 12% of TDV is being structured against the asset owner.
                The seller is taking on Phase 3 risk via milestones without commensurate upfront cash. The right
                anchor is 14–16% at Phase 2 — and if the counterparty pushes it lower, that signals their view of
                Phase 3 risk is high enough to justify advisory intervention.
              </p>
            </div>
          </div>
        </section>

        <section className="av-section av-cta no-border">
          <div className="av-wrap">
            <p className="av-hero-label">Begin the conversation</p>
            <h2 className="av-cta-headline">For a live read on <em>your</em> phase timing — at peer level.</h2>
            <p className="av-cta-sub">
              Twenty minutes is usually enough to pressure-test whether the math says to license at PoC or push to Phase 3.
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
