'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { SectionCard, Skeleton, ErrorState, btnGhost, apiJson } from './ui';

interface Evidence { id: string; text: string; section: string; date: string | null; source: string | null }
interface NarrativeResponse { narrative: string; cached: boolean; model: string; generated_at: string; evidence: Evidence[] }

const CITATION_RE = /\[([A-Z]\d+(?:\s*[,;/]\s*[A-Z]\d+)*)\]/g;

/** Split narrative text into nodes, turning [S1, Q2] into superscript links to the evidence rows. */
function renderWithCitations(text: string, evidenceIds: Set<string>): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(CITATION_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const ids = m[1].split(/\s*[,;/]\s*/).map(s => s.trim()).filter(Boolean);
    out.push(
      <sup key={`c-${key++}`} className="ml-0.5 text-[10px] leading-none">
        {ids.map((id, i) => (
          <span key={id}>
            {i > 0 && ','}
            {evidenceIds.has(id)
              ? <a href={`#evidence-${id}`} className="text-amber-700 hover:underline dark:text-amber-400" aria-label={`Evidence ${id}`}>{id}</a>
              : <span className="text-neutral-400">{id}</span>}
          </span>
        ))}
      </sup>,
    );
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function AnalystBrief({ assetId }: { assetId: string }) {
  const [data, setData] = useState<NarrativeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setData(await apiJson<NarrativeResponse>(`/api/radar/narrative?asset_id=${assetId}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load brief');
    } finally { setLoading(false); }
  }, [assetId]);

  useEffect(() => { void load(); }, [load]);

  const evidenceIds = new Set((data?.evidence ?? []).map(e => e.id));

  return (
    <SectionCard id="brief" title="Analyst brief" meta={data ? <span>{data.model} · {data.cached ? 'cached' : 'generated now'} · every sentence cites an evidence row</span> : <span>Generated from the evidence on this page</span>}>
      {loading && <Skeleton lines={5} />}
      {error && <ErrorState message={error} onRetry={load} />}
      {data && !loading && (
        <>
          <p className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">{renderWithCitations(data.narrative, evidenceIds)}</p>
          <div className="mt-3">
            <button type="button" className={btnGhost} onClick={() => setShowEvidence(v => !v)} aria-expanded={showEvidence} aria-controls="brief-evidence">
              {showEvidence ? 'Hide' : 'Show'} evidence rows ({data.evidence.length})
            </button>
            <ol id="brief-evidence" hidden={!showEvidence} className="mt-2 space-y-1.5 text-xs">
              {data.evidence.map(e => (
                <li key={e.id} id={`evidence-${e.id}`} className="flex gap-2 scroll-mt-32 rounded-sm px-1 py-0.5 target:bg-amber-50 dark:target:bg-amber-900/20">
                  <span className="w-7 shrink-0 font-mono font-semibold text-neutral-600 dark:text-neutral-300">{e.id}</span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {e.text}
                    {(e.date || e.source) && <span className="ml-1 text-neutral-500 dark:text-neutral-400">({[e.date, e.source].filter(Boolean).join(' · ')})</span>}
                    {' '}<a href={`#${e.section}`} className="text-amber-700 hover:underline dark:text-amber-400">section</a>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </SectionCard>
  );
}
