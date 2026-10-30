/**
 * Does the name SEC reports for a CIK (XBRL `entityName`, submissions `name`) belong to this company?
 *
 * Oct 30 2026: PHARMA_CIKS carried 88 CIKs that belong to other filers (BMS → Bank of America,
 * J&J → Coca-Cola, Gilead → Autodesk). Revenue and cash were written from those filers and the
 * CIKs were copied onto company rows. Every write keyed on a CIK checks the filer name first.
 */

const LEGAL_SUFFIX = /\b(inc|incorporated|corp|corporation|co|ltd|limited|plc|ag|sa|nv|llc|lp|the|se|de|kk|gmbh|asa|ab|spa)\b/g;
// Words that make a different company of the same root name (Merck KGaA is not Merck & Co.).
const DISTINCT_ENTITY = /\bkgaa\b/;

const SECTOR_WORDS = /\b(holdings?|group|company|pharmaceuticals?|pharma|therapeutics|biosciences?|biotherapeutics|biotech|biopharma|biopharmaceuticals?|medicines|international|laboratories|labs)\b/g;

/** Lowercase, drop punctuation, SEC's state suffix ("/ MA", "/DE/") and legal-form words. */
export function normalizeFilerName(name: string, dropSectorWords = false): string {
  let s = (name ?? '').replace(/\s*\/\s*[A-Za-z]{2,3}\s*\/?\s*$/, '').toLowerCase();
  s = s.replace(/[^a-z0-9 ]/g, ' ').replace(LEGAL_SUFFIX, ' ');
  if (dropSectorWords) s = s.replace(SECTOR_WORDS, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * True when one of the company's names and the SEC filer name are the same company name:
 * equal after normalization, or one contains the other as whole words (at least 4 characters,
 * so "Roche" never matches "Petrochemical" and "PTC" never matches "PepTcell").
 */
export function secNameMatches(filerName: string | null | undefined, companyNames: Array<string | null | undefined>): boolean {
  if (!filerName) return false;
  const filer = normalizeFilerName(filerName, true);
  if (!filer) return false;
  for (const raw of companyNames) {
    if (!raw) continue;
    const name = normalizeFilerName(raw, true);
    if (!name) continue;
    if (name === filer) return true;
    if (DISTINCT_ENTITY.test(name) !== DISTINCT_ENTITY.test(filer)) continue;
    const [short, long] = name.length <= filer.length ? [name, filer] : [filer, name];
    if (short.length >= 4 && ` ${long} `.includes(` ${short} `)) return true;
  }
  return false;
}
