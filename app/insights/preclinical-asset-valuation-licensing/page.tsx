import { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://calculator.ambrosiaventures.co';
const CANONICAL = `${BASE_URL}/insights/preclinical-asset-valuation-licensing`;

export const metadata: Metadata = {
  title: 'Preclinical Asset Valuation for Licensing — Benchmark Data & Deal Structures | Ambrosia Ventures',
  description:
    'Preclinical licensing deals: $22M median upfront, $400M total value in oncology. Benchmark data across 12 therapeutic areas, modality premiums, and platform vs single-asset structures.',
  keywords: [
    'preclinical asset valuation', 'preclinical licensing deal', 'platform vs single asset',
    'biotech early stage deal', 'preclinical benchmarks', 'biotech M&A advisory',
  ],
  openGraph: {
    title: 'Preclinical Asset Valuation — Benchmark Data & Deal Structures',
    description: '$22M median upfront, $400M total value in oncology preclinical. 12 TAs benchmarked.',
    type: 'article',
    url: CANONICAL,
    siteName: 'Ambrosia Ventures',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Preclinical Asset Valuation — Three Patterns',
    description: 'Oncology preclinical: $22M / $400M. Gene therapy 2.5x premium. Platform deals reset the math.',
  },
  alternates: { canonical: CANONICAL },
};

const PRECLINICAL_BY_TA = [
  { ta: 'Metabolic / Obesity', upfront: 65, barPct: 100, highlight: true },
  { ta: 'Rare Disease', upfront: 45, barPct: 69, highlight: true },
  { ta: 'Immunology', upfront: 38, barPct: 58 },
  { ta: 'Hematology', upfront: 28, barPct: 43 },
  { ta: 'Oncology', upfront: 22, barPct: 34 },
  { ta: 'Neurology / CNS', upfront: 20, barPct: 31 },
  { ta: 'Cardiovascular', upfront: 16, barPct: 25 },
  { ta: 'Infectious Disease', upfront: 14, barPct: 22 },
  { ta: 'Ophthalmology', upfront: 13, barPct: 20 },
  { ta: 'Dermatology', upfront: 11, barPct: 17 },
  { ta: 'Gastroenterology', upfront: 10, barPct: 15 },
  { ta: "Women's Health", upfront: 8, barPct: 12 },
];

const MODALITY_PREMIUM = [
  { modality: 'Small Molecule', upfront: 18, multiplier: '1.0x', barPct: 30 },
  { modality: 'Monoclonal Antibody', upfront: 24, multiplier: '1.3x', barPct: 40 },
  { modality: 'Bispecific Antibody', upfront: 32, multiplier: '1.8x', barPct: 53 },
  { modality: 'ADC', upfront: 38, multiplier: '2.1x', barPct: 63, highlight: true },
  { modality: 'mRNA Therapeutic', upfront: 28, multiplier: '1.6x', barPct: 47 },
  { modality: 'Cell Therapy', upfront: 42, multiplier: '2.3x', barPct: 70, highlight: true },
  { modality: 'Gene Therapy', upfront: 60, multiplier: '3.3x', barPct: 100, highlight: true },
];

const PLATFORM_VS_ASSET = [
  { type: 'Platform (rights to multiple targets)', upfront: '$45–120M', tdv: '$800M–$2B', equity: '5–15% common', royalty: '6–10% across targets' },
  { type: 'Single asset (one target/MoA)', upfront: '$15–45M', tdv: '$300M–$800M', equity: 'Rare', royalty: '8–13% on the asset' },
];

const SCHEDULE_URL = 'mailto:issa@ambrosiaventures.co?subject=Briefing%20Call%20%E2%80%94%20Preclinical%20Valuation&body=Issa%20%E2%80%94%20saw%20the%20preclinical%20briefing.%20Available%20to%20speak%20on%3A%20';

export default function PreclinicalBriefing() {
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: 'Preclinical Asset Valuation for Licensing — Benchmark Data & Deal Structures',
    description: 'Preclinical licensing benchmarks across 12 TAs, modality premiums, and platform structures.',
    author: { '@type': 'Organization', name: 'Ambrosia Ventures', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'Ambrosia Ventures', logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` } },
    datePublished: '2026-03-18', dateModified: '2026-05-20',
    mainEntityOfPage: CANONICAL, articleSection: 'Biopharma Deal Intelligence',
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <style dangerouslySetInnerHTML={{ __html: AV_BRIEF_CSS }} />

      <main className="av-brief">
        <div className="av-topbar">
          <Link href="/" className="av-brand">Ambrosia<span>Ventures</span></Link>
          <div className="av-topbar-meta">Briefing · Preclinical Valuation · 2026</div>
        </div>

        <section className="av-section av-hero">
          <div className="av-wrap">
            <nav className="av-crumb">
              <Link href="/">Home</Link><span>/</span>
              <Link href="/insights">Insights</Link><span>/</span>
              <span>Preclinical Valuation</span>
            </nav>
            <p className="av-hero-label">Briefing · Updated May 2026</p>
            <h1 className="av-headline">
              What preclinical assets actually sell for — <em>and what shifts the premium.</em>
            </h1>
            <p className="av-lede">
              Preclinical licensing is the most variance-heavy stage in biopharma dealmaking. The same biological
              novelty can price at $11M or $60M depending on therapeutic area, modality, and whether the deal is
              platform or single-asset. Below is the read across 420 verified preclinical-stage transactions, with
              the three structural drivers most consequential for what an early asset is worth.
            </p>
            <div className="av-hero-stats">
              <div className="av-hero-stat"><div className="num">$22M</div><div className="lbl">Median Oncology Preclinical Upfront</div></div>
              <div className="av-hero-stat"><div className="num">3.3x</div><div className="lbl">Gene Therapy Modality Premium</div></div>
              <div className="av-hero-stat"><div className="num">420</div><div className="lbl">Preclinical Deals Analyzed</div></div>
            </div>
          </div>
        </section>

        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 01</span>
            <h2 className="av-section-title">Preclinical upfronts <span className="av-accent">vary 8x across TAs.</span></h2>
            <p className="av-body">
              <strong>Metabolic preclinical assets price 6.5x higher than women's health preclinical assets</strong>
              — and 3x higher than oncology. The dispersion is driven by addressable market, competitive intensity
              at later stages, and the recent commercial validation of the TA. Metabolic and rare disease lead;
              oncology sits in the middle; women's health and gastroenterology trail.
            </p>
            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">Preclinical median upfront, by therapeutic area</span>
                <span className="av-chart-source">USD millions · n = 420</span>
              </div>
              <div className="av-chart-body">
                {PRECLINICAL_BY_TA.map((t) => (
                  <div key={t.ta} className="av-bar-row">
                    <span className={`av-bar-name ${t.highlight ? 'hl' : ''}`}>{t.ta}</span>
                    <div className="av-bar-track">
                      <div className={`av-bar-fill ${t.highlight ? 'hl' : ''}`} style={{ width: `${t.barPct}%` }} />
                    </div>
                    <span className={`av-bar-value ${t.highlight ? 'hl' : ''}`}>${t.upfront}M</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="av-implication">
              <div className="av-label">Implication for External Innovation teams</div>
              <p>
                For asset owners with TA flexibility (platform players, multi-program biotechs), the TA you choose to
                launch your preclinical conversation in matters significantly. A bispecific platform targeting both
                immunology and oncology indications should sequence the immunology conversation first — the
                anchor sets the rest of the deal terms.
              </p>
            </div>
          </div>
        </section>

        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 02</span>
            <h2 className="av-section-title">Modality drives <span className="av-accent">3.3x preclinical premium.</span></h2>
            <p className="av-body">
              Gene therapy preclinical assets command 3.3x the upfront of small-molecule preclinical assets. Cell
              therapy is at 2.3x. ADCs at 2.1x. The premium reflects <strong>defensibility (manufacturing IP and
              know-how), upside (rare-disease pricing of $200K–$3M/year), and scarcity (fewer credible programs in
              market)</strong>. Modality premiums compress at later stages — but at preclinical, they're at their
              widest.
            </p>
            <div className="av-chart">
              <div className="av-chart-head">
                <span className="av-chart-title">Preclinical upfront, by modality</span>
                <span className="av-chart-source">USD millions · oncology baseline</span>
              </div>
              <div className="av-chart-body">
                {MODALITY_PREMIUM.map((m) => (
                  <div key={m.modality} className="av-bar-row">
                    <span className={`av-bar-name ${m.highlight ? 'hl' : ''}`}>{m.modality}</span>
                    <div className="av-bar-track">
                      <div className={`av-bar-fill ${m.highlight ? 'hl' : ''}`} style={{ width: `${m.barPct}%` }} />
                    </div>
                    <span className={`av-bar-value ${m.highlight ? 'hl' : ''}`}>${m.upfront}M</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="av-implication">
              <div className="av-label">Implication for asset owners</div>
              <p>
                A preclinical gene therapy asset is worth ~3x a preclinical small-molecule on raw upfront. If the
                counterparty's anchor is at small-molecule levels, that's a position to push back hard on — the
                modality premium is well-established in comps and shouldn't be left on the table.
              </p>
            </div>
          </div>
        </section>

        <section className="av-section">
          <div className="av-wrap">
            <span className="av-section-num">— Pattern 03</span>
            <h2 className="av-section-title">Platform deals <span className="av-accent">reset the math entirely.</span></h2>
            <p className="av-body">
              The deal structure that matters most at preclinical isn't upfront vs milestones — it's <strong>platform
              vs single asset</strong>. A platform deal grants the licensee rights to multiple targets/programs;
              upfronts run 2–3x single-asset comparables, equity often participates (5–15%), and royalty rates apply
              across the platform's full output. Single-asset deals concentrate risk and reward on one program.
              Sophisticated asset owners model both before committing to a structure.
            </p>
            <div className="av-table-wrap">
              <table className="av-table">
                <thead>
                  <tr><th>Structure</th><th>Upfront</th><th>Total Deal Value</th><th>Equity</th><th>Royalty</th></tr>
                </thead>
                <tbody>
                  {PLATFORM_VS_ASSET.map((p) => (
                    <tr key={p.type}>
                      <td>{p.type}</td>
                      <td>{p.upfront}</td>
                      <td>{p.tdv}</td>
                      <td>{p.equity}</td>
                      <td>{p.royalty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="av-implication">
              <div className="av-label">Implication for platform-stage biotechs</div>
              <p>
                The choice between platform and single-asset deal isn't just about cash — it's about <strong>portfolio
                optionality</strong>. A platform deal at $80M may look bigger than a single-asset deal at $35M, but
                the platform deal forecloses subsequent BD opportunities on other targets. The right structure depends
                on how broad the platform's actual differentiation is.
              </p>
            </div>
          </div>
        </section>

        <section className="av-section av-cta no-border">
          <div className="av-wrap">
            <p className="av-hero-label">Begin the conversation</p>
            <h2 className="av-cta-headline">For a live read on <em>your</em> preclinical asset — at peer level.</h2>
            <p className="av-cta-sub">
              Twenty minutes is usually enough to pressure-test whether platform or single-asset structure
              best fits the program. Confidential, no-obligation conversation.
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
