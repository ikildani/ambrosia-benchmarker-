/**
 * Registry key → epidemiology table key.
 *
 * The indication registry (lib/benchmarkPagesIndication.ts) and the
 * epidemiology table (data/epidemiology.json) grew separately, so twenty
 * indications the registry spells one way ("fabryDisease") the table spells
 * another ("fabry"). Without this map the market estimator fell back to the
 * generic rare-disease profile ($100K, 50 per million) for all of them
 * (found Sep 27 2026 by reconciling every registry indication).
 *
 * Resolution order in resolveEpidemiologyKey: exact key, alias, then a
 * case-and-punctuation-insensitive match on the table's keys.
 */

export const EPIDEMIOLOGY_ALIASES: Record<string, string> = {
  spinalMuscularAtrophy: 'sma',
  duchenneMD: 'dmd',
  pompeDisease: 'pompe',
  mucopolysaccharidosis: 'mpsDisorders',
  primaryBiliaryCholangitis: 'pbc',
  heartFailureHfpef: 'hfpef',
  fabryDisease: 'fabry',
  celiacDisease: 'celiac',
  hypertrophicCardiomyopathy: 'cardiomyopathy',
  hodgkinLymphoma: 'hodgkins',
  waldenstroms: 'waldenstrom',
  mantleCellLymphoma: 'mantleCell',
  follicularLymphoma: 'follicular',
  crohnsDisease: 'crohns',
  nonAlcoholicSteatohepatitis: 'nashMash',
  alopeciaAreata: 'alopecia',
  hidradenitisSuppurativa: 'hidradenitis',
  atopicDermatitis: 'atopicderm',
  huntingtonDisease: 'huntingtons',
  gaucherDisease: 'gaucher',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The table key for a registry key, or null when the table has no entry for it. */
export function resolveEpidemiologyKey(key: string, dataset: Record<string, unknown>): string | null {
  if (!key) return null;
  if (dataset[key]) return key;
  const alias = EPIDEMIOLOGY_ALIASES[key];
  if (alias && dataset[alias]) return alias;
  const n = norm(key);
  for (const k of Object.keys(dataset)) if (norm(k) === n) return k;
  return null;
}
