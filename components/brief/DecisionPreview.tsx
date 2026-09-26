/**
 * A faithful miniature of page three of a Deal Intelligence Brief, rendered
 * in HTML for the /brief landing. Illustrative figures for a preclinical
 * antibody; the layout mirrors lib/report/pages/decisionPage.ts so what a
 * prospect sees here is what the PDF looks like.
 */

const SAMPLE = {
  eyebrow: 'The decision · page 3 of 31',
  asset: 'AMB-201 · anti-tau antibody · preclinical · Alzheimer’s disease',
  headline: 'Run a process now, opening with Eli Lilly and holding Eisai and Roche as tension; take the first offer at or above the floor only if it lands before the IND readout.',
  recommendation: 'Run a process now',
  ask: { upfront: '$75M', total: '$900M', royalty: '8–14%' },
  floor: { upfront: '$45M', total: '$600M' },
  walkAway: '$36M',
  counterparties: [
    { name: 'Eli Lilly', role: 'lead', why: 'Signed two preclinical CNS antibody licences since 2024; no tau asset in the pipeline.' },
    { name: 'Eisai', role: 'tension', why: 'Public commitment to a second Alzheimer’s mechanism; paid at the upper quartile at this stage.' },
    { name: 'Roche', role: 'tension', why: 'Tau franchise gap after the trontinemab readout; transacts at preclinical.' },
    { name: 'Biogen', role: 'hold', why: 'Rebuilding CNS BD; no preclinical licence in 24 months.' },
  ],
  levers: ['Front-load milestones to IND clearance and first-patient dosing', 'Co-development option on the lead indication with a US profit-share election', 'Retain Greater China rights; no buyer on the list is Asia-based'],
  timeline: [['Wk 1–2', 'Data room and non-confidential deck to the lead and tension list'], ['Wk 3–6', 'Management meetings; CDAs; first indications of interest'], ['Wk 7–10', 'Term sheets; hold the floor; re-open the tension list if the lead stalls'], ['Wk 11–14', 'Exclusivity and definitive agreement']],
  confidence: 'Medium · 5 verified preclinical CNS comps, 2 lead buyers with stage evidence',
  window: 'Mar–Sep 2027',
} as const;

const ROLE: Record<'lead' | 'tension' | 'hold', string> = {
  lead: 'bg-teal-400/15 text-teal-200 ring-1 ring-teal-400/30',
  tension: 'bg-sky-400/15 text-sky-200 ring-1 ring-sky-400/30',
  hold: 'bg-slate-700/40 text-slate-400 ring-1 ring-slate-600/40',
};

export function DecisionPreview() {
  return (
    <div className="relative rounded-2xl border border-slate-700/60 bg-[#0f1420] p-5 shadow-[0_30px_80px_-30px_rgba(45,212,191,0.25)] sm:p-6">
      <div className="absolute -top-3 right-5 rounded-full border border-teal-400/40 bg-[#0b1220] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300">
        Registered · scored
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{SAMPLE.eyebrow}</div>
        <div className="text-[10px] text-slate-500">Illustrative</div>
      </div>
      <div className="mt-1 text-xs text-slate-400">{SAMPLE.asset}</div>

      <div className="mt-4 flex items-center gap-2">
        <span className="rounded-full bg-teal-500 px-3 py-1 text-xs font-bold text-slate-950">{SAMPLE.recommendation}</span>
        <span className="text-[11px] text-slate-500">window {SAMPLE.window}</span>
      </div>
      <p className="mt-3 font-display text-[15px] font-semibold leading-snug text-slate-100">{SAMPLE.headline}</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ['Ask', `${SAMPLE.ask.upfront} up`, `${SAMPLE.ask.total} total · ${SAMPLE.ask.royalty} royalty`],
          ['Floor', `${SAMPLE.floor.upfront} up`, `${SAMPLE.floor.total} total`],
          ['Walk away', SAMPLE.walkAway, 'below this, no deal'],
        ].map(([k, v, s]) => (
          <div key={k} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
            <div className="mt-0.5 font-mono text-base font-bold text-slate-50">{v}</div>
            <div className="text-[10px] text-slate-500">{s}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-1.5">
        {SAMPLE.counterparties.map(c => (
          <div key={c.name} className="flex items-start gap-2 text-[11px]">
            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE[c.role]}`}>{c.role}</span>
            <span className="shrink-0 whitespace-nowrap font-semibold text-slate-200">{c.name}</span>
            <span className="text-slate-500">{c.why}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-800 pt-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Levers</div>
          <ul className="mt-1 space-y-1 text-[11px] text-slate-400">{SAMPLE.levers.map(l => <li key={l}>· {l}</li>)}</ul>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Timeline</div>
          <ul className="mt-1 space-y-1 text-[11px] text-slate-400">{SAMPLE.timeline.map(([w, s]) => <li key={w}><span className="font-mono text-slate-300">{w}</span> {s}</li>)}</ul>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2 text-[10px] text-slate-500">
        <span>Confidence: {SAMPLE.confidence}</span>
        <span>Signed · Managing Partner</span>
      </div>
    </div>
  );
}
