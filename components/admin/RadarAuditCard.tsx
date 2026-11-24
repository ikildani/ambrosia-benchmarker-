'use client';

/**
 * One program of the /admin/radar-audit queue: evidence on the left, the three verdicts on the right.
 * Built for ~30 seconds a program: Y saves "all correct" and loads the next one; 1 / 2 / 3 flip owner,
 * availability and duplicate to "wrong" and open their correction; Enter saves; S skips.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AVAILABILITY_CORRECTIONS,
  OWNER_CORRECTIONS,
  availabilityClaim,
  type AuditEvidence,
  type AuditRelatedProgram,
  type AuditSubmission,
  type AvailabilityCorrection,
} from '@/lib/radar/qa/audit';
import type { OwnershipStatus } from '@/lib/radar/types';

interface Props {
  evidence: AuditEvidence;
  skip: string[];
}

type CompanyHit = { id: string; name: string; company_type: string | null; country: string | null };

function label(p: AuditRelatedProgram): string {
  const name = p.program_name && p.program_name !== p.asset_name ? `${p.program_name} (${p.asset_name})` : p.asset_name;
  return `${name} · ${p.company_name} · ${p.phase ?? '?'} · ${p.ownership_status ?? '?'}`;
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2 py-1 text-sm">
      <div className="text-slate-500">{k}</div>
      <div className="text-slate-900 break-words">{children}</div>
    </div>
  );
}

export function RadarAuditCard({ evidence, skip }: Props) {
  const router = useRouter();
  const { asset, company, drug } = evidence;
  const [ownerWrong, setOwnerWrong] = useState(false);
  const [availWrong, setAvailWrong] = useState(false);
  const [dupWrong, setDupWrong] = useState(false);
  const [ownerStatus, setOwnerStatus] = useState<OwnershipStatus | ''>('');
  const [relation, setRelation] = useState<'same_entity' | 'subsidiary' | ''>('');
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyHits, setCompanyHits] = useState<CompanyHit[]>([]);
  const [relationParent, setRelationParent] = useState<CompanyHit | null>(null);
  const [partnership, setPartnership] = useState<AvailabilityCorrection | ''>('');
  const [duplicateOf, setDuplicateOf] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(Date.now());

  const dupCandidates = useMemo(() => {
    const seen = new Set<string>();
    return [...evidence.sameDrugElsewhere, ...evidence.sameTargetInFamily].filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }, [evidence]);

  const next = useCallback((extraSkip?: string) => {
    const ids = extraSkip ? [...skip, extraSkip] : skip;
    const qs = ids.length ? `?skip=${ids.slice(-200).join(',')}` : '';
    router.push(`/admin/radar-audit${qs}`);
    router.refresh();
  }, [router, skip]);

  const submit = useCallback(async (allCorrect: boolean) => {
    if (busy) return;
    const body: AuditSubmission = {
      assetId: asset.id,
      owner: allCorrect || !ownerWrong ? { agrees: true } : {
        agrees: false,
        status: ownerStatus || null,
        relation: relation || null,
        relationParentId: relation ? relationParent?.id ?? null : null,
      },
      availability: allCorrect || !availWrong ? { agrees: true } : { agrees: false, partnership: partnership || null },
      duplicate: allCorrect || !dupWrong ? { agrees: true } : { agrees: false, duplicateOf: duplicateOf || null },
      comment: comment.trim() ? `${comment.trim()} [${Math.round((Date.now() - started.current) / 1000)}s]` : null,
    };
    if (!allCorrect && ownerWrong && relation && !relationParent) {
      setError('Pick the parent company for the relation, or clear the relation.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/radar-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }, [busy, asset.id, ownerWrong, ownerStatus, relation, relationParent, availWrong, partnership, dupWrong, duplicateOf, comment, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (e.key === 'Enter' && (!typing || e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(false); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'y') { e.preventDefault(); void submit(true); }
      else if (k === '1') { e.preventDefault(); setOwnerWrong(v => !v); }
      else if (k === '2') { e.preventDefault(); setAvailWrong(v => !v); }
      else if (k === '3') { e.preventDefault(); setDupWrong(v => !v); }
      else if (k === 's') { e.preventDefault(); next(asset.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit, next, asset.id]);

  useEffect(() => {
    if (!relation || companyQuery.trim().length < 2) { setCompanyHits([]); return; }
    const ctl = new AbortController();
    const h = setTimeout(() => {
      fetch(`/api/admin/radar-audit?q=${encodeURIComponent(companyQuery)}`, { signal: ctl.signal })
        .then(r => r.json())
        .then((j: { companies?: CompanyHit[] }) => setCompanyHits(j.companies ?? []))
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(h); ctl.abort(); };
  }, [companyQuery, relation]);

  const title = asset.program_name && asset.program_name !== asset.asset_name ? asset.program_name : asset.asset_name;
  const ev = asset.ownership_evidence ?? {};
  const arms = (ev as { arms?: { experimental?: number; comparator?: number; unknown?: number } }).arms;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
          <span className="text-xs rounded-full bg-slate-900 text-white px-2 py-0.5">#{evidence.rank ?? '–'}</span>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {title !== asset.asset_name && <span className="text-sm text-slate-500">{asset.asset_name}</span>}
        </div>

        <Row k="Company">
          <strong>{company.name}</strong>
          {company.company_type ? ` · ${company.company_type}` : ''}{company.country ? ` · ${company.country}` : ''}
          {company.family_root && <span className="text-slate-600"> · family of {company.family_root}</span>}
          {company.website_url && <> · <a className="text-blue-700 underline" href={company.website_url} target="_blank" rel="noreferrer">site</a></>}
        </Row>
        <Row k="Owner claim">
          {asset.ownership_status ?? 'unknown'} <span className="text-slate-500">(rule {asset.ownership_rule ?? '–'}
          {arms ? `; arms exp ${arms.experimental ?? 0} / comp ${arms.comparator ?? 0} / unknown ${arms.unknown ?? 0}` : ''})</span>
        </Row>
        <Row k="Availability claim">
          {availabilityClaim(asset.partnership_status, asset.availability_reasons)}
          <span className="text-slate-500"> (basis {asset.partnership_basis ?? '–'}{asset.partner_company_name ? `; partner ${asset.partner_company_name}` : ''})</span>
        </Row>
        <Row k="Program">
          {asset.phase ?? '?'} · {asset.therapeutic_area ?? 'no area'} · {asset.modality ?? '?'}{asset.target ? ` · ${asset.target}` : ''}
          {asset.indication_specific ? ` · ${asset.indication_specific}` : ''}
          {asset.moa_short && <div className="text-slate-600">{asset.moa_short}</div>}
        </Row>
        {asset.asset_aliases.length > 0 && <Row k="Aliases">{asset.asset_aliases.join(', ')}</Row>}
        <Row k="Drug record">
          {drug ? <>{drug.preferred_name ?? '–'} · originator {drug.originator ?? 'unknown'}{drug.originator_confidence != null ? ` (${drug.originator_confidence})` : ''}{drug.max_phase ? ` · max ${drug.max_phase}` : ''}</> : 'not resolved'}
        </Row>
        <Row k="Sources">
          <span className="text-slate-600">origin {asset.asset_origin ?? '–'} · first seen {asset.first_posted_date ?? '–'} · updated {asset.last_update_date ?? '–'}</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {asset.registry.map(r => (
              <a key={r.id} className="text-blue-700 underline" href={r.url} target="_blank" rel="noreferrer">{r.id}</a>
            ))}
            {asset.disclosure_url && <a className="text-blue-700 underline" href={asset.disclosure_url} target="_blank" rel="noreferrer">disclosure</a>}
            <a className="text-blue-700 underline" target="_blank" rel="noreferrer"
               href={`https://www.google.com/search?q=${encodeURIComponent(`"${asset.program_name ?? asset.asset_name}" ${company.name} license OR partnership OR acquired`)}`}>search</a>
          </div>
          {asset.disclosure_excerpt && <div className="mt-1 text-slate-600 italic">“{asset.disclosure_excerpt.slice(0, 300)}”</div>}
        </Row>
        {evidence.deals.length > 0 && (
          <Row k="Deals">
            <ul className="list-disc pl-4">
              {evidence.deals.map(d => (
                <li key={d.id}>
                  {d.announced_date ?? '?'} · {d.deal_type ?? '?'} · {d.licensor_name ?? '?'} → {d.licensee_name ?? '?'}
                  {d.asset_name ? ` · ${d.asset_name}` : ''}
                  {d.source_url && <> · <a className="text-blue-700 underline" href={d.source_url} target="_blank" rel="noreferrer">source</a></>}
                </li>
              ))}
            </ul>
          </Row>
        )}
        {asset.partnership_evidence != null && (
          <Row k="Partnership evidence">
            <pre className="text-xs whitespace-pre-wrap text-slate-700 max-h-40 overflow-auto">{JSON.stringify(asset.partnership_evidence, null, 1).slice(0, 1500)}</pre>
          </Row>
        )}
        {evidence.members.length > 0 && (
          <Row k={`Program rows (${asset.program_assets ?? evidence.members.length + 1})`}>
            <ul className="list-disc pl-4">{evidence.members.map(m => <li key={m.id}>{label(m)}</li>)}</ul>
          </Row>
        )}
        {evidence.sameDrugElsewhere.length > 0 && (
          <Row k="Same drug elsewhere">
            <ul className="list-disc pl-4">{evidence.sameDrugElsewhere.map(m => <li key={m.id}>{label(m)}</li>)}</ul>
          </Row>
        )}
        {evidence.sameTargetInFamily.length > 0 && (
          <Row k="Same target, same company">
            <ul className="list-disc pl-4">{evidence.sameTargetInFamily.map(m => <li key={m.id}>{label(m)}</li>)}</ul>
          </Row>
        )}
        {(evidence.override || evidence.previousReviews.length > 0) && (
          <Row k="History">
            {evidence.override && <div>override: {JSON.stringify(evidence.override)}</div>}
            {evidence.previousReviews.map((r, i) => (
              <div key={i} className="text-slate-600">{r.reviewed_at.slice(0, 10)} {r.reviewer}: {r.field} {r.agrees ? 'ok' : `wrong (${r.human_value ?? ''})`}</div>
            ))}
          </Row>
        )}
      </section>

      <aside className="rounded-xl border border-slate-200 bg-white p-5 h-fit lg:sticky lg:top-4 space-y-4">
        <button type="button" disabled={busy} onClick={() => void submit(true)}
          className="w-full rounded-full bg-emerald-600 text-white py-2 font-medium disabled:opacity-50">
          All correct, next <kbd className="ml-1 text-xs opacity-80">Y</kbd>
        </button>

        <fieldset className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={ownerWrong} onChange={e => setOwnerWrong(e.target.checked)} />
            Owner wrong <kbd className="text-xs text-slate-500">1</kbd>
          </label>
          {ownerWrong && (
            <div className="space-y-2 pl-6">
              <select className="w-full rounded border border-slate-300 p-1 text-sm" value={ownerStatus} onChange={e => setOwnerStatus(e.target.value as OwnershipStatus | '')}>
                <option value="">Correct status…</option>
                {OWNER_CORRECTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="w-full rounded border border-slate-300 p-1 text-sm" value={relation} onChange={e => { setRelation(e.target.value as typeof relation); setRelationParent(null); }}>
                <option value="">The company itself is…</option>
                <option value="same_entity">the same company as…</option>
                <option value="subsidiary">a subsidiary of…</option>
              </select>
              {relation && (
                <div>
                  <input className="w-full rounded border border-slate-300 p-1 text-sm" placeholder="Parent company name"
                    value={relationParent ? relationParent.name : companyQuery}
                    onChange={e => { setRelationParent(null); setCompanyQuery(e.target.value); }} />
                  {!relationParent && companyHits.length > 0 && (
                    <ul className="mt-1 max-h-40 overflow-auto rounded border border-slate-200 text-sm">
                      {companyHits.map(c => (
                        <li key={c.id}>
                          <button type="button" className="w-full text-left px-2 py-1 hover:bg-slate-100" onClick={() => setRelationParent(c)}>
                            {c.name}<span className="text-slate-500">{c.company_type ? ` · ${c.company_type}` : ''}{c.country ? ` · ${c.country}` : ''}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={availWrong} onChange={e => setAvailWrong(e.target.checked)} />
            Availability wrong <kbd className="text-xs text-slate-500">2</kbd>
          </label>
          {availWrong && (
            <select className="ml-6 w-[calc(100%-1.5rem)] rounded border border-slate-300 p-1 text-sm" value={partnership} onChange={e => setPartnership(e.target.value as AvailabilityCorrection | '')}>
              <option value="">Actual availability…</option>
              {AVAILABILITY_CORRECTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={dupWrong} onChange={e => setDupWrong(e.target.checked)} />
            Duplicate of another program <kbd className="text-xs text-slate-500">3</kbd>
          </label>
          {dupWrong && (
            <div className="pl-6 space-y-1 text-sm max-h-48 overflow-auto">
              {dupCandidates.length === 0 && <div className="text-slate-500">No candidates listed; describe it in the note.</div>}
              {dupCandidates.map(p => (
                <label key={p.id} className="flex items-start gap-2">
                  <input type="radio" name="dup" checked={duplicateOf === p.id} onChange={() => setDuplicateOf(p.id)} />
                  <span>{label(p)}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <textarea className="w-full rounded border border-slate-300 p-2 text-sm" rows={2} placeholder="Note (optional)"
          value={comment} onChange={e => setComment(e.target.value)} />

        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => void submit(false)}
            className="flex-1 rounded-full bg-slate-900 text-white py-2 text-sm font-medium disabled:opacity-50">
            Save, next <kbd className="ml-1 text-xs opacity-80">Enter</kbd>
          </button>
          <button type="button" disabled={busy} onClick={() => next(asset.id)}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm">
            Skip <kbd className="text-xs text-slate-500">S</kbd>
          </button>
        </div>
        {error && <div className="text-sm text-red-700">{error}</div>}
        <p className="text-xs text-slate-500">
          Owner = the company shown really owns the program (it originated it, or holds it outright).
          Availability = what the claim says about rights is right. Corrections apply on the next daily ownership and ranking refresh.
        </p>
      </aside>
    </div>
  );
}
