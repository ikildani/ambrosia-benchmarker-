/**
 * Tests for lib/radar/drug-name.ts — pure drug-name normalization for the
 * Asset Radar drug master (migration 107).
 */
import {
  classifyAlias,
  containsCJK,
  extractCodeNames,
  inferModalityFromName,
  innFuzzyEqual,
  isCodeName,
  isNonDrugIntervention,
  isPlaceboOrGeneric,
  looksLikeInn,
  modalityFromChemblType,
  normalizeDrugName,
  normalizeKey,
  splitCombination,
} from '@/lib/radar/drug-name';
import { RADAR_MODALITY_OPTIONS } from '@/lib/radar/vocab';

describe('normalizeKey', () => {
  it('collapses hyphens, spaces and case so MK-3475 == MK3475 == mk 3475', () => {
    expect(normalizeKey('MK-3475')).toBe('mk3475');
    expect(normalizeKey('MK3475')).toBe('mk3475');
    expect(normalizeKey('mk 3475')).toBe('mk3475');
  });

  it('folds full-width punctuation and drops trademark marks', () => {
    expect(normalizeKey('KEYTRUDA®')).toBe('keytruda');
    expect(normalizeKey('ＭＫ－３４７５')).toBe('mk3475');
  });
});

describe('normalizeDrugName', () => {
  it('lifts the parenthetical INN out of "MK-3475 (pembrolizumab)"', () => {
    const n = normalizeDrugName('MK-3475 (pembrolizumab)');
    expect(n.reason).toBeNull();
    expect(n.display).toBe('MK-3475');
    expect(n.parentheticals).toEqual(['pembrolizumab']);
    expect(n.codeNames).toEqual(['MK-3475']);
    expect(n.candidates.map(normalizeKey)).toEqual(['mk3475', 'pembrolizumab']);
  });

  it('lifts the parenthetical code out of "Pembrolizumab (MK-3475)" with the same candidate set', () => {
    const n = normalizeDrugName('Pembrolizumab (MK-3475)');
    expect(n.display).toBe('Pembrolizumab');
    expect(n.parentheticals).toEqual(['MK-3475']);
    expect(new Set(n.candidates.map(normalizeKey))).toEqual(new Set(['pembrolizumab', 'mk3475']));
  });

  it('strips dose suffixes: "pembrolizumab 200 mg"', () => {
    expect(normalizeDrugName('pembrolizumab 200 mg').display).toBe('pembrolizumab');
    expect(normalizeDrugName('Oral semaglutide 14 mg once daily').display).toBe('semaglutide');
    expect(normalizeDrugName('Enerzair 150/50/80 μg').display).toBe('Enerzair');
  });

  it('strips route and formulation words', () => {
    expect(normalizeDrugName('Rezvilutamide Tablets').display).toBe('Rezvilutamide');
    expect(normalizeDrugName('RC198 Injection').display).toBe('RC198');
    expect(normalizeDrugName('Intratumoral Ipilimumab').display).toBe('Ipilimumab');
    expect(normalizeDrugName('Single agent zimberelimab').display).toBe('zimberelimab');
    expect(normalizeDrugName('Biological NTLA-2002').display).toBe('NTLA-2002');
  });

  it('does not strip route abbreviations that are part of a hyphenated name', () => {
    expect(normalizeDrugName('SC-PEG').display).toBe('SC-PEG');
  });

  it('strips "at a dose", "Dose Regimen A" and trailing arm letters after a code', () => {
    expect(normalizeDrugName('SHR-1316 at a dose').display).toBe('SHR-1316');
    expect(normalizeDrugName('TEV-48574 Dose Regimen A').display).toBe('TEV-48574');
    expect(normalizeDrugName('NNC0471-0119 H').display).toBe('NNC0471-0119');
  });

  it('keeps "Group B" when no code anchors the string', () => {
    expect(normalizeDrugName('Multivalent Group B streptococcus vaccine').display).toBe('Multivalent Group B streptococcus vaccine');
  });

  it('handles a truncated parenthetical: "DWZ2501 (Olaparib"', () => {
    const n = normalizeDrugName('DWZ2501 (Olaparib');
    expect(n.display).toBe('DWZ2501');
    expect(n.parentheticals).toEqual(['Olaparib']);
  });

  it('keeps an all-caps brand as its own candidate', () => {
    const n = normalizeDrugName('KEYTRUDA');
    expect(n.display).toBe('KEYTRUDA');
    expect(n.reason).toBeNull();
  });

  it('marks CJK names unresolvable with reason cjk and never cleans them', () => {
    const n = normalizeDrugName('阿司匹林');
    expect(n.reason).toBe('cjk');
    expect(n.display).toBe('阿司匹林');
    expect(containsCJK('阿司匹林')).toBe(true);
    expect(containsCJK('SHR-9839 ；SHR-A2009')).toBe(false);
  });

  it('flags placebo, comparators and generic classes', () => {
    expect(normalizeDrugName('Placebo').reason).toBe('placebo');
    expect(normalizeDrugName('Matching placebo tablets').reason).toBe('placebo');
    expect(normalizeDrugName('Chemotherapy').reason).toBe('placebo');
    expect(normalizeDrugName("Investigator's choice chemotherapy").reason).toBe('placebo');
    expect(normalizeDrugName('Cancer treatment with tyrosine kinase inhibitors (TKIs) or other molecularly targeted therapeutic agents.').reason).toBe('placebo');
  });

  it('flags procedures, devices and behavioural interventions as non_drug', () => {
    expect(normalizeDrugName('Screener').reason).toBe('non_drug');
    expect(normalizeDrugName('Educational Intervention').reason).toBe('non_drug');
    expect(normalizeDrugName('Stereotactic body radiotherapy').reason).toBe('non_drug');
    expect(normalizeDrugName('AS Domelock System').reason).toBe('non_drug');
    expect(normalizeDrugName('The RibFix Titan™ device should be used within this arm of the study.').reason).toBe('non_drug');
    expect(normalizeDrugName('Ureteroscopy').reason).toBe('non_drug');
  });

  it('returns empty for a string that is only route/dose noise', () => {
    expect(normalizeDrugName('Intravenous (IV) single dose').reason).toBe('empty');
    expect(normalizeDrugName('').reason).toBe('empty');
  });
});

describe('extractCodeNames', () => {
  it('recognises the common sponsor code families', () => {
    expect(extractCodeNames('ABBV-400')).toEqual(['ABBV-400']);
    expect(extractCodeNames('JNJ-2113')).toEqual(['JNJ-2113']);
    expect(extractCodeNames('RO7247669')).toEqual(['RO7247669']);
    expect(extractCodeNames('BMS-986012')).toEqual(['BMS-986012']);
    expect(extractCodeNames('DS-8201a')).toEqual(['DS-8201a']);
    expect(extractCodeNames('BNT162b2')).toEqual(['BNT162b2']);
    expect(extractCodeNames('PF-06882961')).toEqual(['PF-06882961']);
    expect(extractCodeNames('INCMGA00012')).toEqual(['INCMGA00012']);
    expect(extractCodeNames('NNC0471-0119')).toEqual(['NNC0471-0119']);
    expect(extractCodeNames('SHR-A2009')).toEqual(['SHR-A2009']);
    expect(extractCodeNames('E7080')).toEqual(['E7080']);
  });

  it('canonicalises spacing and case: "mk 3475" and "MK 3475" become MK-3475', () => {
    expect(extractCodeNames('MK 3475')).toEqual(['MK-3475']);
    expect(extractCodeNames('mk 3475')).toEqual(['MK-3475']);
    expect(extractCodeNames('mRNA-1273')).toEqual(['mRNA-1273']);
  });

  it('blacklists registry ids', () => {
    expect(extractCodeNames('NCT04567890')).toEqual([]);
    expect(extractCodeNames('EUCT 2024-123456-12-00')).toEqual([]);
    expect(extractCodeNames('ISRCTN12345678')).toEqual([]);
  });

  it('blacklists gene symbols with digits unless hyphenated to a 3+ digit number', () => {
    expect(extractCodeNames('CD20')).toEqual([]);
    expect(extractCodeNames('IL17')).toEqual([]);
    expect(extractCodeNames('IL-17')).toEqual([]);
    expect(extractCodeNames('anti-CD19 antibody')).toEqual([]);
    expect(extractCodeNames('CD-388')).toEqual(['CD-388']);
    expect(extractCodeNames('PSMA-617')).toEqual(['PSMA-617']);
  });

  it('ignores doses, cycle markers, isotopes and disease names', () => {
    expect(extractCodeNames('200 mg')).toEqual([]);
    expect(extractCodeNames('Q3W D28 C1D1')).toEqual([]);
    expect(extractCodeNames('Lu-177')).toEqual([]);
    expect(extractCodeNames('COVID-19')).toEqual([]);
  });

  it('extracts every code from a combination string', () => {
    expect(extractCodeNames('AK127 Q3W IV infusion ,AK104')).toEqual(['AK127', 'AK104']);
  });

  it('isCodeName is true only when the whole string is one code', () => {
    expect(isCodeName('MK-3475')).toBe(true);
    expect(isCodeName('MK-3475 (pembrolizumab)')).toBe(false);
    expect(isCodeName('pembrolizumab')).toBe(false);
  });
});

describe('splitCombination', () => {
  it('splits "A + B", "A plus B", "A in combination with B"', () => {
    expect(splitCombination('Pembrolizumab + Lenvatinib').components).toEqual(['Pembrolizumab', 'Lenvatinib']);
    expect(splitCombination('nivolumab plus ipilimumab').components).toEqual(['nivolumab', 'ipilimumab']);
    expect(splitCombination('Olaparib in combination with bevacizumab').components).toEqual(['Olaparib', 'bevacizumab']);
  });

  it('splits "A/B" only when both sides look like drugs', () => {
    expect(splitCombination('Xanomeline/trospium chloride')).toEqual({ components: ['Xanomeline', 'trospium chloride'], isCombination: true });
    expect(splitCombination('ELX/TEZ/IVA').components).toEqual(['ELX', 'TEZ', 'IVA']);
    expect(splitCombination('Enerzair 150/50/80 μg').isCombination).toBe(false);
  });

  it('splits "A and B" and comma-separated codes', () => {
    expect(splitCombination('Trifluridine and Tipiracil Hydrochloride').components).toEqual(['Trifluridine', 'Tipiracil Hydrochloride']);
    expect(splitCombination('AK127 Q3W IV infusion ,AK104').components).toEqual(['AK127 Q3W IV infusion', 'AK104']);
    expect(splitCombination('SHR-9839 ；SHR-A2009').components).toEqual(['SHR-9839', 'SHR-A2009']);
  });

  it('drops placebo, backbone regimens and non-drug parts so the rest is a single drug', () => {
    expect(splitCombination('SBRT + MEDI5752')).toEqual({ components: ['MEDI5752'], isCombination: false });
    expect(splitCombination('R-miniCHOP + Acalabrutinib')).toEqual({ components: ['Acalabrutinib'], isCombination: false });
    expect(splitCombination('Acalabrutinib in combination with BR')).toEqual({ components: ['Acalabrutinib'], isCombination: false });
    expect(splitCombination('Pembrolizumab with chemotherapy')).toEqual({ components: ['Pembrolizumab'], isCombination: false });
    expect(splitCombination('Pembrolizumab + Placebo')).toEqual({ components: ['Pembrolizumab'], isCombination: false });
  });

  it('recovers the named agent from a regimen sentence', () => {
    const s = splitCombination('Chemotherapy followed by endocrine therapy and ribociclib treatment');
    expect(s.isCombination).toBe(false);
    expect(normalizeDrugName(s.components[0]).display).toBe('ribociclib');
  });

  it('returns no components when nothing is a drug', () => {
    expect(splitCombination('Placebo + standard of care').components).toEqual([]);
    expect(splitCombination('').components).toEqual([]);
  });

  it('does not split a CJK name', () => {
    expect(splitCombination('阿司匹林 + 氯吡格雷').isCombination).toBe(false);
  });
});

describe('isPlaceboOrGeneric', () => {
  it.each([
    'placebo', 'Placebo', 'standard of care', 'best supportive care', 'vehicle', 'saline', 'normal saline',
    'sham', 'usual care', 'chemotherapy', "investigator's choice", 'Physician\'s choice chemotherapy',
    'treatment as usual', 'FOLFOX', 'R-CHOP',
  ])('flags %s', (name) => {
    expect(isPlaceboOrGeneric(name)).toBe(true);
  });

  it.each(['pembrolizumab', 'MK-3475', 'KEYTRUDA', 'Platelet Rich Plasma', 'Xanomeline'])('does not flag %s', (name) => {
    expect(isPlaceboOrGeneric(name)).toBe(false);
  });
});

describe('isNonDrugIntervention', () => {
  it('never flags a string carrying a code or INN', () => {
    expect(isNonDrugIntervention('Study drug ABBV-400')).toBe(false);
    expect(isNonDrugIntervention('Topical application of imiquimod cream')).toBe(false);
    expect(isNonDrugIntervention('POC PCR-test device')).toBe(true);
    expect(isNonDrugIntervention('icompanion app')).toBe(true);
  });
});

describe('classifyAlias', () => {
  it('classifies INNs by stem', () => {
    expect(classifyAlias('pembrolizumab')).toBe('inn');
    expect(classifyAlias('olaparib')).toBe('inn');
    expect(classifyAlias('Sonrotoclax')).toBe('inn');
    expect(classifyAlias('semaglutide')).toBe('inn');
    expect(classifyAlias('Sipuleucel-T')).toBe('inn');
    expect(classifyAlias('trastuzumab deruxtecan')).toBe('inn');
    expect(classifyAlias('Follitropin alfa')).toBe('inn');
    expect(looksLikeInn('ide-cel')).toBe(true);
  });

  it('does not classify ordinary words ending in a stem as INN', () => {
    expect(classifyAlias('peptide')).toBe('synonym');
    expect(classifyAlias('release')).toBe('synonym');
    expect(classifyAlias('kinase')).toBe('synonym');
    expect(classifyAlias('cholesterol')).toBe('synonym');
  });

  it('classifies codes, brands, external ids and synonyms', () => {
    expect(classifyAlias('MK-3475')).toBe('code');
    expect(classifyAlias('ABC-123')).toBe('code');
    expect(classifyAlias('KEYTRUDA')).toBe('brand');
    expect(classifyAlias('Keytruda®')).toBe('brand');
    expect(classifyAlias('Keytruda')).toBe('synonym');
    expect(classifyAlias('CHEMBL3137343')).toBe('chembl');
    expect(classifyAlias('DPT0O3T46P')).toBe('unii');
    expect(classifyAlias('1374853-91-4')).toBe('cas');
    expect(classifyAlias('trospium chloride')).toBe('synonym');
  });
});

describe('innFuzzyEqual', () => {
  it('allows one edit on INNs of 8+ characters', () => {
    expect(innFuzzyEqual('pembrolizumab', 'pembrolizumap')).toBe(true);
    expect(innFuzzyEqual('pembrolizumab', 'pembrolizuma')).toBe(true);
    expect(innFuzzyEqual('pembrolizumab', 'nivolumab')).toBe(false);
  });

  it('never fuzzy-matches code names or short names', () => {
    expect(innFuzzyEqual('ABC-123', 'ABC-124')).toBe(false);
    expect(innFuzzyEqual('MK-3475', 'MK-3476')).toBe(false);
    expect(innFuzzyEqual('olaparib', 'olaparip')).toBe(true);
    expect(innFuzzyEqual('abcdefg', 'abcdefh')).toBe(false);
  });

  it('never fuzzy-matches CJK', () => {
    expect(innFuzzyEqual('阿司匹林', '阿司匹林片')).toBe(false);
  });
});

describe('inferModalityFromName', () => {
  it('maps INN stems and platform words to radar modality values', () => {
    expect(inferModalityFromName('pembrolizumab')).toBe('antibody');
    expect(inferModalityFromName('olaparib')).toBe('small_molecule');
    expect(inferModalityFromName('Nusinersen')).toBe('oligonucleotide');
    expect(inferModalityFromName('semaglutide')).toBe('peptide');
    expect(inferModalityFromName('Talimogene Laherparepvec')).toBe('gene_therapy');
    expect(inferModalityFromName('ide-cel')).toBe('cell_therapy');
    expect(inferModalityFromName('axicabtagene ciloleucel')).toBe('car_t');
    expect(inferModalityFromName('trastuzumab deruxtecan')).toBe('adc');
    expect(inferModalityFromName('177Lu-PSMA-617')).toBe('radiopharm');
    expect(inferModalityFromName('131 I-omburtamab')).toBe('radiopharm');
    expect(inferModalityFromName('mRNA-1273')).toBe('mrna');
    expect(inferModalityFromName('RSV vaccine')).toBe('vaccine');
    expect(inferModalityFromName('MK-3475')).toBeNull();
  });

  it('only ever returns values from RADAR_MODALITY_OPTIONS', () => {
    const allowed = new Set(RADAR_MODALITY_OPTIONS.map(o => o.value));
    for (const n of ['pembrolizumab', 'olaparib', 'Nusinersen', 'semaglutide', 'ide-cel', 'mRNA-1273', 'RSV vaccine', 'KEYTRUDA']) {
      const m = inferModalityFromName(n);
      if (m !== null) expect(allowed.has(m)).toBe(true);
    }
    expect(modalityFromChemblType('Small molecule')).toBe('small_molecule');
    expect(modalityFromChemblType('Antibody')).toBe('antibody');
    expect(modalityFromChemblType('Protein')).toBeNull();
    expect(modalityFromChemblType('Unknown')).toBeNull();
  });
});
