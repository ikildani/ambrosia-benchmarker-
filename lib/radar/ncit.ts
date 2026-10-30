/**
 * NCI Thesaurus (EVS REST API, free, no key) lookups for drug identity (migration 173).
 *
 * NCIt carries investigational agents with their sponsor codes as synonyms
 * ("PLB1004" → Andamertinib C209347, "ABSK021" → Pimicotinib), which GSRS and
 * ChEMBL often lack. A concept is accepted only when:
 *   - one of its synonyms (or its name) has exactly the queried key, and
 *   - it is a substance (Pharmacologic Substance, protein, chemical, ...), not a
 *     procedure, regimen or disease, and
 *   - it is the only such concept for the query.
 * The caller only queries names the company's own row writes, so a hit still
 * satisfies the "the company's own rows write it" rule.
 */

import { normalizeKey } from '@/lib/radar/drug-name';

export const NCIT_SEARCH_URL = 'https://api-evsrest.nci.nih.gov/api/v1/concept/ncit/search';

const SUBSTANCE_TYPES = new Set([
  'Pharmacologic Substance', 'Amino Acid, Peptide, or Protein', 'Organic Chemical', 'Immunologic Factor',
  'Biologically Active Substance', 'Antibiotic', 'Hormone', 'Enzyme', 'Nucleic Acid, Nucleoside, or Nucleotide',
  'Inorganic Chemical', 'Element, Ion, or Isotope', 'Vitamin', 'Receptor', 'Cell', 'Virus', 'Bacterium',
  'Clinical Drug', 'Gene or Genome', 'Biomedical or Dental Material', 'Indicator, Reagent, or Diagnostic Aid',
]);

export interface NcitConcept {
  code: string;
  name: string;
  unii: string | null;
  synonyms: string[];
  semanticTypes: string[];
}

interface RawConcept {
  code: string;
  name: string;
  synonyms?: Array<{ name: string }>;
  properties?: Array<{ type: string; value: string }>;
}

export function parseConcept(c: RawConcept): NcitConcept {
  const props = c.properties ?? [];
  return {
    code: c.code,
    name: c.name,
    unii: props.find(p => p.type === 'FDA_UNII_Code')?.value ?? null,
    synonyms: [...new Set((c.synonyms ?? []).map(s => s.name).filter(Boolean))],
    semanticTypes: props.filter(p => p.type === 'Semantic_Type').map(p => p.value),
  };
}

export function isSubstance(c: NcitConcept): boolean {
  return c.semanticTypes.some(t => SUBSTANCE_TYPES.has(t));
}

/** The single substance concept that writes the query key exactly, or null. */
export function pickNcitConcept(query: string, concepts: readonly NcitConcept[]): NcitConcept | null {
  const key = normalizeKey(query);
  if (!key) return null;
  const exact = concepts.filter(c => isSubstance(c) && [c.name, ...c.synonyms].some(s => normalizeKey(s) === key));
  return exact.length === 1 ? exact[0] : null;
}

/** Synonyms worth keeping as aliases: short, not a chemical systematic name. */
export function usefulSynonyms(c: NcitConcept, max = 40): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of [c.name, ...c.synonyms]) {
    const k = normalizeKey(s);
    if (!k || seen.has(k)) continue;
    if (s.length > 80) continue;
    if (/[\[\]{}]|\d+,\d+|\(\d|yl\)|-yl-/.test(s)) continue; // systematic chemical names
    seen.add(k);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export async function searchNcit(term: string, timeoutMs = 20_000): Promise<NcitConcept[] | 'error'> {
  const url = `${NCIT_SEARCH_URL}?term=${encodeURIComponent(term)}&type=match&include=synonyms,properties&pageSize=10`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } });
    if (!res.ok) return 'error';
    const body = (await res.json()) as { concepts?: RawConcept[] };
    return (body.concepts ?? []).map(parseConcept);
  } catch {
    return 'error';
  }
}
