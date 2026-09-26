'use client';

/**
 * Deal Intelligence Brief intake: one asset, the client's own data, and the
 * billing details for the manual invoice. Used standalone on /intake (the page
 * linked from email) and embedded on /benchmark.
 *
 * Six short sections. Only the asset and contact sections are required; the
 * more of the rest the client fills, the more of the brief is built from their
 * data rather than public data, and the page tells them that plainly.
 */
import { useMemo, useState } from 'react';
import { BENCHMARK_PRICING } from '@/lib/config/constants';
import { DATA_PACKAGE_ITEMS, PRIOR_OFFER_STATUSES, type PriorOffer } from '@/lib/brief/client-intake';

const THERAPEUTIC_AREAS = ['Oncology', 'Neurology', 'Immunology', 'Rare Disease', 'Cardiovascular', 'Metabolic', 'Hematology', 'Ophthalmology', 'Dermatology', 'Infectious Disease', 'Gastroenterology', "Women's Health"] as const;
const PHASES = ['Preclinical', 'Phase 1', 'Phase 1/2', 'Phase 2', 'Phase 2/3', 'Phase 3'] as const;
const MODALITIES = [
  ['SM', 'Small molecule'], ['mAb', 'Monoclonal antibody'], ['ADC', 'Antibody-drug conjugate'], ['BSAB', 'Bispecific'], ['TSAB', 'Trispecific'],
  ['GT', 'Gene therapy'], ['CT', 'Cell therapy'], ['RNAi', 'siRNA'], ['ASO', 'Antisense'], ['mRNA', 'mRNA'], ['PEP', 'Peptide'], ['RP', 'Radiopharmaceutical'], ['VAX', 'Vaccine'], ['OTH', 'Other'],
] as const;
const DEAL_TYPES = ['Licensing', 'Option', 'Co-Development', 'M&A / Acquisition'] as const;
const TERRITORIES = [['global', 'Global'], ['us', 'US only'], ['ex_us', 'Ex-US'], ['ex_china', 'Ex-China'], ['japan', 'Japan'], ['china', 'China']] as const;
const DATA_PACKAGE_STAGES = ['Discovery / hit-to-lead', 'In vivo efficacy in hand', 'IND-enabling studies underway', 'IND-enabling complete / IND filed', 'Phase 1 data in hand', 'Phase 2 data in hand', 'Phase 3 data in hand'] as const;

export interface IntakePrefill {
  name?: string; email?: string; company?: string; title?: string; assetName?: string; indication?: string; ref?: string;
}

interface Props {
  prefill?: IntakePrefill;
  intakePath: '/intake' | '/benchmark';
}

type OfferDraft = { party: string; date: string; upfrontM: string; totalM: string; structure: string; status: PriorOffer['status']; notes: string };
const emptyOffer = (): OfferDraft => ({ party: '', date: '', upfrontM: '', totalM: '', structure: '', status: 'received', notes: '' });

const num = (v: string): number | null => {
  const t = v.replace(/[$,\s]/g, '');
  if (!t) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
};
const list = (v: string): string[] => v.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);

const field = 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500';
const label = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1';
const pill = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm transition ${on ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300' : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400'}`;

function Section({ n, title, why, children }: { n: number; title: string; why: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
      <div className="flex items-baseline gap-3">
        <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{String(n).padStart(2, '0')}</span>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{why}</p>
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

export function BriefIntakeForm({ prefill = {}, intakePath }: Props) {
  const [name, setName] = useState(prefill.name ?? '');
  const [email, setEmail] = useState(prefill.email ?? '');
  const [company, setCompany] = useState(prefill.company ?? '');
  const [title, setTitle] = useState(prefill.title ?? '');
  const [assetName, setAssetName] = useState(prefill.assetName ?? '');
  const [ta, setTa] = useState<string>('');
  const [indication, setIndication] = useState(prefill.indication ?? '');
  const [phase, setPhase] = useState<string>('');
  const [modality, setModality] = useState<string>('');
  const [mechanism, setMechanism] = useState('');
  const [target, setTarget] = useState('');
  const [dealType, setDealType] = useState<string>('Licensing');
  const [territory, setTerritory] = useState<string>('global');
  const [stage, setStage] = useState<string>('');
  const [differentiation, setDifferentiation] = useState('');
  const [peak, setPeak] = useState(''); const [pos, setPos] = useState(''); const [launch, setLaunch] = useState(''); const [devCost, setDevCost] = useState('');
  const [expUp, setExpUp] = useState(''); const [expTotal, setExpTotal] = useState(''); const [modelNotes, setModelNotes] = useState('');
  const [cash, setCash] = useState(''); const [runway, setRunway] = useState(''); const [raise, setRaise] = useState(''); const [raiseDate, setRaiseDate] = useState('');
  const [offers, setOffers] = useState<OfferDraft[]>([]);
  const [termSheets, setTermSheets] = useState('');
  const [targetBuyers, setTargetBuyers] = useState(''); const [excludedBuyers, setExcludedBuyers] = useState('');
  const [upstream, setUpstream] = useState(''); const [ip, setIp] = useState('');
  const [pkg, setPkg] = useState<Record<string, boolean>>({});
  const [billingEntity, setBillingEntity] = useState(''); const [billingAddress, setBillingAddress] = useState(''); const [billingEmail, setBillingEmail] = useState(''); const [po, setPo] = useState('');
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; msg?: string; requestId?: string }>({ kind: 'idle' });

  const ready = name.trim() && /\S+@\S+\.\S+/.test(email) && ta && indication.trim() && phase && modality;
  const modelFilled = useMemo(() => [peak, pos, launch, devCost, expUp, expTotal].some(v => v.trim()), [peak, pos, launch, devCost, expUp, expTotal]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || state.kind === 'busy') return;
    setState({ kind: 'busy' });
    const body = {
      name: name.trim(), email: email.trim(), company: company.trim() || null, title: title.trim() || null,
      therapeuticArea: ta, indication: indication.trim(), phase, modality,
      assetName: assetName.trim() || null, mechanism: mechanism.trim() || null, target: target.trim() || null,
      targetDealType: dealType, territory, dataPackageStage: stage || null, differentiationNotes: differentiation.trim() || null,
      client: {
        model: modelFilled ? { peakSalesM: num(peak), posToApprovalPct: num(pos), launchYear: num(launch), devCostToApprovalM: num(devCost), expectedUpfrontM: num(expUp), expectedTotalM: num(expTotal), notes: modelNotes.trim() || null } : null,
        financing: [cash, runway, raise, raiseDate].some(v => v.trim()) ? { cashOnHandM: num(cash), runwayMonths: num(runway), nextRaiseM: num(raise), nextRaiseDate: raiseDate.trim() || null } : null,
        priorOffers: offers.filter(o => o.party.trim()).map(o => ({ party: o.party.trim(), date: o.date.trim() || null, upfrontM: num(o.upfrontM), totalM: num(o.totalM), structure: o.structure.trim() || null, status: o.status, notes: o.notes.trim() || null })),
        termSheetsReceived: num(termSheets),
        targetBuyers: list(targetBuyers), excludedBuyers: list(excludedBuyers),
        upstreamLicenses: upstream.trim() || null, ipNotes: ip.trim() || null,
        dataPackage: pkg,
      },
      billingEntity: billingEntity.trim() || null, billingAddress: billingAddress.trim() || null, billingEmail: billingEmail.trim() || null, poNumber: po.trim() || null,
      intakePath, ref: prefill.ref ?? null,
    };
    try {
      const res = await fetch('/api/benchmark/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setState({ kind: 'error', msg: json.issues?.join('; ') || json.error || 'Something went wrong.' }); return; }
      setState({ kind: 'done', requestId: json.requestId });
    } catch {
      setState({ kind: 'error', msg: 'Network error. Please try again or reply to your email from us.' });
    }
  }

  if (state.kind === 'done') {
    return (
      <div className="rounded-2xl border border-teal-500/40 bg-teal-500/5 p-8 text-slate-800 dark:text-slate-100">
        <h3 className="text-xl font-semibold">Intake received.</h3>
        <ol className="mt-4 space-y-2 text-sm leading-relaxed list-decimal pl-5">
          <li>An invoice for {BENCHMARK_PRICING.PRICE} follows within one business day. It is credited in full against a subsequent advisory mandate.</li>
          <li>On receipt, a 15-minute call to confirm the asset and the counterparties you want in or out.</li>
          <li>The brief is built within 24 hours of the call and delivered to a private data room, with a 30-minute walkthrough arranged by reply.</li>
        </ol>
        <p className="mt-4 text-xs text-slate-500">Reference {state.requestId}. A confirmation is on its way to {email}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <Section n={1} title="The asset" why="One asset, one decision. Everything below is about this program.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={label}>Asset or program name</label><input className={field} value={assetName} onChange={e => setAssetName(e.target.value)} placeholder="e.g. AMB-201" /></div>
          <div><label className={label}>Indication *</label><input className={field} value={indication} onChange={e => setIndication(e.target.value)} placeholder="e.g. Alzheimer's disease" required /></div>
        </div>
        <div><label className={label}>Therapeutic area *</label><div className="flex flex-wrap gap-2">{THERAPEUTIC_AREAS.map(t => <button type="button" key={t} className={pill(ta === t)} onClick={() => setTa(t)}>{t}</button>)}</div></div>
        <div><label className={label}>Stage at signing *</label><div className="flex flex-wrap gap-2">{PHASES.map(p => <button type="button" key={p} className={pill(phase === p)} onClick={() => setPhase(p)}>{p}</button>)}</div></div>
        <div><label className={label}>Modality *</label><div className="flex flex-wrap gap-2">{MODALITIES.map(([k, l]) => <button type="button" key={k} className={pill(modality === k)} onClick={() => setModality(k)}>{l}</button>)}</div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={label}>Mechanism</label><input className={field} value={mechanism} onChange={e => setMechanism(e.target.value)} placeholder="e.g. anti-tau antibody" /></div>
          <div><label className={label}>Target</label><input className={field} value={target} onChange={e => setTarget(e.target.value)} placeholder="e.g. MAPT" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={label}>Structure you are preparing for</label><div className="flex flex-wrap gap-2">{DEAL_TYPES.map(d => <button type="button" key={d} className={pill(dealType === d)} onClick={() => setDealType(d)}>{d}</button>)}</div></div>
          <div><label className={label}>Territory on offer</label><div className="flex flex-wrap gap-2">{TERRITORIES.map(([k, l]) => <button type="button" key={k} className={pill(territory === k)} onClick={() => setTerritory(k)}>{l}</button>)}</div></div>
        </div>
        <div><label className={label}>Data package stage</label><select className={field} value={stage} onChange={e => setStage(e.target.value)}><option value="">Select…</option>{DATA_PACKAGE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label className={label}>What makes it different</label><textarea className={field} rows={3} value={differentiation} onChange={e => setDifferentiation(e.target.value)} placeholder="Selectivity, delivery, biomarker, competitive position, the claim you want a buyer to test" /></div>
      </Section>

      <Section n={2} title="Your model" why="Optional, and the most valuable section. The brief sets your numbers against ours line by line and says where the gap comes from.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className={label}>Peak sales ($M/yr)</label><input className={field} inputMode="decimal" value={peak} onChange={e => setPeak(e.target.value)} placeholder="e.g. 1200" /></div>
          <div><label className={label}>Probability to approval (%)</label><input className={field} inputMode="decimal" value={pos} onChange={e => setPos(e.target.value)} placeholder="e.g. 12" /></div>
          <div><label className={label}>Launch year</label><input className={field} inputMode="numeric" value={launch} onChange={e => setLaunch(e.target.value)} placeholder="e.g. 2033" /></div>
          <div><label className={label}>Cost to approval ($M)</label><input className={field} inputMode="decimal" value={devCost} onChange={e => setDevCost(e.target.value)} placeholder="e.g. 250" /></div>
          <div><label className={label}>Upfront you expect ($M)</label><input className={field} inputMode="decimal" value={expUp} onChange={e => setExpUp(e.target.value)} placeholder="e.g. 60" /></div>
          <div><label className={label}>Total value you expect ($M)</label><input className={field} inputMode="decimal" value={expTotal} onChange={e => setExpTotal(e.target.value)} placeholder="e.g. 800" /></div>
        </div>
        <div><label className={label}>Notes on your model</label><textarea className={field} rows={2} value={modelNotes} onChange={e => setModelNotes(e.target.value)} placeholder="Source of the peak-sales view, pricing assumption, geography, anything a buyer will challenge" /></div>
      </Section>

      <Section n={3} title="Runway and financing" why="The partner-now versus fund-to-the-next-readout page uses your real cash and raise, not an assumed one.">
        <div className="grid gap-4 sm:grid-cols-4">
          <div><label className={label}>Cash on hand ($M)</label><input className={field} inputMode="decimal" value={cash} onChange={e => setCash(e.target.value)} /></div>
          <div><label className={label}>Runway (months)</label><input className={field} inputMode="numeric" value={runway} onChange={e => setRunway(e.target.value)} /></div>
          <div><label className={label}>Next raise ($M)</label><input className={field} inputMode="decimal" value={raise} onChange={e => setRaise(e.target.value)} /></div>
          <div><label className={label}>Expected close (YYYY-MM)</label><input className={field} value={raiseDate} onChange={e => setRaiseDate(e.target.value)} placeholder="2027-03" /></div>
        </div>
      </Section>

      <Section n={4} title="Process to date" why="Offers already on the table are printed against the floor and the ask; buyers you name are assessed on the same terms as the ones we rank.">
        <div>
          <div className="flex items-center justify-between"><label className={label}>Offers or term sheets received</label><button type="button" className="text-xs font-semibold text-teal-600 dark:text-teal-400" onClick={() => setOffers(o => [...o, emptyOffer()])}>+ Add an offer</button></div>
          {offers.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : null}
          <div className="grid gap-3">
            {offers.map((o, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-6 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <input className={`${field} sm:col-span-2`} placeholder="Counterparty" value={o.party} onChange={e => setOffers(a => a.map((x, j) => j === i ? { ...x, party: e.target.value } : x))} />
                <input className={field} placeholder="Upfront $M" inputMode="decimal" value={o.upfrontM} onChange={e => setOffers(a => a.map((x, j) => j === i ? { ...x, upfrontM: e.target.value } : x))} />
                <input className={field} placeholder="Total $M" inputMode="decimal" value={o.totalM} onChange={e => setOffers(a => a.map((x, j) => j === i ? { ...x, totalM: e.target.value } : x))} />
                <input className={field} placeholder="YYYY-MM" value={o.date} onChange={e => setOffers(a => a.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                <select className={field} value={o.status} onChange={e => setOffers(a => a.map((x, j) => j === i ? { ...x, status: e.target.value as PriorOffer['status'] } : x))}>{PRIOR_OFFER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                <input className={`${field} sm:col-span-5`} placeholder="Structure and notes (licensing, option, exclusivity asked, what stalled)" value={o.notes} onChange={e => setOffers(a => a.map((x, j) => j === i ? { ...x, notes: e.target.value } : x))} />
                <button type="button" className="text-xs text-slate-500 hover:text-rose-500" onClick={() => setOffers(a => a.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className={label}>Term sheets received so far</label><input className={field} inputMode="numeric" value={termSheets} onChange={e => setTermSheets(e.target.value)} placeholder="0" /></div>
          <div><label className={label}>Buyers you want assessed</label><input className={field} value={targetBuyers} onChange={e => setTargetBuyers(e.target.value)} placeholder="Comma-separated" /></div>
          <div><label className={label}>Buyers to exclude</label><input className={field} value={excludedBuyers} onChange={e => setExcludedBuyers(e.target.value)} placeholder="Comma-separated" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={label}>Upstream licences or encumbrances</label><textarea className={field} rows={2} value={upstream} onChange={e => setUpstream(e.target.value)} placeholder="Academic licence, royalty stack, platform rights, co-owned IP" /></div>
          <div><label className={label}>IP notes</label><textarea className={field} rows={2} value={ip} onChange={e => setIp(e.target.value)} placeholder="Composition-of-matter expiry, key filings, FTO status" /></div>
        </div>
      </Section>

      <Section n={5} title="Data package" why="Tick what is in hand. The diligence-readiness page lists what a buyer will ask for and marks each item ready or open.">
        <div className="grid gap-2 sm:grid-cols-2">
          {DATA_PACKAGE_ITEMS.map(item => (
            <label key={item.key} className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-teal-600" checked={pkg[item.key] === true} onChange={e => setPkg(p => ({ ...p, [item.key]: e.target.checked }))} />
              <span><span className="font-medium">{item.label}</span><span className="block text-xs text-slate-500">{item.area}</span></span>
            </label>
          ))}
        </div>
      </Section>

      <Section n={6} title="Contact and invoice" why={`The brief is ${BENCHMARK_PRICING.PRICE}, invoiced within one business day of this form. No card, no checkout; the fee is credited in full against a subsequent advisory mandate.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={label}>Your name *</label><input className={field} value={name} onChange={e => setName(e.target.value)} required /></div>
          <div><label className={label}>Email *</label><input className={field} type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div><label className={label}>Company</label><input className={field} value={company} onChange={e => setCompany(e.target.value)} /></div>
          <div><label className={label}>Title</label><input className={field} value={title} onChange={e => setTitle(e.target.value)} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={label}>Invoice to (legal entity)</label><input className={field} value={billingEntity} onChange={e => setBillingEntity(e.target.value)} placeholder="Defaults to your company" /></div>
          <div><label className={label}>Billing email</label><input className={field} type="email" value={billingEmail} onChange={e => setBillingEmail(e.target.value)} placeholder="Defaults to your email" /></div>
          <div><label className={label}>Billing address</label><textarea className={field} rows={2} value={billingAddress} onChange={e => setBillingAddress(e.target.value)} /></div>
          <div><label className={label}>PO number (if required)</label><input className={field} value={po} onChange={e => setPo(e.target.value)} /></div>
        </div>
      </Section>

      {state.kind === 'error' ? <p className="text-sm text-rose-600 dark:text-rose-400">{state.msg}</p> : null}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={!ready || state.kind === 'busy'} className="rounded-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-6 py-3 text-sm font-semibold text-white transition">
          {state.kind === 'busy' ? 'Sending…' : `Submit intake · invoice ${BENCHMARK_PRICING.PRICE}`}
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">Everything you enter stays in your brief and your data room. Nothing is published in a way that identifies you or the asset.</p>
      </div>
    </form>
  );
}
