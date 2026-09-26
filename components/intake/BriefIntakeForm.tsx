'use client';

/**
 * Deal Intelligence Brief intake as a stepped flow: one section at a time,
 * a rail that shows where you are and what each section changes in the
 * brief, a review step before submit, and a draft that survives a reload.
 *
 * Steps: asset → your model → runway → process → data package → contact and
 * invoice → review. Only the asset and contact steps are required. The
 * payload posted to /api/benchmark/intake is unchanged.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BENCHMARK_PRICING } from '@/lib/config/constants';
import { DATA_PACKAGE_ITEMS, PRIOR_OFFER_STATUSES, type PriorOffer } from '@/lib/brief/client-intake';

const THERAPEUTIC_AREAS = ['Oncology', 'Neurology', 'Immunology', 'Rare Disease', 'Cardiovascular', 'Metabolic', 'Hematology', 'Ophthalmology', 'Dermatology', 'Infectious Disease', 'Gastroenterology', "Women's Health"] as const;
const PHASES = ['Preclinical', 'Phase 1', 'Phase 1/2', 'Phase 2', 'Phase 2/3', 'Phase 3'] as const;
const MODALITIES = [['SM', 'Small molecule'], ['mAb', 'Monoclonal antibody'], ['ADC', 'Antibody-drug conjugate'], ['BSAB', 'Bispecific'], ['TSAB', 'Trispecific'], ['GT', 'Gene therapy'], ['CT', 'Cell therapy'], ['RNAi', 'siRNA'], ['ASO', 'Antisense'], ['mRNA', 'mRNA'], ['PEP', 'Peptide'], ['RP', 'Radiopharmaceutical'], ['VAX', 'Vaccine'], ['OTH', 'Other']] as const;
const DEAL_TYPES = ['Licensing', 'Option', 'Co-Development', 'M&A / Acquisition'] as const;
const TERRITORIES = [['global', 'Global'], ['us', 'US only'], ['ex_us', 'Ex-US'], ['ex_china', 'Ex-China'], ['japan', 'Japan'], ['china', 'China']] as const;
const DATA_PACKAGE_STAGES = ['Discovery / hit-to-lead', 'In vivo efficacy in hand', 'IND-enabling underway', 'IND-enabling complete / IND filed', 'Phase 1 data in hand', 'Phase 2 data in hand', 'Phase 3 data in hand'] as const;

export interface IntakePrefill { name?: string; email?: string; company?: string; title?: string; assetName?: string; indication?: string; ref?: string }
interface Props { prefill?: IntakePrefill; intakePath: '/intake' | '/brief' }

type OfferDraft = { party: string; date: string; upfrontM: string; totalM: string; status: PriorOffer['status']; notes: string };
const emptyOffer = (): OfferDraft => ({ party: '', date: '', upfrontM: '', totalM: '', status: 'received', notes: '' });

interface Draft {
  name: string; email: string; company: string; title: string;
  assetName: string; ta: string; indication: string; phase: string; modality: string; mechanism: string; target: string; dealType: string; territory: string; stage: string; differentiation: string;
  peak: string; pos: string; launch: string; devCost: string; expUp: string; expTotal: string; modelNotes: string;
  cash: string; runway: string; raise: string; raiseDate: string;
  offers: OfferDraft[]; termSheets: string; targetBuyers: string; excludedBuyers: string; upstream: string; ip: string;
  pkg: Record<string, boolean>;
  billingEntity: string; billingAddress: string; billingEmail: string; po: string;
}
const blank = (p: IntakePrefill): Draft => ({
  name: p.name ?? '', email: p.email ?? '', company: p.company ?? '', title: p.title ?? '',
  assetName: p.assetName ?? '', ta: '', indication: p.indication ?? '', phase: '', modality: '', mechanism: '', target: '', dealType: 'Licensing', territory: 'global', stage: '', differentiation: '',
  peak: '', pos: '', launch: '', devCost: '', expUp: '', expTotal: '', modelNotes: '',
  cash: '', runway: '', raise: '', raiseDate: '',
  offers: [], termSheets: '', targetBuyers: '', excludedBuyers: '', upstream: '', ip: '',
  pkg: {},
  billingEntity: '', billingAddress: '', billingEmail: '', po: '',
});

const STEPS = [
  { key: 'asset', title: 'The asset', short: 'Asset', hint: 'Required. One asset, one decision.' },
  { key: 'model', title: 'Your model', short: 'Model', hint: 'Adds the "your model vs Solidus" page.' },
  { key: 'runway', title: 'Runway and financing', short: 'Runway', hint: 'Makes the fund-or-partner page use your real cash and raise.' },
  { key: 'process', title: 'Process to date', short: 'Process', hint: 'Offers on the table go against the floor and the ask; named buyers are assessed.' },
  { key: 'package', title: 'Data package', short: 'Package', hint: 'Marks each diligence item ready or open.' },
  { key: 'contact', title: 'Contact and invoice', short: 'Invoice', hint: `${BENCHMARK_PRICING.PRICE}, invoiced within one business day.` },
  { key: 'review', title: 'Review and submit', short: 'Review', hint: 'What we have; what the brief will draw from it.' },
] as const;
type StepKey = (typeof STEPS)[number]['key'];

const num = (v: string): number | null => { const t = v.replace(/[$,\s]/g, ''); if (!t) return null; const x = Number(t); return Number.isFinite(x) ? x : null; };
const list = (v: string): string[] => v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
const DRAFT_KEY = 'solidus-brief-intake-draft-v1';

const field = 'w-full rounded-lg border border-slate-700/80 bg-[#0f131b] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition focus:border-teal-400/70 focus:ring-2 focus:ring-teal-500/20';
const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500';
const pill = (on: boolean) => `rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${on ? 'bg-teal-500 text-slate-950 shadow-sm shadow-teal-500/30' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700/70'}`;
const Money = ({ v }: { v: string }) => <span className="font-mono">{v ? `$${v}M` : '—'}</span>;

export function BriefIntakeForm({ prefill = {}, intakePath }: Props) {
  const [d, setD] = useState<Draft>(() => blank(prefill));
  const [step, setStep] = useState<StepKey>('asset');
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; msg?: string; requestId?: string }>({ kind: 'idle' });
  const panel = useRef<HTMLDivElement | null>(null);
  const hydrated = useRef(false);

  // Draft: restore once, then save on every change. Never let storage failures surface.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Draft>;
        setD(prev => ({ ...prev, ...saved, ...Object.fromEntries(Object.entries(prefill).filter(([, v]) => v).map(([k, v]) => [k === 'assetName' ? 'assetName' : k, v])) }));
      }
    } catch { /* storage unavailable */ }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  }, [d]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }));
  const idx = STEPS.findIndex(s => s.key === step);
  const assetOk = !!(d.ta && d.indication.trim() && d.phase && d.modality);
  const contactOk = !!(d.name.trim() && /\S+@\S+\.\S+/.test(d.email));
  const modelFilled = useMemo(() => [d.peak, d.pos, d.launch, d.devCost, d.expUp, d.expTotal].some(v => v.trim()), [d]);
  const runwayFilled = [d.cash, d.runway, d.raise, d.raiseDate].some(v => v.trim());
  const processFilled = d.offers.some(o => o.party.trim()) || !!d.targetBuyers.trim() || !!d.excludedBuyers.trim() || !!d.upstream.trim() || !!d.ip.trim();
  const pkgCount = Object.values(d.pkg).filter(Boolean).length;
  const done: Record<StepKey, boolean> = { asset: assetOk, model: modelFilled, runway: runwayFilled, process: processFilled, package: pkgCount > 0, contact: contactOk, review: false };

  const go = (k: StepKey) => {
    setStep(k);
    setTouched(false);
    requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const next = () => {
    if (step === 'asset' && !assetOk) { setTouched(true); return; }
    if (step === 'contact' && !contactOk) { setTouched(true); return; }
    go(STEPS[Math.min(idx + 1, STEPS.length - 1)].key);
  };
  const back = () => go(STEPS[Math.max(idx - 1, 0)].key);

  async function submit() {
    if (!assetOk || !contactOk || state.kind === 'busy') { setTouched(true); return; }
    setState({ kind: 'busy' });
    const body = {
      name: d.name.trim(), email: d.email.trim(), company: d.company.trim() || null, title: d.title.trim() || null,
      therapeuticArea: d.ta, indication: d.indication.trim(), phase: d.phase, modality: d.modality,
      assetName: d.assetName.trim() || null, mechanism: d.mechanism.trim() || null, target: d.target.trim() || null,
      targetDealType: d.dealType, territory: d.territory, dataPackageStage: d.stage || null, differentiationNotes: d.differentiation.trim() || null,
      client: {
        model: modelFilled ? { peakSalesM: num(d.peak), posToApprovalPct: num(d.pos), launchYear: num(d.launch), devCostToApprovalM: num(d.devCost), expectedUpfrontM: num(d.expUp), expectedTotalM: num(d.expTotal), notes: d.modelNotes.trim() || null } : null,
        financing: runwayFilled ? { cashOnHandM: num(d.cash), runwayMonths: num(d.runway), nextRaiseM: num(d.raise), nextRaiseDate: d.raiseDate.trim() || null } : null,
        priorOffers: d.offers.filter(o => o.party.trim()).map(o => ({ party: o.party.trim(), date: o.date.trim() || null, upfrontM: num(o.upfrontM), totalM: num(o.totalM), structure: null, status: o.status, notes: o.notes.trim() || null })),
        termSheetsReceived: num(d.termSheets),
        targetBuyers: list(d.targetBuyers), excludedBuyers: list(d.excludedBuyers),
        upstreamLicenses: d.upstream.trim() || null, ipNotes: d.ip.trim() || null,
        dataPackage: d.pkg,
      },
      billingEntity: d.billingEntity.trim() || null, billingAddress: d.billingAddress.trim() || null, billingEmail: d.billingEmail.trim() || null, poNumber: d.po.trim() || null,
      intakePath, ref: prefill.ref ?? null,
    };
    try {
      const res = await fetch('/api/benchmark/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setState({ kind: 'error', msg: json.issues?.join('; ') || json.error || 'Something went wrong.' }); return; }
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setState({ kind: 'done', requestId: json.requestId });
    } catch {
      setState({ kind: 'error', msg: 'Network error. Please try again, or reply to any email from us.' });
    }
  }

  if (state.kind === 'done') {
    return (
      <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-b from-teal-500/10 to-transparent p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-300">Intake received</p>
        <h3 className="mt-3 font-display text-2xl font-semibold text-slate-50">{d.assetName ? `${d.assetName}, ` : ''}{d.indication}, {d.phase}.</h3>
        <ol className="mt-5 space-y-3 text-sm leading-relaxed text-slate-300">
          {[
            `An invoice for ${BENCHMARK_PRICING.PRICE} follows within one business day${d.billingEntity ? ` to ${d.billingEntity}` : ''}. It is credited in full against a subsequent advisory mandate.`,
            'On receipt, a 15-minute call to confirm the asset and the counterparties you want in or out.',
            'The brief within 24 hours of the call, in a private data room, with a 30-minute walkthrough arranged by reply.',
          ].map((t, i) => <li key={i} className="flex gap-3"><span className="font-mono text-teal-400">{i + 1}</span><span>{t}</span></li>)}
        </ol>
        <p className="mt-6 text-xs text-slate-500">Reference {state.requestId}. A confirmation is on its way to {d.email}.</p>
      </div>
    );
  }

  const Nav = () => (
    <div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-5">
      <button type="button" onClick={back} disabled={idx === 0} className="text-sm font-semibold text-slate-400 transition hover:text-slate-200 disabled:opacity-0">← Back</button>
      <div className="flex items-center gap-4">
        {step !== 'review' && step !== 'asset' && step !== 'contact' && !done[step] ? <button type="button" onClick={next} className="text-sm text-slate-500 hover:text-slate-300">Skip for now</button> : null}
        {step === 'review'
          ? <button type="button" onClick={submit} disabled={state.kind === 'busy'} className="rounded-full bg-teal-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-400 disabled:opacity-50">{state.kind === 'busy' ? 'Sending…' : `Submit · invoice ${BENCHMARK_PRICING.PRICE}`}</button>
          : <button type="button" onClick={next} className="rounded-full bg-teal-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-400">Continue →</button>}
      </div>
    </div>
  );

  const Title = ({ i }: { i: number }) => (
    <div className="mb-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-400">Step {i + 1} of {STEPS.length}</div>
      <h2 className="mt-2 font-display text-2xl font-semibold text-slate-50">{STEPS[i].title}</h2>
      <p className="mt-1 text-sm text-slate-500">{STEPS[i].hint}</p>
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      {/* Rail */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <ol className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">
          {STEPS.map((s, i) => {
            const current = s.key === step;
            const complete = done[s.key];
            return (
              <li key={s.key} className="shrink-0">
                <button type="button" onClick={() => go(s.key)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${current ? 'bg-slate-800/70 text-slate-50' : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${complete ? 'bg-teal-500 text-slate-950' : current ? 'border border-teal-400 text-teal-300' : 'border border-slate-700 text-slate-500'}`}>{complete ? '✓' : i + 1}</span>
                  <span className="hidden lg:inline">{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 hidden rounded-lg border border-slate-800 bg-[#10141c] p-4 text-xs leading-relaxed text-slate-500 lg:block">
          <div className="font-semibold text-slate-300">Draft saved on this device.</div>
          Sections 2 to 5 are optional. Each one you complete replaces a public-data assumption in the brief with your number.
        </div>
      </aside>

      {/* Panel */}
      <div ref={panel} className="scroll-mt-24 rounded-2xl border border-slate-800 bg-[#0d1118] p-6 sm:p-8">
        {step === 'asset' ? (
          <>
            <Title i={0} />
            <div className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={label}>Asset or program</label><input className={field} value={d.assetName} onChange={e => set('assetName', e.target.value)} placeholder="e.g. AMB-201" /></div>
                <div><label className={label}>Indication *</label><input className={field} value={d.indication} onChange={e => set('indication', e.target.value)} placeholder="e.g. Alzheimer's disease" />{touched && !d.indication.trim() ? <p className="mt-1 text-xs text-rose-400">Required.</p> : null}</div>
              </div>
              <div><label className={label}>Therapeutic area *</label><div className="flex flex-wrap gap-2">{THERAPEUTIC_AREAS.map(t => <button type="button" key={t} className={pill(d.ta === t)} onClick={() => set('ta', t)}>{t}</button>)}</div>{touched && !d.ta ? <p className="mt-1 text-xs text-rose-400">Pick one.</p> : null}</div>
              <div><label className={label}>Stage at signing *</label><div className="flex flex-wrap gap-2">{PHASES.map(p => <button type="button" key={p} className={pill(d.phase === p)} onClick={() => set('phase', p)}>{p}</button>)}</div>{touched && !d.phase ? <p className="mt-1 text-xs text-rose-400">Pick one.</p> : null}</div>
              <div><label className={label}>Modality *</label><div className="flex flex-wrap gap-2">{MODALITIES.map(([k, l]) => <button type="button" key={k} className={pill(d.modality === k)} onClick={() => set('modality', k)}>{l}</button>)}</div>{touched && !d.modality ? <p className="mt-1 text-xs text-rose-400">Pick one.</p> : null}</div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={label}>Mechanism</label><input className={field} value={d.mechanism} onChange={e => set('mechanism', e.target.value)} placeholder="e.g. anti-tau antibody" /></div>
                <div><label className={label}>Target</label><input className={field} value={d.target} onChange={e => set('target', e.target.value)} placeholder="e.g. MAPT" /></div>
              </div>
              <div><label className={label}>Structure you are preparing for</label><div className="flex flex-wrap gap-2">{DEAL_TYPES.map(t => <button type="button" key={t} className={pill(d.dealType === t)} onClick={() => set('dealType', t)}>{t}</button>)}</div></div>
              <div><label className={label}>Territory on offer</label><div className="flex flex-wrap gap-2">{TERRITORIES.map(([k, l]) => <button type="button" key={k} className={pill(d.territory === k)} onClick={() => set('territory', k)}>{l}</button>)}</div></div>
              <div><label className={label}>Data package stage</label><div className="flex flex-wrap gap-2">{DATA_PACKAGE_STAGES.map(s => <button type="button" key={s} className={pill(d.stage === s)} onClick={() => set('stage', s)}>{s}</button>)}</div></div>
              <div><label className={label}>What makes it different</label><textarea className={field} rows={3} value={d.differentiation} onChange={e => set('differentiation', e.target.value)} placeholder="Selectivity, delivery, biomarker, competitive position, the claim you want a buyer to test" /></div>
            </div>
            <Nav />
          </>
        ) : null}

        {step === 'model' ? (
          <>
            <Title i={1} />
            <div className="grid gap-5 sm:grid-cols-3">
              {[['peak', 'Peak sales ($M / yr)', '1200'], ['pos', 'Probability to approval (%)', '12'], ['launch', 'Launch year', '2033'], ['devCost', 'Cost to approval ($M)', '250'], ['expUp', 'Upfront you expect ($M)', '60'], ['expTotal', 'Total value you expect ($M)', '800']].map(([k, l, ph]) => (
                <div key={k}><label className={label}>{l}</label><input className={field} inputMode="decimal" value={d[k as keyof Draft] as string} onChange={e => set(k as keyof Draft, e.target.value as never)} placeholder={`e.g. ${ph}`} /></div>
              ))}
            </div>
            <div className="mt-5"><label className={label}>Notes on your model</label><textarea className={field} rows={2} value={d.modelNotes} onChange={e => set('modelNotes', e.target.value)} placeholder="Source of the peak-sales view, pricing assumption, geography, anything a buyer will challenge" /></div>
            <Nav />
          </>
        ) : null}

        {step === 'runway' ? (
          <>
            <Title i={2} />
            <div className="grid gap-5 sm:grid-cols-4">
              <div><label className={label}>Cash on hand ($M)</label><input className={field} inputMode="decimal" value={d.cash} onChange={e => set('cash', e.target.value)} /></div>
              <div><label className={label}>Runway (months)</label><input className={field} inputMode="numeric" value={d.runway} onChange={e => set('runway', e.target.value)} /></div>
              <div><label className={label}>Next raise ($M)</label><input className={field} inputMode="decimal" value={d.raise} onChange={e => set('raise', e.target.value)} /></div>
              <div><label className={label}>Expected close</label><input className={field} value={d.raiseDate} onChange={e => set('raiseDate', e.target.value)} placeholder="YYYY-MM" /></div>
            </div>
            <Nav />
          </>
        ) : null}

        {step === 'process' ? (
          <>
            <Title i={3} />
            <div className="grid gap-5">
              <div>
                <div className="flex items-center justify-between"><label className={label}>Offers or term sheets received</label><button type="button" className="text-xs font-semibold text-teal-300 hover:text-teal-200" onClick={() => set('offers', [...d.offers, emptyOffer()])}>+ Add an offer</button></div>
                {d.offers.length === 0 ? <p className="text-sm text-slate-600">None yet.</p> : null}
                <div className="grid gap-3">
                  {d.offers.map((o, i) => (
                    <div key={i} className="grid gap-2 rounded-lg border border-slate-800 bg-[#0f131b] p-3 sm:grid-cols-6">
                      <input className={`${field} sm:col-span-2`} placeholder="Counterparty" value={o.party} onChange={e => set('offers', d.offers.map((x, j) => j === i ? { ...x, party: e.target.value } : x))} />
                      <input className={field} placeholder="Upfront $M" inputMode="decimal" value={o.upfrontM} onChange={e => set('offers', d.offers.map((x, j) => j === i ? { ...x, upfrontM: e.target.value } : x))} />
                      <input className={field} placeholder="Total $M" inputMode="decimal" value={o.totalM} onChange={e => set('offers', d.offers.map((x, j) => j === i ? { ...x, totalM: e.target.value } : x))} />
                      <input className={field} placeholder="YYYY-MM" value={o.date} onChange={e => set('offers', d.offers.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                      <div className="flex flex-wrap gap-1">{PRIOR_OFFER_STATUSES.map(s => <button type="button" key={s} className={pill(o.status === s)} onClick={() => set('offers', d.offers.map((x, j) => j === i ? { ...x, status: s } : x))}>{s}</button>)}</div>
                      <input className={`${field} sm:col-span-5`} placeholder="Structure and notes: licensing or option, exclusivity asked, what stalled" value={o.notes} onChange={e => set('offers', d.offers.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
                      <button type="button" className="text-xs text-slate-500 hover:text-rose-400" onClick={() => set('offers', d.offers.filter((_, j) => j !== i))}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div><label className={label}>Term sheets received so far</label><input className={field} inputMode="numeric" value={d.termSheets} onChange={e => set('termSheets', e.target.value)} placeholder="0" /></div>
                <div><label className={label}>Buyers you want assessed</label><input className={field} value={d.targetBuyers} onChange={e => set('targetBuyers', e.target.value)} placeholder="Comma-separated" /></div>
                <div><label className={label}>Buyers to exclude</label><input className={field} value={d.excludedBuyers} onChange={e => set('excludedBuyers', e.target.value)} placeholder="Comma-separated" /></div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={label}>Upstream licences or encumbrances</label><textarea className={field} rows={2} value={d.upstream} onChange={e => set('upstream', e.target.value)} placeholder="Academic licence, royalty stack, platform rights, co-owned IP" /></div>
                <div><label className={label}>IP notes</label><textarea className={field} rows={2} value={d.ip} onChange={e => set('ip', e.target.value)} placeholder="Composition-of-matter expiry, key filings, FTO status" /></div>
              </div>
            </div>
            <Nav />
          </>
        ) : null}

        {step === 'package' ? (
          <>
            <Title i={4} />
            <div className="grid gap-2 sm:grid-cols-2">
              {DATA_PACKAGE_ITEMS.map(item => {
                const on = d.pkg[item.key] === true;
                return (
                  <button type="button" key={item.key} onClick={() => set('pkg', { ...d.pkg, [item.key]: !on })} className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left text-sm transition ${on ? 'border-teal-500/50 bg-teal-500/10 text-slate-100' : 'border-slate-800 bg-[#0f131b] text-slate-300 hover:border-slate-600'}`}>
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${on ? 'border-teal-400 bg-teal-500 text-slate-950' : 'border-slate-600'}`}>{on ? '✓' : ''}</span>
                    <span><span className="font-medium">{item.label}</span><span className="block text-xs text-slate-500">{item.area}</span></span>
                  </button>
                );
              })}
            </div>
            <Nav />
          </>
        ) : null}

        {step === 'contact' ? (
          <>
            <Title i={5} />
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className={label}>Your name *</label><input className={field} value={d.name} onChange={e => set('name', e.target.value)} />{touched && !d.name.trim() ? <p className="mt-1 text-xs text-rose-400">Required.</p> : null}</div>
              <div><label className={label}>Email *</label><input className={field} type="email" value={d.email} onChange={e => set('email', e.target.value)} />{touched && !/\S+@\S+\.\S+/.test(d.email) ? <p className="mt-1 text-xs text-rose-400">A valid email is required.</p> : null}</div>
              <div><label className={label}>Company</label><input className={field} value={d.company} onChange={e => set('company', e.target.value)} /></div>
              <div><label className={label}>Title</label><input className={field} value={d.title} onChange={e => set('title', e.target.value)} /></div>
            </div>
            <div className="mt-6 rounded-lg border border-slate-800 bg-[#0f131b] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Invoice</div>
              <p className="mt-1 text-sm text-slate-400">{BENCHMARK_PRICING.PRICE}, sent within one business day of this form. No card, no checkout. Credited in full against a subsequent advisory mandate.</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div><label className={label}>Invoice to (legal entity)</label><input className={field} value={d.billingEntity} onChange={e => set('billingEntity', e.target.value)} placeholder="Defaults to your company" /></div>
                <div><label className={label}>Billing email</label><input className={field} type="email" value={d.billingEmail} onChange={e => set('billingEmail', e.target.value)} placeholder="Defaults to your email" /></div>
                <div><label className={label}>Billing address</label><textarea className={field} rows={2} value={d.billingAddress} onChange={e => set('billingAddress', e.target.value)} /></div>
                <div><label className={label}>PO number, if required</label><input className={field} value={d.po} onChange={e => set('po', e.target.value)} /></div>
              </div>
            </div>
            <Nav />
          </>
        ) : null}

        {step === 'review' ? (
          <>
            <Title i={6} />
            <div className="grid gap-3">
              {[
                ['The asset', `${d.assetName || 'Unnamed'} · ${d.indication || '—'} · ${d.phase || '—'} · ${MODALITIES.find(m => m[0] === d.modality)?.[1] ?? '—'} · ${d.dealType} · ${TERRITORIES.find(t => t[0] === d.territory)?.[1] ?? d.territory}`, 'asset', assetOk],
                ['Your model', modelFilled ? <span key="m">Peak <Money v={d.peak} /> · PoS {d.pos || '—'}% · launch {d.launch || '—'} · cost <Money v={d.devCost} /> · expects <Money v={d.expUp} /> up / <Money v={d.expTotal} /> total</span> : 'Not supplied. The "your model vs Solidus" page will print an empty state.', 'model', modelFilled],
                ['Runway', runwayFilled ? <span key="r">Cash <Money v={d.cash} /> · {d.runway || '—'} months · next raise <Money v={d.raise} /> {d.raiseDate}</span> : 'Not supplied. The fund-or-partner page will use a benchmark raise.', 'runway', runwayFilled],
                ['Process', processFilled ? `${d.offers.filter(o => o.party.trim()).length} offer(s) · assess: ${d.targetBuyers || '—'} · exclude: ${d.excludedBuyers || '—'}` : 'No offers or named buyers.', 'process', processFilled],
                ['Data package', pkgCount ? `${pkgCount} of ${DATA_PACKAGE_ITEMS.length} items in hand` : 'Nothing ticked; diligence readiness will list every item as open.', 'package', pkgCount > 0],
                ['Contact and invoice', `${d.name || '—'} · ${d.email || '—'} · ${d.company || '—'} · invoice to ${d.billingEntity || d.company || d.name || '—'}`, 'contact', contactOk],
              ].map(([t, v, k, ok]) => (
                <div key={String(t)} className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 bg-[#0f131b] px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-teal-400' : 'bg-slate-600'}`} />{t as string}</div>
                    <div className="mt-1 text-sm text-slate-300">{v as React.ReactNode}</div>
                  </div>
                  <button type="button" onClick={() => go(k as StepKey)} className="shrink-0 text-xs font-semibold text-teal-300 hover:text-teal-200">Edit</button>
                </div>
              ))}
            </div>
            {state.kind === 'error' ? <p className="mt-4 text-sm text-rose-400">{state.msg}</p> : null}
            {touched && (!assetOk || !contactOk) ? <p className="mt-4 text-sm text-rose-400">The asset and your contact details are required.</p> : null}
            <p className="mt-6 text-xs leading-relaxed text-slate-500">Everything you enter stays in your brief and your data room. Nothing is published in a way that identifies you or the asset.</p>
            <Nav />
          </>
        ) : null}
      </div>
    </div>
  );
}
