'use client';

/**
 * Deal Intelligence Brief intake: ten short screens, one idea each.
 *
 * Design rules: one column, generous space, a thin progress bar instead of a
 * rail, large pill selectors, one primary action per screen, Enter advances,
 * a draft that survives a reload, a review screen before submit. Only the
 * asset screens and the contact screen are required; the rest can be skipped
 * and the review says what each skipped section leaves out of the brief.
 *
 * The payload posted to /api/benchmark/intake is unchanged.
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

type Screen = 'identity' | 'stage' | 'deal' | 'model' | 'runway' | 'offers' | 'buyers' | 'package' | 'contact' | 'review';
const SCREENS: Array<{ key: Screen; group: string; title: string; why: string; required?: boolean }> = [
  { key: 'identity', group: 'The asset', title: 'Which asset is this brief about?', why: 'One asset, one decision. Everything that follows is about this program.', required: true },
  { key: 'stage', group: 'The asset', title: 'Stage and modality', why: 'These set the comparable window and the risk chain.', required: true },
  { key: 'deal', group: 'The asset', title: 'The deal you are preparing for', why: 'Structure and territory shape the ask; the package stage shapes what a buyer will expect.' },
  { key: 'model', group: 'Your data', title: 'Your own model', why: 'Optional and the most valuable section. The brief sets your numbers against ours line by line and says where each gap comes from.' },
  { key: 'runway', group: 'Your data', title: 'Runway and financing', why: 'The partner-now versus fund-to-the-readout page uses your real cash and raise, not an assumed one.' },
  { key: 'offers', group: 'Your data', title: 'Offers on the table', why: 'Anything already received is printed against the floor and the ask.' },
  { key: 'buyers', group: 'Your data', title: 'Counterparties and rights', why: 'Buyers you name are assessed on the same terms as the ones we rank; encumbrances go into the term sheet.' },
  { key: 'package', group: 'Your data', title: 'What is in the data package', why: 'The diligence-readiness page lists what a buyer will ask for and marks each item ready or open.' },
  { key: 'contact', group: 'Invoice', title: 'Contact and invoice', why: `${BENCHMARK_PRICING.PRICE}, invoiced within one business day. No card, no checkout.`, required: true },
  { key: 'review', group: 'Review', title: 'Review and submit', why: 'What we have, and what each section adds to the brief.' },
];

const num = (v: string): number | null => { const t = v.replace(/[$,\s]/g, ''); if (!t) return null; const x = Number(t); return Number.isFinite(x) ? x : null; };
const list = (v: string): string[] => v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
const DRAFT_KEY = 'solidus-brief-intake-draft-v2';

const input = 'w-full rounded-xl border border-slate-700/70 bg-transparent px-4 py-3 text-base text-slate-50 placeholder:text-slate-600 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-500/10';
const label = 'mb-2 block text-sm text-slate-400';
const pill = (on: boolean) => `rounded-full px-4 py-2 text-sm font-medium transition-all ${on ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/25' : 'ring-1 ring-slate-700 text-slate-300 hover:ring-slate-500 hover:text-slate-100'}`;

function Field({ l, children, hint }: { l: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className={label}>{l}</label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}
function Pills({ options, value, onChange }: { options: ReadonlyArray<readonly [string, string]> | ReadonlyArray<string>; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(options as ReadonlyArray<string | readonly [string, string]>).map(o => {
        const k = typeof o === 'string' ? o : o[0];
        const l = typeof o === 'string' ? o : o[1];
        return <button type="button" key={k} className={pill(value === k)} onClick={() => onChange(k)}>{l}</button>;
      })}
    </div>
  );
}

export function BriefIntakeForm({ prefill = {}, intakePath }: Props) {
  const [d, setD] = useState<Draft>(() => blank(prefill));
  const [i, setI] = useState(0);
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; msg?: string; requestId?: string }>({ kind: 'idle' });
  const top = useRef<HTMLDivElement | null>(null);
  const hydrated = useRef(false);
  const screen = SCREENS[i];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Draft>;
        const pre = Object.fromEntries(Object.entries(prefill).filter(([k, v]) => v && k !== 'ref')) as Partial<Draft>;
        setD(prev => ({ ...prev, ...saved, ...pre }));
      }
    } catch { /* storage unavailable */ }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (hydrated.current) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ } } }, [d]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }));
  const identityOk = !!(d.indication.trim() && d.ta);
  const stageOk = !!(d.phase && d.modality);
  const contactOk = !!(d.name.trim() && /\S+@\S+\.\S+/.test(d.email));
  const modelFilled = useMemo(() => [d.peak, d.pos, d.launch, d.devCost, d.expUp, d.expTotal].some(v => v.trim()), [d]);
  const runwayFilled = [d.cash, d.runway, d.raise, d.raiseDate].some(v => v.trim());
  const offersFilled = d.offers.some(o => o.party.trim()) || !!d.termSheets.trim();
  const buyersFilled = !!(d.targetBuyers.trim() || d.excludedBuyers.trim() || d.upstream.trim() || d.ip.trim());
  const pkgCount = Object.values(d.pkg).filter(Boolean).length;
  const okFor = (k: Screen) => (k === 'identity' ? identityOk : k === 'stage' ? stageOk : k === 'contact' ? contactOk : true);

  const go = (n: number) => {
    setI(Math.max(0, Math.min(SCREENS.length - 1, n)));
    setTouched(false);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const next = () => { if (!okFor(screen.key)) { setTouched(true); return; } go(i + 1); };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && screen.key !== 'review') { e.preventDefault(); next(); } };

  async function submit() {
    if (!identityOk || !stageOk || !contactOk || state.kind === 'busy') { setTouched(true); return; }
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
      <div className="mx-auto max-w-xl py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-400">Intake received</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-slate-50">{d.assetName ? `${d.assetName}, ` : ''}{d.indication}, {d.phase}.</h2>
        <ol className="mt-8 space-y-5 text-base leading-relaxed text-slate-300">
          {[
            `An invoice for ${BENCHMARK_PRICING.PRICE} follows within one business day${d.billingEntity ? ` to ${d.billingEntity}` : ''}. It is credited in full against a subsequent advisory mandate.`,
            'On receipt, a 15-minute call to confirm the asset and the counterparties you want in or out.',
            'The brief within 24 hours of the call, in a private data room, with a 30-minute walkthrough arranged by reply.',
          ].map((t, k) => <li key={k} className="flex gap-4"><span className="font-mono text-teal-400">0{k + 1}</span><span>{t}</span></li>)}
        </ol>
        <p className="mt-8 text-sm text-slate-500">Reference {state.requestId}. A confirmation is on its way to {d.email}.</p>
      </div>
    );
  }

  const pct = Math.round((i / (SCREENS.length - 1)) * 100);
  const optional = !screen.required && screen.key !== 'review';

  return (
    <div ref={top} className="mx-auto max-w-2xl scroll-mt-28" onKeyDown={onKey}>
      {/* Progress */}
      <div className="mb-10">
        <div className="flex items-baseline justify-between text-xs text-slate-500">
          <span><span className="text-slate-300">{screen.group}</span> · {i + 1} of {SCREENS.length}</span>
          <span>Draft saved on this device</span>
        </div>
        <div className="mt-2 h-px w-full bg-slate-800"><div className="h-px bg-teal-400 transition-all duration-500" style={{ width: `${pct}%` }} /></div>
      </div>

      <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-slate-50">{screen.title}</h2>
      <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-400">{screen.why}</p>

      <div className="mt-10 space-y-8">
        {screen.key === 'identity' ? (<>
          <Field l="Asset or program"><input className={input} value={d.assetName} onChange={e => set('assetName', e.target.value)} placeholder="AMB-201" autoFocus /></Field>
          <Field l="Indication *"><input className={input} value={d.indication} onChange={e => set('indication', e.target.value)} placeholder="Alzheimer’s disease" />{touched && !d.indication.trim() ? <p className="mt-1.5 text-xs text-rose-400">Required.</p> : null}</Field>
          <Field l="Therapeutic area *"><Pills options={THERAPEUTIC_AREAS} value={d.ta} onChange={v => set('ta', v)} />{touched && !d.ta ? <p className="mt-1.5 text-xs text-rose-400">Pick one.</p> : null}</Field>
        </>) : null}

        {screen.key === 'stage' ? (<>
          <Field l="Stage at signing *"><Pills options={PHASES} value={d.phase} onChange={v => set('phase', v)} />{touched && !d.phase ? <p className="mt-1.5 text-xs text-rose-400">Pick one.</p> : null}</Field>
          <Field l="Modality *"><Pills options={MODALITIES} value={d.modality} onChange={v => set('modality', v)} />{touched && !d.modality ? <p className="mt-1.5 text-xs text-rose-400">Pick one.</p> : null}</Field>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field l="Mechanism"><input className={input} value={d.mechanism} onChange={e => set('mechanism', e.target.value)} placeholder="anti-tau antibody" /></Field>
            <Field l="Target"><input className={input} value={d.target} onChange={e => set('target', e.target.value)} placeholder="MAPT" /></Field>
          </div>
        </>) : null}

        {screen.key === 'deal' ? (<>
          <Field l="Structure you are preparing for"><Pills options={DEAL_TYPES} value={d.dealType} onChange={v => set('dealType', v)} /></Field>
          <Field l="Territory on offer"><Pills options={TERRITORIES} value={d.territory} onChange={v => set('territory', v)} /></Field>
          <Field l="Data package stage"><Pills options={DATA_PACKAGE_STAGES} value={d.stage} onChange={v => set('stage', v)} /></Field>
          <Field l="What makes it different" hint="The claim you want a buyer to test: selectivity, delivery, biomarker, competitive position."><textarea className={input} rows={3} value={d.differentiation} onChange={e => set('differentiation', e.target.value)} /></Field>
        </>) : null}

        {screen.key === 'model' ? (<>
          <div className="grid gap-6 sm:grid-cols-3">
            <Field l="Peak sales, $M / yr"><input className={input} inputMode="decimal" value={d.peak} onChange={e => set('peak', e.target.value)} placeholder="1,200" autoFocus /></Field>
            <Field l="Probability to approval, %"><input className={input} inputMode="decimal" value={d.pos} onChange={e => set('pos', e.target.value)} placeholder="12" /></Field>
            <Field l="Launch year"><input className={input} inputMode="numeric" value={d.launch} onChange={e => set('launch', e.target.value)} placeholder="2033" /></Field>
            <Field l="Cost to approval, $M"><input className={input} inputMode="decimal" value={d.devCost} onChange={e => set('devCost', e.target.value)} placeholder="250" /></Field>
            <Field l="Upfront you expect, $M"><input className={input} inputMode="decimal" value={d.expUp} onChange={e => set('expUp', e.target.value)} placeholder="60" /></Field>
            <Field l="Total value you expect, $M"><input className={input} inputMode="decimal" value={d.expTotal} onChange={e => set('expTotal', e.target.value)} placeholder="800" /></Field>
          </div>
          <Field l="Notes on your model" hint="Source of the peak-sales view, pricing assumption, geography, anything a buyer will challenge."><textarea className={input} rows={2} value={d.modelNotes} onChange={e => set('modelNotes', e.target.value)} /></Field>
        </>) : null}

        {screen.key === 'runway' ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <Field l="Cash on hand, $M"><input className={input} inputMode="decimal" value={d.cash} onChange={e => set('cash', e.target.value)} autoFocus /></Field>
            <Field l="Runway, months"><input className={input} inputMode="numeric" value={d.runway} onChange={e => set('runway', e.target.value)} /></Field>
            <Field l="Next raise, $M"><input className={input} inputMode="decimal" value={d.raise} onChange={e => set('raise', e.target.value)} /></Field>
            <Field l="Expected close"><input className={input} value={d.raiseDate} onChange={e => set('raiseDate', e.target.value)} placeholder="2027-03" /></Field>
          </div>
        ) : null}

        {screen.key === 'offers' ? (<>
          <div className="space-y-4">
            {d.offers.length === 0 ? <p className="text-base text-slate-500">No offers yet. That is fine; the brief prints the floor and the ask against a clean slate.</p> : null}
            {d.offers.map((o, k) => (
              <div key={k} className="space-y-3 rounded-2xl border border-slate-800 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className={input} placeholder="Counterparty" value={o.party} onChange={e => set('offers', d.offers.map((x, j) => j === k ? { ...x, party: e.target.value } : x))} />
                  <input className={input} placeholder="When (YYYY-MM)" value={o.date} onChange={e => set('offers', d.offers.map((x, j) => j === k ? { ...x, date: e.target.value } : x))} />
                  <input className={input} placeholder="Upfront, $M" inputMode="decimal" value={o.upfrontM} onChange={e => set('offers', d.offers.map((x, j) => j === k ? { ...x, upfrontM: e.target.value } : x))} />
                  <input className={input} placeholder="Total, $M" inputMode="decimal" value={o.totalM} onChange={e => set('offers', d.offers.map((x, j) => j === k ? { ...x, totalM: e.target.value } : x))} />
                </div>
                <Pills options={PRIOR_OFFER_STATUSES} value={o.status} onChange={v => set('offers', d.offers.map((x, j) => j === k ? { ...x, status: v as PriorOffer['status'] } : x))} />
                <input className={input} placeholder="Structure and what stalled" value={o.notes} onChange={e => set('offers', d.offers.map((x, j) => j === k ? { ...x, notes: e.target.value } : x))} />
                <button type="button" className="text-xs text-slate-500 hover:text-rose-400" onClick={() => set('offers', d.offers.filter((_, j) => j !== k))}>Remove this offer</button>
              </div>
            ))}
            <button type="button" className="rounded-full ring-1 ring-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:ring-slate-500" onClick={() => set('offers', [...d.offers, emptyOffer()])}>+ Add an offer</button>
          </div>
          <Field l="Term sheets received so far, in total"><input className={`${input} sm:max-w-[200px]`} inputMode="numeric" value={d.termSheets} onChange={e => set('termSheets', e.target.value)} placeholder="0" /></Field>
        </>) : null}

        {screen.key === 'buyers' ? (<>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field l="Buyers you want assessed" hint="Comma-separated."><input className={input} value={d.targetBuyers} onChange={e => set('targetBuyers', e.target.value)} autoFocus /></Field>
            <Field l="Buyers to exclude" hint="Comma-separated."><input className={input} value={d.excludedBuyers} onChange={e => set('excludedBuyers', e.target.value)} /></Field>
          </div>
          <Field l="Upstream licences or encumbrances" hint="Academic licence, royalty stack, platform rights, co-owned IP."><textarea className={input} rows={2} value={d.upstream} onChange={e => set('upstream', e.target.value)} /></Field>
          <Field l="IP notes" hint="Composition-of-matter expiry, key filings, FTO status."><textarea className={input} rows={2} value={d.ip} onChange={e => set('ip', e.target.value)} /></Field>
        </>) : null}

        {screen.key === 'package' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {DATA_PACKAGE_ITEMS.map(item => {
              const on = d.pkg[item.key] === true;
              return (
                <button type="button" key={item.key} onClick={() => set('pkg', { ...d.pkg, [item.key]: !on })} className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition ${on ? 'bg-teal-500/10 ring-1 ring-teal-400/60' : 'ring-1 ring-slate-800 hover:ring-slate-600'}`}>
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] ${on ? 'bg-teal-500 text-slate-950' : 'ring-1 ring-slate-600'}`}>{on ? '✓' : ''}</span>
                  <span><span className="block text-sm font-medium text-slate-100">{item.label}</span><span className="block text-xs text-slate-500">{item.area}</span></span>
                </button>
              );
            })}
          </div>
        ) : null}

        {screen.key === 'contact' ? (<>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field l="Your name *"><input className={input} value={d.name} onChange={e => set('name', e.target.value)} autoFocus />{touched && !d.name.trim() ? <p className="mt-1.5 text-xs text-rose-400">Required.</p> : null}</Field>
            <Field l="Email *"><input className={input} type="email" value={d.email} onChange={e => set('email', e.target.value)} />{touched && !/\S+@\S+\.\S+/.test(d.email) ? <p className="mt-1.5 text-xs text-rose-400">A valid email is required.</p> : null}</Field>
            <Field l="Company"><input className={input} value={d.company} onChange={e => set('company', e.target.value)} /></Field>
            <Field l="Title"><input className={input} value={d.title} onChange={e => set('title', e.target.value)} /></Field>
          </div>
          <div className="border-t border-slate-800 pt-8">
            <p className="text-sm text-slate-400">The invoice goes to your company at your email unless you say otherwise. It is credited in full against a subsequent advisory mandate.</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <Field l="Invoice to (legal entity)"><input className={input} value={d.billingEntity} onChange={e => set('billingEntity', e.target.value)} placeholder={d.company || 'Your company'} /></Field>
              <Field l="Billing email"><input className={input} type="email" value={d.billingEmail} onChange={e => set('billingEmail', e.target.value)} placeholder={d.email || 'Your email'} /></Field>
              <Field l="Billing address"><textarea className={input} rows={2} value={d.billingAddress} onChange={e => set('billingAddress', e.target.value)} /></Field>
              <Field l="PO number, if required"><input className={input} value={d.po} onChange={e => set('po', e.target.value)} /></Field>
            </div>
          </div>
        </>) : null}

        {screen.key === 'review' ? (
          <div className="divide-y divide-slate-800 border-y border-slate-800">
            {([
              ['The asset', `${d.assetName || 'Unnamed'} · ${d.indication || '—'} · ${d.phase || '—'} · ${MODALITIES.find(m => m[0] === d.modality)?.[1] ?? '—'} · ${d.dealType} · ${TERRITORIES.find(t => t[0] === d.territory)?.[1] ?? d.territory}`, 0, identityOk && stageOk],
              ['Your model', modelFilled ? `Peak $${d.peak || '—'}M · PoS ${d.pos || '—'}% · launch ${d.launch || '—'} · cost $${d.devCost || '—'}M · expects $${d.expUp || '—'}M up / $${d.expTotal || '—'}M total` : 'Not supplied. The “your model vs Solidus” page prints an empty state.', 3, modelFilled],
              ['Runway', runwayFilled ? `Cash $${d.cash || '—'}M · ${d.runway || '—'} months · next raise $${d.raise || '—'}M ${d.raiseDate}` : 'Not supplied. The fund-or-partner page uses a benchmark raise.', 4, runwayFilled],
              ['Offers', offersFilled ? `${d.offers.filter(o => o.party.trim()).length} offer(s)${d.termSheets ? ` · ${d.termSheets} term sheets` : ''}` : 'None on the table.', 5, offersFilled],
              ['Counterparties', buyersFilled ? `Assess: ${d.targetBuyers || '—'} · exclude: ${d.excludedBuyers || '—'}` : 'No named buyers or encumbrances.', 6, buyersFilled],
              ['Data package', pkgCount ? `${pkgCount} of ${DATA_PACKAGE_ITEMS.length} items in hand` : 'Nothing ticked; every diligence item lists as open.', 7, pkgCount > 0],
              ['Contact and invoice', `${d.name || '—'} · ${d.email || '—'} · invoice to ${d.billingEntity || d.company || d.name || '—'}`, 8, contactOk],
            ] as Array<[string, string, number, boolean]>).map(([t, v, n, ok]) => (
              <div key={t} className="flex items-start justify-between gap-6 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-teal-400' : 'bg-slate-700'}`} />{t}</div>
                  <div className="mt-1 text-sm text-slate-200">{v}</div>
                </div>
                <button type="button" onClick={() => go(n)} className="shrink-0 text-sm text-teal-300 hover:text-teal-200">Edit</button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {state.kind === 'error' ? <p className="mt-6 text-sm text-rose-400">{state.msg}</p> : null}
      {screen.key === 'review' && touched && (!identityOk || !stageOk || !contactOk) ? <p className="mt-6 text-sm text-rose-400">The asset, its stage and your contact details are required.</p> : null}

      {/* Actions */}
      <div className="mt-12 flex items-center justify-between">
        <button type="button" onClick={() => go(i - 1)} className={`text-sm text-slate-500 transition hover:text-slate-200 ${i === 0 ? 'invisible' : ''}`}>← Back</button>
        <div className="flex items-center gap-5">
          {optional ? <button type="button" onClick={() => go(i + 1)} className="text-sm text-slate-500 hover:text-slate-300">Skip</button> : null}
          {screen.key === 'review'
            ? <button type="button" onClick={submit} disabled={state.kind === 'busy'} className="rounded-full bg-teal-500 px-7 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-400 disabled:opacity-50">{state.kind === 'busy' ? 'Sending…' : `Submit · invoice ${BENCHMARK_PRICING.PRICE}`}</button>
            : <button type="button" onClick={next} className="rounded-full bg-teal-500 px-7 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-400">Continue</button>}
        </div>
      </div>
      {screen.key === 'review' ? <p className="mt-6 text-xs leading-relaxed text-slate-600">Everything you enter stays in your brief and your data room. Nothing is published in a way that identifies you or the asset.</p> : null}
    </div>
  );
}
