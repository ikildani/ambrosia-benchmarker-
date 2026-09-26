'use client';

/**
 * Deal Intelligence Brief intake: ten short screens, one idea each, and the
 * later screens adapt to the earlier answers.
 *
 * - Indication autocomplete from the engine's registry; picking one also
 *   picks the therapeutic area.
 * - Once area, stage and modality are known, the form fetches what Solidus
 *   sees for that profile (peak sales, cumulative PoS, years to launch, the
 *   size of the comparable set, the most active buyers) and shows it beside
 *   the client's own fields, so their number sits next to ours before the
 *   brief is built.
 * - Structure and territory drive follow-ups (option fee and evaluation
 *   period, cost-share appetite, a price floor for an acquisition, Greater
 *   China rights), stored as structurePrefs and printed on the term sheet.
 * - The data-package list only shows items a buyer would expect at this stage.
 * - Offers open with a yes/no gate; runway under twelve months gets a note.
 *
 * Design rules: one column, generous space, a thin progress bar, large pill
 * selectors, one primary action per screen, Enter advances, a draft that
 * survives a reload, a review screen before submit.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BENCHMARK_PRICING } from '@/lib/config/constants';
import { DATA_PACKAGE_ITEMS, PRIOR_OFFER_STATUSES, type PriorOffer } from '@/lib/brief/client-intake';
import { suggestIndications, type IndicationOption } from '@/lib/brief/indication-options';

const THERAPEUTIC_AREAS = ['Oncology', 'Neurology', 'Immunology', 'Rare Disease', 'Cardiovascular', 'Metabolic', 'Hematology', 'Ophthalmology', 'Dermatology', 'Infectious Disease', 'Gastroenterology', "Women's Health"] as const;
const PHASES = ['Preclinical', 'Phase 1', 'Phase 1/2', 'Phase 2', 'Phase 2/3', 'Phase 3'] as const;
const MODALITIES = [['SM', 'Small molecule'], ['mAb', 'Monoclonal antibody'], ['ADC', 'Antibody-drug conjugate'], ['BSAB', 'Bispecific'], ['TSAB', 'Trispecific'], ['GT', 'Gene therapy'], ['CT', 'Cell therapy'], ['RNAi', 'siRNA'], ['ASO', 'Antisense'], ['mRNA', 'mRNA'], ['PEP', 'Peptide'], ['RP', 'Radiopharmaceutical'], ['VAX', 'Vaccine'], ['OTH', 'Other']] as const;
const DEAL_TYPES = ['Licensing', 'Option', 'Co-Development', 'M&A / Acquisition'] as const;
const TERRITORIES = [['global', 'Global'], ['us', 'US only'], ['ex_us', 'Ex-US'], ['ex_china', 'Ex-China'], ['japan', 'Japan'], ['china', 'China']] as const;
const YES_NO = [['yes', 'Yes'], ['no', 'No']] as const;

/** Package stages a buyer would plausibly see at each phase. */
const PACKAGE_STAGES: Record<string, string[]> = {
  Preclinical: ['Discovery / hit-to-lead', 'In vivo efficacy in hand', 'IND-enabling underway', 'IND-enabling complete / IND filed'],
  'Phase 1': ['IND-enabling complete / IND filed', 'Phase 1 data in hand'],
  'Phase 1/2': ['Phase 1 data in hand', 'Phase 2 data in hand'],
  'Phase 2': ['Phase 1 data in hand', 'Phase 2 data in hand'],
  'Phase 2/3': ['Phase 2 data in hand', 'Phase 3 data in hand'],
  'Phase 3': ['Phase 2 data in hand', 'Phase 3 data in hand'],
};
/** Diligence items a buyer asks for at each phase (keys from DATA_PACKAGE_ITEMS). */
const PACKAGE_HIDE: Record<string, string[]> = {
  Preclinical: ['phase1_data', 'phase2_data'],
  'Phase 1': ['phase2_data'],
  'Phase 1/2': [],
  'Phase 2': [],
  'Phase 2/3': [],
  'Phase 3': [],
};
const CLINICAL = new Set(['Phase 1', 'Phase 1/2', 'Phase 2', 'Phase 2/3', 'Phase 3']);

export interface IntakePrefill { name?: string; email?: string; company?: string; title?: string; assetName?: string; indication?: string; ref?: string }
interface Props { prefill?: IntakePrefill; intakePath: '/intake' | '/brief' }

type OfferDraft = { party: string; date: string; upfrontM: string; totalM: string; status: PriorOffer['status']; notes: string };
const emptyOffer = (): OfferDraft => ({ party: '', date: '', upfrontM: '', totalM: '', status: 'received', notes: '' });

interface Draft {
  name: string; email: string; company: string; title: string;
  assetName: string; ta: string; indication: string; phase: string; modality: string; mechanism: string; target: string; dealType: string; territory: string; stage: string; differentiation: string;
  // structure follow-ups
  optionFeeM: string; optionMonths: string; costSharePct: string; coPromote: string; minPriceM: string; chinaLicensed: string; chinaPartner: string; readoutDate: string;
  peak: string; pos: string; launch: string; devCost: string; expUp: string; expTotal: string; modelNotes: string;
  cash: string; runway: string; raise: string; raiseDate: string;
  hasOffers: string; offers: OfferDraft[]; termSheets: string; targetBuyers: string; excludedBuyers: string; upstream: string; ip: string;
  pkg: Record<string, boolean>;
  billingEntity: string; billingAddress: string; billingEmail: string; po: string;
}
const blank = (p: IntakePrefill): Draft => ({
  name: p.name ?? '', email: p.email ?? '', company: p.company ?? '', title: p.title ?? '',
  assetName: p.assetName ?? '', ta: '', indication: p.indication ?? '', phase: '', modality: '', mechanism: '', target: '', dealType: 'Licensing', territory: 'global', stage: '', differentiation: '',
  optionFeeM: '', optionMonths: '', costSharePct: '', coPromote: '', minPriceM: '', chinaLicensed: '', chinaPartner: '', readoutDate: '',
  peak: '', pos: '', launch: '', devCost: '', expUp: '', expTotal: '', modelNotes: '',
  cash: '', runway: '', raise: '', raiseDate: '',
  hasOffers: '', offers: [], termSheets: '', targetBuyers: '', excludedBuyers: '', upstream: '', ip: '',
  pkg: {},
  billingEntity: '', billingAddress: '', billingEmail: '', po: '',
});

interface Ctx {
  ta: string; phase: string;
  indication: { key: string; label: string; matched: boolean };
  solidus: { peakSalesM: number | null; cumulativePoSPct: number | null; yearsToLaunch: number | null };
  comps: { eligible: number; window: string };
  topBuyers: Array<{ name: string; deals: number }>;
}

type Screen = 'identity' | 'stage' | 'deal' | 'model' | 'runway' | 'offers' | 'buyers' | 'package' | 'contact' | 'review';
const SCREENS: Array<{ key: Screen; group: string; title: string; why: string; required?: boolean }> = [
  { key: 'identity', group: 'The asset', title: 'Which asset is this brief about?', why: 'One asset, one decision. Everything that follows is about this program.', required: true },
  { key: 'stage', group: 'The asset', title: 'Stage and modality', why: 'These set the comparable window and the risk chain.', required: true },
  { key: 'deal', group: 'The asset', title: 'The deal you are preparing for', why: 'Structure and territory shape the ask and the term sheet; the package stage shapes what a buyer will expect.' },
  { key: 'model', group: 'Your data', title: 'Your own model', why: 'Optional and the most valuable section. The brief sets your numbers against ours line by line and says where each gap comes from.' },
  { key: 'runway', group: 'Your data', title: 'Runway and financing', why: 'The partner-now versus fund-to-the-readout page uses your real cash and raise, not an assumed one.' },
  { key: 'offers', group: 'Your data', title: 'Offers on the table', why: 'Anything already received is printed against the floor and the ask.' },
  { key: 'buyers', group: 'Your data', title: 'Counterparties and rights', why: 'Buyers you name are assessed on the same terms as the ones we rank; encumbrances go into the term sheet.' },
  { key: 'package', group: 'Your data', title: 'What is in the data package', why: 'The diligence-readiness page lists what a buyer will ask for at this stage and marks each item ready or open.' },
  { key: 'contact', group: 'Invoice', title: 'Contact and invoice', why: `${BENCHMARK_PRICING.PRICE}, invoiced within one business day. No card, no checkout.`, required: true },
  { key: 'review', group: 'Review', title: 'Review and submit', why: 'What we have, and what each section adds to the brief.' },
];

const num = (v: string): number | null => { const t = v.replace(/[$,\s]/g, ''); if (!t) return null; const x = Number(t); return Number.isFinite(x) ? x : null; };
const list = (v: string): string[] => v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
const fmtM = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${Math.round(v)}M`);
const DRAFT_KEY = 'solidus-brief-intake-draft-v3';

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
/** A quiet, contextual line the form adds once it knows enough to say something. */
function Note({ children, tone = 'teal' }: { children: React.ReactNode; tone?: 'teal' | 'amber' }) {
  return (
    <div className={`flex gap-3 rounded-2xl px-4 py-3 text-sm leading-relaxed ${tone === 'amber' ? 'bg-amber-500/5 text-amber-100/90 ring-1 ring-amber-400/20' : 'bg-teal-500/5 text-slate-300 ring-1 ring-teal-400/15'}`}>
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'amber' ? 'bg-amber-400' : 'bg-teal-400'}`} />
      <span>{children}</span>
    </div>
  );
}
/** A follow-up that slides in under the answer that triggered it. */
function FollowUp({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6 border-l border-teal-400/30 pl-5">{children}</div>;
}

function IndicationInput({ value, ta, onPick, onChange, invalid }: { value: string; ta: string; onPick: (o: IndicationOption) => void; onChange: (v: string) => void; invalid: boolean }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const options = useMemo(() => suggestIndications(value, ta || null), [value, ta]);
  const exact = options.some(o => o.label.toLowerCase() === value.trim().toLowerCase());
  const show = open && options.length > 0 && !exact;
  return (
    <div className="relative">
      <input
        className={input}
        value={value}
        placeholder="Alzheimer’s disease"
        autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={e => {
          if (!show) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(options.length - 1, h + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)); }
          else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); onPick(options[hi]); setOpen(false); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {show ? (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-700/70 bg-[#0b1220] shadow-2xl shadow-black/50">
          {options.map((o, k) => (
            <li key={o.value}>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(o); setOpen(false); }} className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition ${k === hi ? 'bg-teal-500/10 text-slate-50' : 'text-slate-300 hover:bg-slate-800/60'}`}>
                <span>{o.label}</span><span className="text-xs text-slate-500">{o.ta}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {invalid ? <p className="mt-1.5 text-xs text-rose-400">Required.</p> : <p className="mt-1.5 text-xs text-slate-600">{exact ? 'In the Solidus registry; the epidemiology and the comparable set are indication-specific.' : 'Start typing; pick from the list to lock the area, or keep your own wording.'}</p>}
    </div>
  );
}

function SolidusPanel({ ctx, loading, phase, indication }: { ctx: Ctx | null; loading: boolean; phase: string; indication: string }) {
  const s = ctx?.solidus;
  const launchYear = s?.yearsToLaunch != null ? new Date().getUTCFullYear() + Math.round(s.yearsToLaunch) : null;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-400">What Solidus sees</p>
        <p className="text-xs text-slate-500">{loading ? 'Reading the deal set…' : ctx ? `${ctx.indication.label} · ${phase}` : indication}</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {[
          ['Peak sales', s?.peakSalesM != null ? `${fmtM(s.peakSalesM)} / yr` : '—', 'epidemiology-based, before your override'],
          ['PoS to approval', s?.cumulativePoSPct != null ? `${s.cumulativePoSPct}%` : '—', 'cumulative from this stage'],
          ['Launch', launchYear ? `${launchYear}` : '—', s?.yearsToLaunch != null ? `${s.yearsToLaunch} years at median durations` : ''],
          ['Comparable deals', ctx ? `${ctx.comps.eligible}` : '—', ctx ? 'disclosed, adjacent stages, this area' : ''],
        ].map(([k, v, h]) => (
          <div key={k}>
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="mt-1 font-display text-xl font-semibold text-slate-50">{loading && !ctx ? <span className="inline-block h-5 w-16 animate-pulse rounded bg-slate-800" /> : v}</dd>
            {h ? <dd className="mt-0.5 text-[11px] text-slate-600">{h}</dd> : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

export function BriefIntakeForm({ prefill = {}, intakePath }: Props) {
  const [d, setD] = useState<Draft>(() => blank(prefill));
  const [i, setI] = useState(0);
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; msg?: string; requestId?: string }>({ kind: 'idle' });
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
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

  // What Solidus sees for this profile, refreshed when the profile changes.
  useEffect(() => {
    if (!d.ta || !d.phase) { setCtx(null); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setCtxLoading(true);
      try {
        const q = new URLSearchParams({ ta: d.ta, phase: d.phase, indication: d.indication, modality: d.modality });
        const res = await fetch(`/api/brief/intake-context?${q}`, { signal: ctrl.signal });
        if (res.ok) setCtx(await res.json() as Ctx);
      } catch { /* keep the last context */ } finally { if (!ctrl.signal.aborted) setCtxLoading(false); }
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [d.ta, d.phase, d.indication, d.modality]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }));
  const identityOk = !!(d.indication.trim() && d.ta);
  const stageOk = !!(d.phase && d.modality);
  const contactOk = !!(d.name.trim() && /\S+@\S+\.\S+/.test(d.email));
  const modelFilled = useMemo(() => [d.peak, d.pos, d.launch, d.devCost, d.expUp, d.expTotal].some(v => v.trim()), [d]);
  const runwayFilled = [d.cash, d.runway, d.raise, d.raiseDate].some(v => v.trim());
  const offersFilled = d.offers.some(o => o.party.trim()) || !!d.termSheets.trim();
  const buyersFilled = !!(d.targetBuyers.trim() || d.excludedBuyers.trim() || d.upstream.trim() || d.ip.trim());
  const pkgItems = useMemo(() => DATA_PACKAGE_ITEMS.filter(it => !(PACKAGE_HIDE[d.phase] ?? []).includes(it.key)), [d.phase]);
  const pkgCount = pkgItems.filter(it => d.pkg[it.key]).length;
  const stageOptions = PACKAGE_STAGES[d.phase] ?? Object.values(PACKAGE_STAGES).flat().filter((v, k, a) => a.indexOf(v) === k);
  const isOption = d.dealType === 'Option';
  const isCodev = d.dealType === 'Co-Development';
  const isMA = d.dealType.startsWith('M&A');
  const asksChina = d.territory === 'global' || d.territory === 'ex_us' || d.territory === 'ex_china';
  const clinical = CLINICAL.has(d.phase);
  const okFor = (k: Screen) => (k === 'identity' ? identityOk : k === 'stage' ? stageOk : k === 'contact' ? contactOk : true);

  const peakN = num(d.peak);
  const peakRatio = peakN && ctx?.solidus.peakSalesM ? peakN / ctx.solidus.peakSalesM : null;
  const runwayN = num(d.runway);
  const readoutMonths = useMemo(() => {
    const m = /^(\d{4})-(\d{2})/.exec(d.readoutDate.trim());
    if (!m) return null;
    const now = new Date();
    return (Number(m[1]) - now.getUTCFullYear()) * 12 + (Number(m[2]) - (now.getUTCMonth() + 1));
  }, [d.readoutDate]);

  const go = (n: number) => {
    setI(Math.max(0, Math.min(SCREENS.length - 1, n)));
    setTouched(false);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const next = () => { if (!okFor(screen.key)) { setTouched(true); return; } go(i + 1); };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && screen.key !== 'review') { e.preventDefault(); next(); } };
  const addBuyer = (name: string) => { const cur = list(d.targetBuyers); if (!cur.includes(name)) set('targetBuyers', [...cur, name].join(', ')); };

  async function submit() {
    if (!identityOk || !stageOk || !contactOk || state.kind === 'busy') { setTouched(true); return; }
    setState({ kind: 'busy' });
    const prefs: Record<string, string | number | boolean> = {};
    if (isOption) { if (num(d.optionFeeM) != null) prefs.optionFeeM = num(d.optionFeeM) as number; if (num(d.optionMonths) != null) prefs.optionMonths = num(d.optionMonths) as number; }
    if (isCodev) { if (num(d.costSharePct) != null) prefs.costSharePct = num(d.costSharePct) as number; if (d.coPromote) prefs.coPromote = d.coPromote === 'yes'; }
    if (isMA && num(d.minPriceM) != null) prefs.minPriceM = num(d.minPriceM) as number;
    if (asksChina && d.chinaLicensed) { prefs.chinaLicensed = d.chinaLicensed === 'yes'; if (d.chinaLicensed === 'yes' && d.chinaPartner.trim()) prefs.chinaPartner = d.chinaPartner.trim(); }
    if (clinical && d.readoutDate.trim()) prefs.readoutDate = d.readoutDate.trim();
    const body = {
      name: d.name.trim(), email: d.email.trim(), company: d.company.trim() || null, title: d.title.trim() || null,
      therapeuticArea: d.ta, indication: d.indication.trim(), phase: d.phase, modality: d.modality,
      assetName: d.assetName.trim() || null, mechanism: d.mechanism.trim() || null, target: d.target.trim() || null,
      targetDealType: d.dealType, territory: d.territory, dataPackageStage: d.stage || null, differentiationNotes: d.differentiation.trim() || null,
      client: {
        model: modelFilled ? { peakSalesM: num(d.peak), posToApprovalPct: num(d.pos), launchYear: num(d.launch), devCostToApprovalM: num(d.devCost), expectedUpfrontM: num(d.expUp), expectedTotalM: num(d.expTotal), notes: d.modelNotes.trim() || null } : null,
        financing: runwayFilled ? { cashOnHandM: num(d.cash), runwayMonths: num(d.runway), nextRaiseM: num(d.raise), nextRaiseDate: d.raiseDate.trim() || null } : null,
        priorOffers: d.hasOffers === 'no' ? [] : d.offers.filter(o => o.party.trim()).map(o => ({ party: o.party.trim(), date: o.date.trim() || null, upfrontM: num(o.upfrontM), totalM: num(o.totalM), structure: null, status: o.status, notes: o.notes.trim() || null })),
        termSheetsReceived: d.hasOffers === 'no' ? 0 : num(d.termSheets),
        targetBuyers: list(d.targetBuyers), excludedBuyers: list(d.excludedBuyers),
        upstreamLicenses: d.upstream.trim() || null, ipNotes: d.ip.trim() || null,
        dataPackage: Object.fromEntries(pkgItems.map(it => [it.key, d.pkg[it.key] === true])),
        structurePrefs: prefs,
      },
      structurePrefs: prefs,
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
            'A first draft of your brief starts building now from what you entered. It is not sent; it is what the call reviews.',
            `An invoice for ${BENCHMARK_PRICING.PRICE} follows within one business day${d.billingEntity ? ` to ${d.billingEntity}` : ''}. It is credited in full against a subsequent advisory mandate.`,
            'On receipt, a 15-minute call to confirm the asset, the counterparties you want in or out, and anything the draft got wrong.',
            'The brief within 24 hours of the call, reviewed and signed by the Managing Partner, in a private data room with the Excel behind every figure, followed by a 30-minute walkthrough arranged by reply.',
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
          <Field l="Indication *">
            <IndicationInput value={d.indication} ta={d.ta} invalid={touched && !d.indication.trim()} onChange={v => set('indication', v)} onPick={o => setD(prev => ({ ...prev, indication: o.label, ta: o.ta }))} />
          </Field>
          <Field l="Therapeutic area *"><Pills options={THERAPEUTIC_AREAS} value={d.ta} onChange={v => set('ta', v)} />{touched && !d.ta ? <p className="mt-1.5 text-xs text-rose-400">Pick one.</p> : null}</Field>
        </>) : null}

        {screen.key === 'stage' ? (<>
          <Field l="Stage at signing *"><Pills options={PHASES} value={d.phase} onChange={v => set('phase', v)} />{touched && !d.phase ? <p className="mt-1.5 text-xs text-rose-400">Pick one.</p> : null}</Field>
          <Field l="Modality *"><Pills options={MODALITIES} value={d.modality} onChange={v => set('modality', v)} />{touched && !d.modality ? <p className="mt-1.5 text-xs text-rose-400">Pick one.</p> : null}</Field>
          {d.phase && d.ta ? (
            <Note>
              {ctxLoading && !ctx ? 'Reading the comparable set for this profile…' : ctx ? (
                ctx.comps.eligible >= 12
                  ? <>{ctx.comps.eligible} disclosed deals at adjacent stages in {d.ta.toLowerCase()} qualify as comparables. The brief scores each one against this asset and prints the top set with its source.</>
                  : <>{ctx.comps.eligible} disclosed deals at adjacent stages in {d.ta.toLowerCase()} qualify today. The brief widens to the area and says so on every figure; the headline rests on calibrated baselines, not on a thin percentile.</>
              ) : null}
            </Note>
          ) : null}
          <div className="grid gap-6 sm:grid-cols-2">
            <Field l="Mechanism"><input className={input} value={d.mechanism} onChange={e => set('mechanism', e.target.value)} placeholder="anti-tau antibody" /></Field>
            <Field l="Target"><input className={input} value={d.target} onChange={e => set('target', e.target.value)} placeholder="MAPT" /></Field>
          </div>
        </>) : null}

        {screen.key === 'deal' ? (<>
          <Field l="Structure you are preparing for"><Pills options={DEAL_TYPES} value={d.dealType} onChange={v => set('dealType', v)} /></Field>
          {isOption ? (
            <FollowUp>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field l="Option fee you would accept, $M" hint="Leave blank and the term sheet sizes it to the buyer's diligence cost."><input className={input} inputMode="decimal" value={d.optionFeeM} onChange={e => set('optionFeeM', e.target.value)} placeholder={ctx?.solidus.peakSalesM ? '' : '10'} /></Field>
                <Field l="Evaluation period you would accept, months" hint="Nine months is the term-sheet default."><input className={input} inputMode="numeric" value={d.optionMonths} onChange={e => set('optionMonths', e.target.value)} placeholder="9" /></Field>
              </div>
            </FollowUp>
          ) : null}
          {isCodev ? (
            <FollowUp>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field l="Share of development cost you would fund, %" hint="From pivotal start, in exchange for a matching profit share."><input className={input} inputMode="decimal" value={d.costSharePct} onChange={e => set('costSharePct', e.target.value)} placeholder="30" /></Field>
                <Field l="Interest in US co-promotion"><Pills options={YES_NO} value={d.coPromote} onChange={v => set('coPromote', v)} /></Field>
              </div>
            </FollowUp>
          ) : null}
          {isMA ? (
            <FollowUp>
              <Field l="Price below which you would not sell, $M" hint="Printed as the floor on the indicative term sheet, next to ours."><input className={`${input} sm:max-w-[240px]`} inputMode="decimal" value={d.minPriceM} onChange={e => set('minPriceM', e.target.value)} /></Field>
            </FollowUp>
          ) : null}
          <Field l="Territory on offer"><Pills options={TERRITORIES} value={d.territory} onChange={v => set('territory', v)} /></Field>
          {asksChina ? (
            <FollowUp>
              <Field l="Are Greater China rights already licensed?" hint={d.territory === 'global' ? 'If not, the term sheet may hold them back as a second transaction.' : 'The term sheet names the partner and carves the territory out.'}><Pills options={YES_NO} value={d.chinaLicensed} onChange={v => set('chinaLicensed', v)} /></Field>
              {d.chinaLicensed === 'yes' ? <Field l="Greater China partner"><input className={`${input} sm:max-w-[320px]`} value={d.chinaPartner} onChange={e => set('chinaPartner', e.target.value)} placeholder="Hansoh" /></Field> : null}
            </FollowUp>
          ) : null}
          <Field l="Data package stage" hint={d.phase ? `Stages a buyer would expect for a ${d.phase.toLowerCase()} asset.` : undefined}><Pills options={stageOptions} value={d.stage} onChange={v => set('stage', v)} /></Field>
          {clinical ? (
            <Field l="Next readout" hint="Drives the catalyst calendar and the exclusivity clock on the term sheet."><input className={`${input} sm:max-w-[200px]`} value={d.readoutDate} onChange={e => set('readoutDate', e.target.value)} placeholder="2027-06" /></Field>
          ) : null}
          <Field l="What makes it different" hint="The claim you want a buyer to test: selectivity, delivery, biomarker, competitive position."><textarea className={input} rows={3} value={d.differentiation} onChange={e => set('differentiation', e.target.value)} /></Field>
        </>) : null}

        {screen.key === 'model' ? (<>
          <SolidusPanel ctx={ctx} loading={ctxLoading} phase={d.phase} indication={d.indication} />
          <div className="grid gap-6 sm:grid-cols-3">
            <Field l="Peak sales, $M / yr"><input className={input} inputMode="decimal" value={d.peak} onChange={e => set('peak', e.target.value)} placeholder={ctx?.solidus.peakSalesM ? `${Math.round(ctx.solidus.peakSalesM)}` : '1,200'} autoFocus /></Field>
            <Field l="Probability to approval, %"><input className={input} inputMode="decimal" value={d.pos} onChange={e => set('pos', e.target.value)} placeholder={ctx?.solidus.cumulativePoSPct != null ? `${ctx.solidus.cumulativePoSPct}` : '12'} /></Field>
            <Field l="Launch year"><input className={input} inputMode="numeric" value={d.launch} onChange={e => set('launch', e.target.value)} placeholder={ctx?.solidus.yearsToLaunch != null ? `${new Date().getUTCFullYear() + Math.round(ctx.solidus.yearsToLaunch)}` : '2033'} /></Field>
            <Field l="Cost to approval, $M"><input className={input} inputMode="decimal" value={d.devCost} onChange={e => set('devCost', e.target.value)} placeholder="250" /></Field>
            <Field l="Upfront you expect, $M"><input className={input} inputMode="decimal" value={d.expUp} onChange={e => set('expUp', e.target.value)} placeholder="60" /></Field>
            <Field l="Total value you expect, $M"><input className={input} inputMode="decimal" value={d.expTotal} onChange={e => set('expTotal', e.target.value)} placeholder="800" /></Field>
          </div>
          {peakRatio != null ? (
            <Note tone={peakRatio > 1.5 || peakRatio < 0.67 ? 'amber' : 'teal'}>
              {peakRatio > 1.5
                ? <>Your peak sales is {peakRatio.toFixed(1)}× the Solidus epidemiology estimate. A buyer will test that first; the brief shows where the gap comes from (population, share, price, or duration) so you can defend it or move it.</>
                : peakRatio < 0.67
                  ? <>Your peak sales is {Math.round(peakRatio * 100)}% of the Solidus epidemiology estimate. Conservative is fine, but the brief will say what the extra headroom is worth in the ask.</>
                  : <>Your peak sales sits within the Solidus range. The comparison page will focus on probability, timing and cost instead.</>}
            </Note>
          ) : null}
          <Field l="Notes on your model" hint="Source of the peak-sales view, pricing assumption, geography, anything a buyer will challenge."><textarea className={input} rows={2} value={d.modelNotes} onChange={e => set('modelNotes', e.target.value)} /></Field>
        </>) : null}

        {screen.key === 'runway' ? (<>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field l="Cash on hand, $M"><input className={input} inputMode="decimal" value={d.cash} onChange={e => set('cash', e.target.value)} autoFocus /></Field>
            <Field l="Runway, months"><input className={input} inputMode="numeric" value={d.runway} onChange={e => set('runway', e.target.value)} /></Field>
            <Field l="Next raise, $M"><input className={input} inputMode="decimal" value={d.raise} onChange={e => set('raise', e.target.value)} /></Field>
            <Field l="Expected close"><input className={input} value={d.raiseDate} onChange={e => set('raiseDate', e.target.value)} placeholder="2027-03" /></Field>
          </div>
          {runwayN != null && runwayN < 12 ? (
            <Note tone="amber">
              {readoutMonths != null && readoutMonths > runwayN
                ? <>{runwayN} months of runway against a readout {readoutMonths} months out. The brief will price the partner-now path honestly against a bridge; a buyer who knows the clock will use it, so the process design matters more than the ask.</>
                : <>Under twelve months of runway. The brief weighs the partner-now path against a bridge and sets the exclusivity window so the process closes before the cash does.</>}
            </Note>
          ) : runwayN != null && readoutMonths != null && readoutMonths <= runwayN ? (
            <Note>Runway covers the next readout. The fund-to-the-readout page will show what that data is worth in the ask, and whether waiting beats partnering now.</Note>
          ) : null}
        </>) : null}

        {screen.key === 'offers' ? (<>
          <Field l="Has anyone put a number on the table?"><Pills options={YES_NO} value={d.hasOffers} onChange={v => { set('hasOffers', v); if (v === 'yes' && d.offers.length === 0) set('offers', [emptyOffer()]); }} /></Field>
          {d.hasOffers === 'no' ? <Note>Fine. The brief prints the floor and the ask against a clean slate, and the buyer map is ranked on evidence rather than on who has already called.</Note> : null}
          {d.hasOffers === 'yes' ? (
            <FollowUp>
              <div className="space-y-4">
                {d.offers.map((o, k) => (
                  <div key={k} className="space-y-3 rounded-2xl border border-slate-800 p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className={input} placeholder="Counterparty" value={o.party} onChange={e => set('offers', d.offers.map((x, j) => j === k ? { ...x, party: e.target.value } : x))} autoFocus={k === 0} />
                      <input className={input} placeholder="When (YYYY-MM)" value={o.date} onChange={e => set('offers', d.offers.map((x, j) => j === k ? { ...x, date: e.target.value } : x))} />
                      <input className={input} placeholder="Upfront, $M" inputMode="decimal" value={o.upfrontM} onChange={e => set('offers', d.offers.map((x, j) => j === k ? { ...x, upfrontM: e.target.value } : x))} />
                      <input className={input} placeholder="Total, $M" inputMode="decimal" value={o.totalM} onChange={e => set('offers', d.offers.map((x, j) => j === k ? { ...x, totalM: e.target.value } : x))} />
                    </div>
                    <Pills options={PRIOR_OFFER_STATUSES} value={o.status} onChange={v => set('offers', d.offers.map((x, j) => j === k ? { ...x, status: v as PriorOffer['status'] } : x))} />
                    <input className={input} placeholder="Structure and what stalled" value={o.notes} onChange={e => set('offers', d.offers.map((x, j) => j === k ? { ...x, notes: e.target.value } : x))} />
                    <button type="button" className="text-xs text-slate-500 hover:text-rose-400" onClick={() => set('offers', d.offers.filter((_, j) => j !== k))}>Remove this offer</button>
                  </div>
                ))}
                <button type="button" className="rounded-full ring-1 ring-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:ring-slate-500" onClick={() => set('offers', [...d.offers, emptyOffer()])}>+ Add another offer</button>
              </div>
              <Field l="Term sheets received so far, in total"><input className={`${input} sm:max-w-[200px]`} inputMode="numeric" value={d.termSheets} onChange={e => set('termSheets', e.target.value)} placeholder="1" /></Field>
            </FollowUp>
          ) : null}
        </>) : null}

        {screen.key === 'buyers' ? (<>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field l="Buyers you want assessed" hint="Comma-separated."><input className={input} value={d.targetBuyers} onChange={e => set('targetBuyers', e.target.value)} autoFocus /></Field>
            <Field l="Buyers to exclude" hint={d.chinaLicensed === 'yes' && d.chinaPartner ? `${d.chinaPartner} holds Greater China; add anyone else who should not be approached.` : 'Comma-separated.'}><input className={input} value={d.excludedBuyers} onChange={e => set('excludedBuyers', e.target.value)} /></Field>
          </div>
          {ctx && ctx.topBuyers.length ? (
            <div>
              <p className="text-xs text-slate-500">Most active licensees at adjacent stages in {d.ta.toLowerCase()} since {new Date().getUTCFullYear() - 6}. Tap to add to the assessed list.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ctx.topBuyers.map(b => {
                  const on = list(d.targetBuyers).includes(b.name);
                  return <button type="button" key={b.name} onClick={() => (on ? set('targetBuyers', list(d.targetBuyers).filter(n => n !== b.name).join(', ')) : addBuyer(b.name))} className={pill(on)}>{b.name} <span className={on ? 'opacity-70' : 'text-slate-500'}>· {b.deals}</span></button>;
                })}
              </div>
            </div>
          ) : null}
          <Field l="Upstream licences or encumbrances" hint="Academic licence, royalty stack, platform rights, co-owned IP."><textarea className={input} rows={2} value={d.upstream} onChange={e => set('upstream', e.target.value)} /></Field>
          <Field l="IP notes" hint="Composition-of-matter expiry, key filings, FTO status."><textarea className={input} rows={2} value={d.ip} onChange={e => set('ip', e.target.value)} /></Field>
        </>) : null}

        {screen.key === 'package' ? (<>
          <div className="grid gap-3 sm:grid-cols-2">
            {pkgItems.map(item => {
              const on = d.pkg[item.key] === true;
              return (
                <button type="button" key={item.key} onClick={() => set('pkg', { ...d.pkg, [item.key]: !on })} className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition ${on ? 'bg-teal-500/10 ring-1 ring-teal-400/60' : 'ring-1 ring-slate-800 hover:ring-slate-600'}`}>
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] ${on ? 'bg-teal-500 text-slate-950' : 'ring-1 ring-slate-600'}`}>{on ? '✓' : ''}</span>
                  <span><span className="block text-sm font-medium text-slate-100">{item.label}</span><span className="block text-xs text-slate-500">{item.area}</span></span>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-slate-500">{pkgCount} of {pkgItems.length} items a buyer would ask for at {d.phase ? d.phase.toLowerCase() : 'this stage'} are in hand.{pkgCount < pkgItems.length ? ' Each open item lists on the diligence page with what closes it.' : ' The diligence page will read as ready.'}</p>
        </>) : null}

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
              ['The asset', `${d.assetName || 'Unnamed'} · ${d.indication || '—'} · ${d.phase || '—'} · ${MODALITIES.find(m => m[0] === d.modality)?.[1] ?? '—'} · ${d.dealType} · ${TERRITORIES.find(t => t[0] === d.territory)?.[1] ?? d.territory}${d.chinaLicensed === 'yes' ? ` · China licensed${d.chinaPartner ? ` to ${d.chinaPartner}` : ''}` : ''}`, 0, identityOk && stageOk],
              ['Your model', modelFilled ? `Peak $${d.peak || '—'}M${peakRatio != null ? ` (${peakRatio.toFixed(1)}× Solidus)` : ''} · PoS ${d.pos || '—'}% · launch ${d.launch || '—'} · cost $${d.devCost || '—'}M · expects $${d.expUp || '—'}M up / $${d.expTotal || '—'}M total` : 'Not supplied. The “your model vs Solidus” page prints an empty state.', 3, modelFilled],
              ['Runway', runwayFilled ? `Cash $${d.cash || '—'}M · ${d.runway || '—'} months · next raise $${d.raise || '—'}M ${d.raiseDate}` : 'Not supplied. The fund-or-partner page uses a benchmark raise.', 4, runwayFilled],
              ['Offers', d.hasOffers === 'no' ? 'None on the table.' : offersFilled ? `${d.offers.filter(o => o.party.trim()).length} offer(s)${d.termSheets ? ` · ${d.termSheets} term sheets` : ''}` : 'Not answered.', 5, d.hasOffers === 'no' || offersFilled],
              ['Counterparties', buyersFilled ? `Assess: ${d.targetBuyers || '—'} · exclude: ${d.excludedBuyers || '—'}` : 'No named buyers or encumbrances.', 6, buyersFilled],
              ['Data package', pkgCount ? `${pkgCount} of ${pkgItems.length} items in hand` : 'Nothing ticked; every diligence item lists as open.', 7, pkgCount > 0],
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
      {screen.key === 'review' ? <p className="mt-6 text-xs leading-relaxed text-slate-600">Everything you enter stays in your brief and your data room. Nothing is published in a way that identifies you or the asset. A draft starts building the moment you submit; nothing is sent until the Managing Partner has reviewed it.</p> : null}
    </div>
  );
}
