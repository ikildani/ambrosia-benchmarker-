/**
 * Indication choices for the intake autocomplete: the engine's own registry
 * (the same keys the brief resolves to), with the therapeutic-area label the
 * form uses, so picking an indication also picks the area.
 */
import { INDICATION_REGISTRY } from '@/lib/benchmarkPagesIndication';

export const TA_LABELS: Record<string, string> = {
  oncology: 'Oncology', neurology: 'Neurology', immunology: 'Immunology', rareDisease: 'Rare Disease',
  cardiovascular: 'Cardiovascular', metabolic: 'Metabolic', hematology: 'Hematology', ophthalmology: 'Ophthalmology',
  dermatology: 'Dermatology', infectiousDisease: 'Infectious Disease', gastroenterology: 'Gastroenterology', womensHealth: "Women's Health",
};

export interface IndicationOption { value: string; label: string; ta: string }

export const INDICATION_OPTIONS: IndicationOption[] = INDICATION_REGISTRY.map(d => ({ value: d.value, label: d.label, ta: TA_LABELS[d.ta] ?? d.ta }));

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Up to `limit` matches for what the client typed; area matches first, then the rest. */
export function suggestIndications(text: string, taLabel: string | null, limit = 8): IndicationOption[] {
  const q = norm(text);
  if (q.length < 2) return [];
  const tokens = q.split(' ').filter(Boolean);
  const scored = INDICATION_OPTIONS.map(o => {
    const hay = norm(`${o.label} ${o.value}`);
    let score = 0;
    for (const t of tokens) if (hay.includes(t)) score += t.length;
    if (hay.startsWith(q)) score += 6;
    if (taLabel && o.ta === taLabel) score += 2;
    return { o, score };
  }).filter(x => x.score > 0);
  scored.sort((a, b) => b.score - a.score || a.o.label.localeCompare(b.o.label));
  return scored.slice(0, limit).map(x => x.o);
}
