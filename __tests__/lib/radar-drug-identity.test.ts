/**
 * lib/radar/drug-identity.ts + lib/radar/ncit.ts — the drug identity gate (migration 173).
 * Cases are production shapes from the Oct 26 2026 QA run.
 */

import {
  assetAliasKeys,
  assetNameKeys,
  assetNameWordKeys,
  buildTrustedIndex,
  coWrittenKeys,
  addTrustedKey,
  isIdentityKey,
  isRegistrySource,
  judgeAssetLink,
  keyVariants,
  saltStrippedKey,
  uniqueDrugForKeys,
  type AliasIdentityRow,
  type DrugIdentityRow,
} from '@/lib/radar/drug-identity';
import { isSubstance, parseConcept, pickNcitConcept, usefulSynonyms } from '@/lib/radar/ncit';
import { hasDevelopmentCode, deriveOwnership } from '@/lib/radar/ownership';

const DOXO = 'd-doxorubicin';
const METHO = 'd-methotrexate';
const PEMBRO = 'd-pembrolizumab';
const PEMBRO_DUP = 'd-pembrolizumab-2';
const ACALA = 'd-acalabrutinib';
const INTERNAL_ABC = 'd-internal-abc123';
const NCIT_PLB = 'd-andamertinib';

const drugs: DrugIdentityRow[] = [
  { id: DOXO, preferred_name: 'doxorubicin', inn: 'doxorubicin', source: 'gsrs+chembl', is_combination: false },
  { id: METHO, preferred_name: 'methotrexate', inn: 'methotrexate', source: 'chembl', is_combination: false },
  { id: PEMBRO, preferred_name: 'pembrolizumab', inn: 'pembrolizumab', source: 'gsrs+chembl', is_combination: false },
  { id: PEMBRO_DUP, preferred_name: 'Pembrolizumab (genetical recombination)', inn: null, source: 'pubchem', is_combination: false },
  { id: ACALA, preferred_name: 'acalabrutinib', inn: 'acalabrutinib', source: 'chembl', is_combination: false },
  { id: INTERNAL_ABC, preferred_name: 'ABC-123', inn: null, source: 'internal', is_combination: false },
  { id: NCIT_PLB, preferred_name: 'andamertinib', inn: 'andamertinib', source: 'ncit', is_combination: false },
];

const aliasRows: AliasIdentityRow[] = [
  { drug_id: DOXO, alias: 'Adriamycin', source: 'chembl' },
  { drug_id: DOXO, alias: 'Doxorubicin Hydrochloride', source: 'gsrs' },
  // the snowball: clinicaltrials-sourced aliases are never trusted on their own
  { drug_id: DOXO, alias: 'Methotrexate', source: 'clinicaltrials' },
  { drug_id: DOXO, alias: 'Acalabrutinib', source: 'clinicaltrials' },
  { drug_id: DOXO, alias: 'Group A', source: 'clinicaltrials' },
  { drug_id: PEMBRO, alias: 'Keytruda', source: 'chembl' },
  { drug_id: PEMBRO_DUP, alias: 'pembrolizumab', source: 'pubchem' },
  { drug_id: NCIT_PLB, alias: 'PLB-1004', source: 'ncit' },
  // internal nodes trust their own name only
  { drug_id: INTERNAL_ABC, alias: 'cyclophosphamide', source: 'clinicaltrials' },
];

function makeIndex() {
  const byDrug = new Map<string, AliasIdentityRow[]>();
  for (const a of aliasRows) byDrug.set(a.drug_id, [...(byDrug.get(a.drug_id) ?? []), a]);
  return buildTrustedIndex(drugs, byDrug);
}
const isRegistry = (id: string) => isRegistrySource(drugs.find(d => d.id === id)?.source);

describe('keys', () => {
  it('ABC-123, ABC 123 and ABC123 are one key', () => {
    expect(keyVariants('ABC-123')).toEqual(keyVariants('ABC123'));
    expect(keyVariants('ABC 123')).toEqual(['abc123']);
  });

  it('salt and hydrate words are stripped, INN-changing words are not', () => {
    expect(saltStrippedKey('Imatinib Mesylate')).toBe('imatinib');
    expect(saltStrippedKey('doxorubicin hydrochloride')).toBe('doxorubicin');
    expect(saltStrippedKey('Sugammadex Sodium')).toBe('sugammadex');
    expect(saltStrippedKey('interferon beta')).toBeNull();
    expect(saltStrippedKey('epoetin alfa')).toBeNull();
    expect(keyVariants('Pembrolizumab')).toEqual(['pembrolizumab']);
  });

  it('generic and short keys never identify a drug', () => {
    expect(isIdentityKey('placebo')).toBe(false);
    expect(isIdentityKey('groupa')).toBe(false);
    expect(isIdentityKey('ifn')).toBe(false);
    expect(isIdentityKey('12345')).toBe(false);
    expect(isIdentityKey('mk3475')).toBe(true);
  });

  it('asset name keys cover display, parenthetical and code', () => {
    const k = assetNameKeys('MK-3475 (pembrolizumab) 200 mg IV');
    expect(k.kind).toBe('single');
    expect(k.units[0]).toEqual(expect.arrayContaining(['mk3475', 'pembrolizumab']));
  });

  it('combinations split into one key set per component', () => {
    const k = assetNameKeys('SRK-181 + pembrolizumab');
    expect(k.kind).toBe('combination');
    expect(k.units).toHaveLength(2);
  });

  it('alias keys skip combination aliases', () => {
    expect(assetAliasKeys(['MMF', 'carboplatin + paclitaxel'])).toHaveLength(0);
    expect(assetAliasKeys(['mycophenolate mofetil'])).toHaveLength(1);
  });

  it('word keys find an INN inside a longer name and skip common words', () => {
    expect(assetNameWordKeys('PEX010 Psilocybin Capsules')).toEqual(['psilocybin']);
  });

  it('registry sources: single and mixed, never internal or combination', () => {
    expect(isRegistrySource('gsrs+chembl')).toBe(true);
    expect(isRegistrySource('ncit')).toBe(true);
    expect(isRegistrySource('internal')).toBe(false);
    expect(isRegistrySource('combination')).toBe(false);
  });
});

describe('trusted index', () => {
  const index = makeIndex();

  it('trusts registry aliases, not clinicaltrials ones', () => {
    expect(index.byDrug.get(DOXO)?.has('adriamycin')).toBe(true);
    expect(index.byDrug.get(DOXO)?.has('methotrexate')).toBe(false);
    expect(index.byDrug.get(DOXO)?.has('acalabrutinib')).toBe(false);
    expect(index.byDrug.get(INTERNAL_ABC)?.has('cyclophosphamide')).toBe(false);
    expect(index.byDrug.get(INTERNAL_ABC)?.has('abc123')).toBe(true);
  });

  it('duplicate registry rows tie-break on the row whose own name is the key', () => {
    expect(uniqueDrugForKeys(['pembrolizumab'], index, isRegistry)?.drugId).toBe(PEMBRO);
  });

  it('co-written keys: a code beside a trusted INN becomes trusted for that drug only', () => {
    const idx = makeIndex();
    const adds = coWrittenKeys('MK-3475 (pembrolizumab)', idx, isRegistry);
    expect(adds).toEqual([{ drugId: PEMBRO, key: 'mk3475' }]);
    for (const a of adds) addTrustedKey(idx, a.drugId, a.key);
    expect(judgeAssetLink({ assetName: 'MK-3475', aliases: [], drugMasterId: PEMBRO }, idx, isRegistry).verdict).toBe('verified_name');
  });
});

describe('judgeAssetLink', () => {
  const index = makeIndex();

  it('AbbVie / Acalabrutinib linked to doxorubicin is relinked to acalabrutinib', () => {
    const r = judgeAssetLink({ assetName: 'Acalabrutinib', aliases: [], drugMasterId: DOXO }, index, isRegistry);
    expect(r.verdict).toBe('relink');
    expect(r.drugId).toBe(ACALA);
  });

  it('a name the node is not trusted to carry is unlinked, never kept', () => {
    const r = judgeAssetLink({ assetName: 'Rifampin', aliases: [], drugMasterId: DOXO }, index, isRegistry);
    expect(r.verdict).toBe('unlink');
    expect(r.drugId).toBeNull();
  });

  it('salt forms and brands the registry lists verify the link', () => {
    expect(judgeAssetLink({ assetName: 'Doxorubicin HCl 50 mg/m2', aliases: [], drugMasterId: DOXO }, index, isRegistry).verdict).toBe('verified_name');
    expect(judgeAssetLink({ assetName: 'Keytruda', aliases: [], drugMasterId: PEMBRO }, index, isRegistry).verdict).toBe('verified_name');
  });

  it('a polluted alias list cannot override what the name writes', () => {
    // "Tofacitinib" with aliases tacrolimus / thalidomide: the name decides; aliases are ignored
    const r = judgeAssetLink({ assetName: 'Acalabrutinib', aliases: ['methotrexate', 'doxorubicin'], drugMasterId: null }, index, isRegistry);
    expect(r.drugId).toBe(ACALA);
    expect(r.via).toBe('name');
  });

  it('aliases decide only when the name names nothing registered and they agree', () => {
    const one = judgeAssetLink({ assetName: 'MTX-X', aliases: ['methotrexate'], drugMasterId: null }, index, isRegistry);
    expect(one.verdict).toBe('new_link');
    expect(one.drugId).toBe(METHO);
    expect(one.via).toBe('alias');
    const two = judgeAssetLink({ assetName: 'Regimen Q', aliases: ['methotrexate', 'doxorubicin'], drugMasterId: null }, index, isRegistry);
    expect(two.verdict).toBe('none');
  });

  it('an internal node gives way to a registry node the name writes (NCIt code)', () => {
    const idx = makeIndex();
    addTrustedKey(idx, INTERNAL_ABC, 'plb1004');
    const r = judgeAssetLink({ assetName: 'PLB1004', aliases: [], drugMasterId: INTERNAL_ABC }, idx, isRegistry);
    expect(r.verdict).toBe('relink');
    expect(r.drugId).toBe(NCIT_PLB);
  });

  it('internal code nodes keep assets that write the code, hyphen or not', () => {
    expect(judgeAssetLink({ assetName: 'ABC123 tablets', aliases: [], drugMasterId: INTERNAL_ABC }, index, isRegistry).verdict).toBe('verified_name');
    expect(judgeAssetLink({ assetName: 'Cyclophosphamide', aliases: [], drugMasterId: INTERNAL_ABC }, index, isRegistry).verdict).toBe('unlink');
  });

  it('combinations: verified when every component is written, relinked when the parts are known', () => {
    const ok = judgeAssetLink({ assetName: 'Doxorubicin + Methotrexate', aliases: [], drugMasterId: 'combo', combinationComponents: [DOXO, METHO] }, index, isRegistry);
    expect(ok.verdict).toBe('verified_combination');
    const bad = judgeAssetLink({ assetName: 'Acalabrutinib + Methotrexate', aliases: [], drugMasterId: 'combo', combinationComponents: [DOXO, METHO] }, index, isRegistry);
    expect(bad.verdict).toBe('relink');
    expect(bad.componentIds).toEqual([ACALA, METHO].sort());
  });

  it('a word that is exactly a node name verifies the link', () => {
    const idx = makeIndex();
    addTrustedKey(idx, 'd-psilocybin', 'psilocybin', true);
    const r = judgeAssetLink({ assetName: 'PEX010 Psilocybin Capsules', aliases: [], drugMasterId: 'd-psilocybin' }, idx, () => true);
    expect(r.verdict).toBe('verified_name');
  });
});

describe('NCIt', () => {
  const plb = parseConcept({
    code: 'C209347', name: 'Andamertinib',
    synonyms: [{ name: 'PLB-1004' }, { name: 'PLB1004' }, { name: 'EGFR Mutant-selective Inhibitor PLB1004' }],
    properties: [{ type: 'Semantic_Type', value: 'Pharmacologic Substance' }],
  });
  const therapy = parseConcept({
    code: 'C157775', name: 'Botulinum Toxin Therapy', synonyms: [{ name: 'Botox' }],
    properties: [{ type: 'Semantic_Type', value: 'Therapeutic or Preventive Procedure' }],
  });
  const toxin = parseConcept({
    code: 'C82623', name: 'Botulinum Toxin Type A', synonyms: [{ name: 'Botox' }, { name: 'onabotulinumtoxinA' }],
    properties: [{ type: 'Semantic_Type', value: 'Pharmacologic Substance' }, { type: 'FDA_UNII_Code', value: 'E211KPY694' }],
  });

  it('accepts the single substance concept that writes the query exactly', () => {
    expect(pickNcitConcept('PLB 1004', [plb])?.code).toBe('C209347');
    expect(pickNcitConcept('PLB1005', [plb])).toBeNull();
  });

  it('procedures are not drugs', () => {
    expect(isSubstance(therapy)).toBe(false);
    expect(pickNcitConcept('Botox', [therapy, toxin])?.code).toBe('C82623');
    expect(toxin.unii).toBe('E211KPY694');
  });

  it('two substance concepts for one query is ambiguous', () => {
    const other = { ...toxin, code: 'C999', name: 'Other toxin' };
    expect(pickNcitConcept('Botox', [toxin, other])).toBeNull();
  });

  it('keeps short synonyms, drops systematic chemical names', () => {
    const c = parseConcept({ code: 'C1', name: 'Fosmanogepix', synonyms: [{ name: 'APX001' }, { name: '(12-Amino-6-oxa-1(3),7(2)-dipyridina)methyl hydrogen phosphate' }], properties: [] });
    expect(usefulSynonyms(c)).toEqual(['Fosmanogepix', 'APX001']);
  });
});

describe('ownership: marketed_shared (migration 173)', () => {
  it('detects a development code anywhere in the name', () => {
    expect(hasDevelopmentCode('CT-P13')).toBe(true);
    expect(hasDevelopmentCode('MK-3475 (pembrolizumab)')).toBe(true);
    expect(hasDevelopmentCode('Dexamethasone')).toBe(false);
  });

  const base = {
    companyId: 'c-abbvie', phase: 'phase_1', ownerRole: null, armRoles: ['experimental'] as const,
    drug: { id: 'd-dex', originatorCompanyId: null, confidence: 92, maxPhase: 'approved' },
  };

  it('AbbVie / Dexamethasone: an approved drug other companies hold too is not the sponsor program', () => {
    const r = deriveOwnership({ ...base, armRoles: [...base.armRoles], assetName: 'Dexamethasone', sharedWithOtherCompanies: true });
    expect(r.rule).toBe('marketed_shared');
    expect(r.status).toBe('marketed_other');
  });

  it('a biosimilar under its own code stays the sponsor program', () => {
    const r = deriveOwnership({ ...base, armRoles: [...base.armRoles], assetName: 'CT-P13', sharedWithOtherCompanies: true });
    expect(r.rule).toBe('sponsor_default');
    expect(r.status).toBe('originator');
  });

  it('the only industry holder of an approved drug keeps it', () => {
    const r = deriveOwnership({ ...base, armRoles: [...base.armRoles], assetName: 'Dexamethasone', sharedWithOtherCompanies: false });
    expect(r.status).toBe('originator');
  });
});

describe('drug-resolve local pass: own-name keys (migration 173)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { planLocalResolution, pickInternalPreferredName, groupUnitsByCandidateKeys } = require('@/lib/radar/drug-master');

  it('asset aliases are lookup candidates but not own keys', () => {
    const plan = planLocalResolution('ABC-123', ['methotrexate']);
    const u = plan.units[0];
    expect(u.candidateKeys).toEqual(expect.arrayContaining(['abc123', 'methotrexate']));
    expect(u.ownKeys).toEqual(['abc123']);
  });

  it('the internal node is named from the name, never from an alias', () => {
    const plan = planLocalResolution('ABC-123', ['methotrexate']);
    expect(pickInternalPreferredName(plan.units)).toBe('ABC-123');
  });

  it('grouping on own keys does not chain two sponsors through a shared alias', () => {
    const a = planLocalResolution('ABC-123', ['methotrexate']).units[0];
    const b = planLocalResolution('XYZ-987', ['methotrexate']).units[0];
    expect(groupUnitsByCandidateKeys([a, b].map(u => ({ candidateKeys: u.ownKeys })))).toHaveLength(2);
    expect(groupUnitsByCandidateKeys([a, b])).toHaveLength(1);
  });
});
