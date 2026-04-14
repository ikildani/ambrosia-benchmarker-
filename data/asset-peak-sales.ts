/**
 * Asset-level peak sales consensus (R60 — 2026-04-14).
 *
 * The engine's rNPV anchors on peak_sales_M, which today uses either an
 * indication-level `typicalAssetPeakSales_M` or a TA default. This flattens
 * enormous real-world variance:
 *
 *   Opdivo (approved onc PD-1):         $9.3B 2024 actual
 *   Enhertu (approved onc HER2 ADC):    $3.8B 2024 growing to ~$15B peak
 *   Phase 2 MDM2 oncology candidate:    $200-400M realistic peak
 *
 * Using "oncology = $2,500M" for all three is a 25× compression of legitimate
 * per-asset variance.
 *
 * This file exposes an asset-specific peak-sales override. Matched by
 * normalized asset name (lowercase, ASCII-folded, brand OR INN). When
 * matched, the backtest harness uses this value instead of the TA default.
 *
 * Sources: 2024 10-K annual report product revenues (Merck, BMS, Roche,
 * AbbVie, Novo Nordisk, Eli Lilly, Pfizer, J&J, Gilead, AstraZeneca,
 * Sanofi, Regeneron, Amgen). Peak projections for still-growing drugs
 * taken from EvaluatePharma World Preview 2024-2025 (publicly cited in
 * trade press) and company-disclosed 5-year guidance. No non-public
 * proprietary data used.
 *
 * Coverage: the 50 most-cited blockbuster drugs. Does NOT purport to
 * cover every asset in the backtest corpus — unmatched assets fall
 * through to indication/TA defaults.
 */

export interface AssetPeakSalesEntry {
  /** Brand name (e.g., 'Keytruda'). */
  brand: string;
  /** INN / generic name (e.g., 'pembrolizumab'). */
  inn: string;
  /** Company-recognized development code(s), if any. */
  codes: string[];
  /** Peak-sales anchor in $M — analyst consensus or actual 2024 sales for
   * mature drugs, or 3-5 year projected peak for still-growing drugs. */
  peakSales_M: number;
  /** Therapeutic area (for sanity checks). */
  therapeuticArea: string;
  /** Short source citation. */
  source: string;
}

/**
 * Blockbuster asset table. Key = entry identifier; matched against the
 * normalized asset_name / headline of the deal via `lookupAssetPeakSales()`.
 */
export const ASSET_PEAK_SALES_TABLE: AssetPeakSalesEntry[] = [
  // ─── Oncology (IO / targeted) ─────────────────────────────────────
  { brand: 'Keytruda', inn: 'pembrolizumab', codes: ['MK-3475'], peakSales_M: 30000, therapeuticArea: 'oncology', source: 'Merck 2024 10-K — $29.5B 2024 actual; growing' },
  { brand: 'Opdivo', inn: 'nivolumab', codes: ['BMS-936558'], peakSales_M: 10000, therapeuticArea: 'oncology', source: 'BMS 2024 10-K — $9.3B 2024 actual' },
  { brand: 'Tecentriq', inn: 'atezolizumab', codes: [], peakSales_M: 4000, therapeuticArea: 'oncology', source: 'Roche 2024 annual — ~$4B' },
  { brand: 'Yervoy', inn: 'ipilimumab', codes: [], peakSales_M: 2500, therapeuticArea: 'oncology', source: 'BMS 2024 10-K — $2.4B' },
  { brand: 'Libtayo', inn: 'cemiplimab', codes: [], peakSales_M: 1500, therapeuticArea: 'oncology', source: 'Regeneron 2024 10-K — $1.3B growing' },

  // ─── Oncology ADCs / targeted ────────────────────────────────────
  { brand: 'Enhertu', inn: 'trastuzumab deruxtecan', codes: ['DS-8201'], peakSales_M: 12000, therapeuticArea: 'oncology', source: 'Daiichi/AZ 2024 — $3.8B actual; EvaluatePharma peak $12B' },
  { brand: 'Kadcyla', inn: 'trastuzumab emtansine', codes: ['T-DM1'], peakSales_M: 2500, therapeuticArea: 'oncology', source: 'Roche 2024' },
  { brand: 'Trodelvy', inn: 'sacituzumab govitecan', codes: ['IMMU-132'], peakSales_M: 2500, therapeuticArea: 'oncology', source: 'Gilead 2024 10-K — $1.3B; analyst peak $2.5B' },
  { brand: 'Padcev', inn: 'enfortumab vedotin', codes: ['ASG-22CE'], peakSales_M: 3500, therapeuticArea: 'oncology', source: 'Pfizer/Astellas 2024 — $1.8B growing' },
  { brand: 'Elahere', inn: 'mirvetuximab soravtansine', codes: ['IMGN853'], peakSales_M: 1500, therapeuticArea: 'oncology', source: 'AbbVie 2024 — $500M growing' },
  { brand: 'Tivdak', inn: 'tisotumab vedotin', codes: [], peakSales_M: 500, therapeuticArea: 'oncology', source: 'Seagen/Pfizer 2024' },
  { brand: 'Lunsumio', inn: 'mosunetuzumab', codes: [], peakSales_M: 800, therapeuticArea: 'oncology', source: 'Roche 2024' },

  // ─── Oncology TKIs / small mol ────────────────────────────────────
  { brand: 'Tagrisso', inn: 'osimertinib', codes: ['AZD9291'], peakSales_M: 7000, therapeuticArea: 'oncology', source: 'AstraZeneca 2024 — $6.5B actual' },
  { brand: 'Imbruvica', inn: 'ibrutinib', codes: [], peakSales_M: 4500, therapeuticArea: 'oncology', source: 'AbbVie/J&J 2024 — $4.2B declining' },
  { brand: 'Revlimid', inn: 'lenalidomide', codes: [], peakSales_M: 6000, therapeuticArea: 'oncology', source: 'BMS 2024 — $6.3B (post-generic decline)' },
  { brand: 'Pomalyst', inn: 'pomalidomide', codes: [], peakSales_M: 3500, therapeuticArea: 'oncology', source: 'BMS 2024 — $3.4B' },
  { brand: 'Venclexta', inn: 'venetoclax', codes: [], peakSales_M: 2500, therapeuticArea: 'oncology', source: 'AbbVie 2024 — $2.4B' },
  { brand: 'Darzalex', inn: 'daratumumab', codes: [], peakSales_M: 12000, therapeuticArea: 'oncology', source: 'J&J 2024 10-K — $11.7B' },
  { brand: 'Calquence', inn: 'acalabrutinib', codes: [], peakSales_M: 3500, therapeuticArea: 'oncology', source: 'AstraZeneca 2024 — $3B growing' },
  { brand: 'Lynparza', inn: 'olaparib', codes: [], peakSales_M: 3500, therapeuticArea: 'oncology', source: 'AstraZeneca 2024 — $3.3B' },

  // ─── Oncology cell therapy / bispecifics ──────────────────────────
  { brand: 'Carvykti', inn: 'ciltacabtagene autoleucel', codes: [], peakSales_M: 3000, therapeuticArea: 'oncology', source: 'Legend/J&J 2024 — $960M growing; peak $3B' },
  { brand: 'Abecma', inn: 'idecabtagene vicleucel', codes: [], peakSales_M: 600, therapeuticArea: 'oncology', source: 'BMS 2024 — $406M' },
  { brand: 'Yescarta', inn: 'axicabtagene ciloleucel', codes: [], peakSales_M: 2000, therapeuticArea: 'oncology', source: 'Gilead Kite 2024 — $1.5B' },
  { brand: 'Breyanzi', inn: 'lisocabtagene maraleucel', codes: [], peakSales_M: 1500, therapeuticArea: 'oncology', source: 'BMS 2024 — $750M growing' },
  { brand: 'Tecvayli', inn: 'teclistamab', codes: [], peakSales_M: 2500, therapeuticArea: 'oncology', source: 'J&J 2024 — $820M growing' },
  { brand: 'Epkinly', inn: 'epcoritamab', codes: [], peakSales_M: 1500, therapeuticArea: 'oncology', source: 'AbbVie 2024' },

  // ─── Immunology ──────────────────────────────────────────────────
  { brand: 'Humira', inn: 'adalimumab', codes: [], peakSales_M: 10000, therapeuticArea: 'immunology', source: 'AbbVie 2024 — $9B (post-biosimilar)' },
  { brand: 'Dupixent', inn: 'dupilumab', codes: [], peakSales_M: 20000, therapeuticArea: 'immunology', source: 'Sanofi/Regeneron 2024 — $14.2B growing' },
  { brand: 'Skyrizi', inn: 'risankizumab', codes: [], peakSales_M: 17000, therapeuticArea: 'immunology', source: 'AbbVie 2024 — $11.7B growing' },
  { brand: 'Rinvoq', inn: 'upadacitinib', codes: [], peakSales_M: 10000, therapeuticArea: 'immunology', source: 'AbbVie 2024 — $6B growing' },
  { brand: 'Stelara', inn: 'ustekinumab', codes: [], peakSales_M: 10500, therapeuticArea: 'immunology', source: 'J&J 2024 — $10.4B declining' },
  { brand: 'Entyvio', inn: 'vedolizumab', codes: [], peakSales_M: 6000, therapeuticArea: 'immunology', source: 'Takeda 2024 — $5.6B' },
  { brand: 'Cosentyx', inn: 'secukinumab', codes: [], peakSales_M: 6000, therapeuticArea: 'immunology', source: 'Novartis 2024 — $5.8B' },
  { brand: 'Taltz', inn: 'ixekizumab', codes: [], peakSales_M: 3500, therapeuticArea: 'immunology', source: 'Eli Lilly 2024 — $3.2B' },
  { brand: 'Tremfya', inn: 'guselkumab', codes: [], peakSales_M: 4500, therapeuticArea: 'immunology', source: 'J&J 2024 — $4.0B' },

  // ─── Metabolic / GLP-1 ───────────────────────────────────────────
  { brand: 'Ozempic', inn: 'semaglutide', codes: [], peakSales_M: 25000, therapeuticArea: 'metabolic', source: 'Novo Nordisk 2024 — $17B growing' },
  { brand: 'Wegovy', inn: 'semaglutide', codes: [], peakSales_M: 18000, therapeuticArea: 'metabolic', source: 'Novo Nordisk 2024 — $8.5B growing' },
  { brand: 'Mounjaro', inn: 'tirzepatide', codes: ['LY3298176'], peakSales_M: 30000, therapeuticArea: 'metabolic', source: 'Eli Lilly 2024 — $11.5B growing' },
  { brand: 'Zepbound', inn: 'tirzepatide', codes: [], peakSales_M: 25000, therapeuticArea: 'metabolic', source: 'Eli Lilly 2024 — $4.9B fastest launch ever' },
  { brand: 'Trulicity', inn: 'dulaglutide', codes: [], peakSales_M: 7500, therapeuticArea: 'metabolic', source: 'Eli Lilly 2024 — $7.5B' },
  { brand: 'Rybelsus', inn: 'semaglutide oral', codes: [], peakSales_M: 3500, therapeuticArea: 'metabolic', source: 'Novo Nordisk 2024 — $3.4B' },

  // ─── Metabolic / SGLT2 ───────────────────────────────────────────
  { brand: 'Farxiga', inn: 'dapagliflozin', codes: [], peakSales_M: 8000, therapeuticArea: 'metabolic', source: 'AstraZeneca 2024 — $7.7B' },
  { brand: 'Jardiance', inn: 'empagliflozin', codes: [], peakSales_M: 9000, therapeuticArea: 'metabolic', source: 'BI/Lilly 2024 — $8.6B' },
  { brand: 'Invokana', inn: 'canagliflozin', codes: [], peakSales_M: 1500, therapeuticArea: 'metabolic', source: 'J&J 2024 declining' },

  // ─── Cardiovascular ──────────────────────────────────────────────
  { brand: 'Eliquis', inn: 'apixaban', codes: [], peakSales_M: 14000, therapeuticArea: 'cardiovascular', source: 'BMS/Pfizer 2024 — $13.3B' },
  { brand: 'Xarelto', inn: 'rivaroxaban', codes: [], peakSales_M: 4500, therapeuticArea: 'cardiovascular', source: 'Bayer/J&J 2024 — $4.3B declining' },
  { brand: 'Entresto', inn: 'sacubitril/valsartan', codes: [], peakSales_M: 8000, therapeuticArea: 'cardiovascular', source: 'Novartis 2024 — $7.8B' },
  { brand: 'Repatha', inn: 'evolocumab', codes: [], peakSales_M: 2500, therapeuticArea: 'cardiovascular', source: 'Amgen 2024 — $2.2B' },
  { brand: 'Leqvio', inn: 'inclisiran', codes: [], peakSales_M: 3000, therapeuticArea: 'cardiovascular', source: 'Novartis 2024 — $750M growing; peak $3B' },
  { brand: 'Camzyos', inn: 'mavacamten', codes: [], peakSales_M: 4000, therapeuticArea: 'cardiovascular', source: 'BMS 2024 — $600M growing; peak $4B HCM' },
  { brand: 'Verquvo', inn: 'vericiguat', codes: [], peakSales_M: 1000, therapeuticArea: 'cardiovascular', source: 'Merck/Bayer 2024' },

  // ─── Rare disease ────────────────────────────────────────────────
  { brand: 'Spinraza', inn: 'nusinersen', codes: [], peakSales_M: 1700, therapeuticArea: 'rareDisease', source: 'Biogen 2024 — $1.6B declining (Zolgensma competition)' },
  { brand: 'Soliris', inn: 'eculizumab', codes: [], peakSales_M: 3000, therapeuticArea: 'rareDisease', source: 'AstraZeneca/Alexion 2024 — $3.0B' },
  { brand: 'Ultomiris', inn: 'ravulizumab', codes: [], peakSales_M: 5000, therapeuticArea: 'rareDisease', source: 'AstraZeneca/Alexion 2024 — $3.9B growing' },
  { brand: 'Zolgensma', inn: 'onasemnogene abeparvovec', codes: [], peakSales_M: 1500, therapeuticArea: 'rareDisease', source: 'Novartis 2024 — $1.2B' },
  { brand: 'Luxturna', inn: 'voretigene neparvovec', codes: [], peakSales_M: 100, therapeuticArea: 'rareDisease', source: 'Roche/Spark 2024' },
  { brand: 'Trikafta', inn: 'elexacaftor/tezacaftor/ivacaftor', codes: [], peakSales_M: 11000, therapeuticArea: 'rareDisease', source: 'Vertex 2024 — $10.2B CF franchise' },
  { brand: 'Crysvita', inn: 'burosumab', codes: [], peakSales_M: 600, therapeuticArea: 'rareDisease', source: 'Ultragenyx 2024 — $470M' },
  { brand: 'Galafold', inn: 'migalastat', codes: [], peakSales_M: 500, therapeuticArea: 'rareDisease', source: 'Amicus 2024 — $413M' },
  { brand: 'Casgevy', inn: 'exagamglogene autotemcel', codes: [], peakSales_M: 2000, therapeuticArea: 'rareDisease', source: 'Vertex/CRISPR 2024 launching' },

  // ─── Neurology ───────────────────────────────────────────────────
  { brand: 'Ocrevus', inn: 'ocrelizumab', codes: [], peakSales_M: 7500, therapeuticArea: 'neurology', source: 'Roche 2024 — $6.5B' },
  { brand: 'Leqembi', inn: 'lecanemab', codes: [], peakSales_M: 8000, therapeuticArea: 'neurology', source: 'Eisai/Biogen 2024 launch; analyst peak $8B' },
  { brand: 'Kisunla', inn: 'donanemab', codes: [], peakSales_M: 5000, therapeuticArea: 'neurology', source: 'Eli Lilly 2024 launch' },
  { brand: 'Austedo', inn: 'deutetrabenazine', codes: [], peakSales_M: 2000, therapeuticArea: 'neurology', source: 'Teva 2024 — $1.6B' },
  { brand: 'Ingrezza', inn: 'valbenazine', codes: [], peakSales_M: 3500, therapeuticArea: 'neurology', source: 'Neurocrine 2024 — $2.3B' },
  { brand: 'Aubagio', inn: 'teriflunomide', codes: [], peakSales_M: 1500, therapeuticArea: 'neurology', source: 'Sanofi 2024 (post-generic)' },
  { brand: 'Tysabri', inn: 'natalizumab', codes: [], peakSales_M: 2500, therapeuticArea: 'neurology', source: 'Biogen 2024 — $1.8B declining' },

  // ─── Hematology ──────────────────────────────────────────────────
  { brand: 'Rezurock', inn: 'belumosudil', codes: [], peakSales_M: 800, therapeuticArea: 'hematology', source: 'Sanofi 2024' },
  { brand: 'Jakafi', inn: 'ruxolitinib', codes: [], peakSales_M: 3500, therapeuticArea: 'hematology', source: 'Incyte/Novartis 2024 — $3.1B' },
  { brand: 'Reblozyl', inn: 'luspatercept', codes: [], peakSales_M: 2500, therapeuticArea: 'hematology', source: 'BMS/Merck 2024 — $1.6B growing' },

  // ─── Ophthalmology ───────────────────────────────────────────────
  { brand: 'Eylea', inn: 'aflibercept', codes: [], peakSales_M: 10000, therapeuticArea: 'ophthalmology', source: 'Regeneron/Bayer 2024 — $9.4B' },
  { brand: 'Eylea HD', inn: 'aflibercept 8mg', codes: [], peakSales_M: 3000, therapeuticArea: 'ophthalmology', source: 'Regeneron 2024 launch' },
  { brand: 'Vabysmo', inn: 'faricimab', codes: [], peakSales_M: 6000, therapeuticArea: 'ophthalmology', source: 'Roche 2024 — $3.9B growing' },
  { brand: 'Lucentis', inn: 'ranibizumab', codes: [], peakSales_M: 3000, therapeuticArea: 'ophthalmology', source: 'Roche/Novartis (biosimilar-eroded)' },
  { brand: 'Syfovre', inn: 'pegcetacoplan', codes: [], peakSales_M: 2000, therapeuticArea: 'ophthalmology', source: 'Apellis 2024 — $625M growing (GA)' },
  { brand: 'Izervay', inn: 'avacincaptad pegol', codes: [], peakSales_M: 1500, therapeuticArea: 'ophthalmology', source: 'Astellas/Iveric 2024' },

  // ─── Dermatology ─────────────────────────────────────────────────
  { brand: 'Litfulo', inn: 'ritlecitinib', codes: [], peakSales_M: 800, therapeuticArea: 'dermatology', source: 'Pfizer 2024' },
  { brand: 'Olumiant', inn: 'baricitinib', codes: [], peakSales_M: 1200, therapeuticArea: 'dermatology', source: 'Eli Lilly/Incyte 2024' },
  { brand: 'Nemluvio', inn: 'nemolizumab', codes: [], peakSales_M: 2000, therapeuticArea: 'dermatology', source: 'Galderma 2024 launching' },

  // ─── Infectious disease ──────────────────────────────────────────
  { brand: 'Paxlovid', inn: 'nirmatrelvir/ritonavir', codes: [], peakSales_M: 2000, therapeuticArea: 'infectiousDisease', source: 'Pfizer 2024 — $5.7B (post-pandemic decline)' },
  { brand: 'Biktarvy', inn: 'bictegravir/emtricitabine/tenofovir', codes: [], peakSales_M: 13500, therapeuticArea: 'infectiousDisease', source: 'Gilead 2024 — $13.4B' },
  { brand: 'Rezafungin', inn: 'rezafungin', codes: [], peakSales_M: 200, therapeuticArea: 'infectiousDisease', source: 'Cidara/Melinta — narrow antifungal market' },

  // ─── Phase 3 pipeline assets (analyst consensus peaks, not actuals) ─
  { brand: 'Dato-DXd', inn: 'datopotamab deruxtecan', codes: ['DS-1062'], peakSales_M: 9000, therapeuticArea: 'oncology', source: 'AZ/Daiichi phase 3 — RBC/Barclays peak $8-10B (TROP2 ADC broad NSCLC/breast)' },
  { brand: 'Tulisokibart', inn: 'tulisokibart', codes: ['PRA-023', 'MK-7240'], peakSales_M: 6000, therapeuticArea: 'gastroenterology', source: 'Prometheus/Merck acquisition ($10.8B) TL1A IBD — analyst peak $5-7B' },
  { brand: 'Petosemtamab', inn: 'petosemtamab', codes: ['MCLA-158'], peakSales_M: 2000, therapeuticArea: 'oncology', source: 'Merus phase 3 EGFR×LGR5 HNSCC — analyst peak $2B' },
  { brand: 'MariTide', inn: 'maridebart cafraglutide', codes: ['AMG-133'], peakSales_M: 15000, therapeuticArea: 'metabolic', source: 'Amgen GLP-1/GIP antagonist obesity — analyst peak $15B' },
  { brand: 'VK2735', inn: 'VK2735', codes: [], peakSales_M: 8000, therapeuticArea: 'metabolic', source: 'Viking Therapeutics GLP-1/GIP obesity — analyst peak $8B' },
  { brand: 'Emraclidine', inn: 'emraclidine', codes: ['CVL-231'], peakSales_M: 5000, therapeuticArea: 'neurology', source: 'Cerevel/AbbVie M4 schizophrenia — acquisition peak $5-8B' },
  { brand: 'Zuranolone', inn: 'zuranolone', codes: ['SAGE-217'], peakSales_M: 1500, therapeuticArea: 'neurology', source: 'Sage/Biogen PPD — analyst peak $1-2B' },
  { brand: 'KarXT', inn: 'xanomeline/trospium', codes: [], peakSales_M: 8000, therapeuticArea: 'neurology', source: 'Karuna/BMS M1-M4 schizophrenia — acquisition peak $8B' },
  { brand: 'Cobenfy', inn: 'xanomeline/trospium', codes: [], peakSales_M: 8000, therapeuticArea: 'neurology', source: 'BMS 2024 launch (KarXT brand) — analyst peak $8B' },
  { brand: 'Resmetirom', inn: 'resmetirom', codes: ['MGL-3196'], peakSales_M: 5000, therapeuticArea: 'metabolic', source: 'Madrigal MASH — analyst peak $3-6B' },
  { brand: 'Rezdiffra', inn: 'resmetirom', codes: [], peakSales_M: 5000, therapeuticArea: 'metabolic', source: 'Madrigal MASH brand launched 2024' },
  { brand: 'Ensifentrine', inn: 'ensifentrine', codes: ['RPL-554'], peakSales_M: 3000, therapeuticArea: 'pulmonology', source: 'Verona COPD PDE3/4 — analyst peak $3B' },
  { brand: 'Seladelpar', inn: 'seladelpar', codes: ['MBX-8025'], peakSales_M: 1500, therapeuticArea: 'hepatology', source: 'Gilead/CymaBay PBC — analyst peak $1.5B' },
  { brand: 'Efgartigimod', inn: 'efgartigimod', codes: ['ARGX-113'], peakSales_M: 6000, therapeuticArea: 'immunology', source: 'argenx FcRn generalized myasthenia gravis — analyst peak $5-8B' },
  { brand: 'Vyvgart', inn: 'efgartigimod', codes: [], peakSales_M: 6000, therapeuticArea: 'immunology', source: 'argenx 2024 launch — $2.2B growing' },
  { brand: 'Vonoprazan', inn: 'vonoprazan', codes: [], peakSales_M: 2000, therapeuticArea: 'gastroenterology', source: 'Phathom/Takeda GERD — analyst peak $2B' },
  { brand: 'Voquezna', inn: 'vonoprazan', codes: [], peakSales_M: 2000, therapeuticArea: 'gastroenterology', source: 'Phathom 2024 launch' },
  { brand: 'Etrasimod', inn: 'etrasimod', codes: ['APD-334'], peakSales_M: 2500, therapeuticArea: 'gastroenterology', source: 'Pfizer S1P ulcerative colitis — analyst peak $2-3B' },
  { brand: 'Velsipity', inn: 'etrasimod', codes: [], peakSales_M: 2500, therapeuticArea: 'gastroenterology', source: 'Pfizer 2024 launch (etrasimod brand)' },
  { brand: 'Mirikizumab', inn: 'mirikizumab', codes: ['LY3074828'], peakSales_M: 3000, therapeuticArea: 'immunology', source: 'Eli Lilly IL-23 IBD — analyst peak $3B' },
  { brand: 'Omvoh', inn: 'mirikizumab', codes: [], peakSales_M: 3000, therapeuticArea: 'immunology', source: 'Eli Lilly 2024 launch' },
  { brand: 'Nexviazyme', inn: 'avalglucosidase alfa', codes: [], peakSales_M: 600, therapeuticArea: 'rareDisease', source: 'Sanofi late-onset Pompe — 2024 $430M' },
  { brand: 'Inaxaplin', inn: 'inaxaplin', codes: ['VX-147'], peakSales_M: 2500, therapeuticArea: 'nephrology', source: 'Vertex APOL1 FSGS — analyst peak $2-3B' },
  { brand: 'Fidanacogene', inn: 'fidanacogene elaparvovec', codes: [], peakSales_M: 800, therapeuticArea: 'rareDisease', source: 'Pfizer hemophilia B gene therapy' },
  { brand: 'Beqvez', inn: 'fidanacogene elaparvovec', codes: [], peakSales_M: 800, therapeuticArea: 'rareDisease', source: 'Pfizer 2024 launch' },
  { brand: 'Roctavian', inn: 'valoctocogene roxaparvovec', codes: [], peakSales_M: 400, therapeuticArea: 'rareDisease', source: 'BioMarin hemophilia A gene therapy — slow launch' },
  { brand: 'Hemgenix', inn: 'etranacogene dezaparvovec', codes: [], peakSales_M: 600, therapeuticArea: 'rareDisease', source: 'uniQure/CSL hemophilia B' },
  { brand: 'Lenmeldy', inn: 'atidarsagene autotemcel', codes: [], peakSales_M: 300, therapeuticArea: 'rareDisease', source: 'Orchard MLD — narrow orphan' },
  { brand: 'Elevidys', inn: 'delandistrogene moxeparvovec', codes: ['SRP-9001'], peakSales_M: 3000, therapeuticArea: 'rareDisease', source: 'Sarepta DMD gene therapy — $820M 2024 growing' },
  { brand: 'Givinostat', inn: 'givinostat', codes: ['ITF-2357'], peakSales_M: 600, therapeuticArea: 'rareDisease', source: 'Italfarmaco/Duchenne — analyst peak $600M' },
  { brand: 'Abelacimab', inn: 'abelacimab', codes: ['MAA-868'], peakSales_M: 3500, therapeuticArea: 'cardiovascular', source: 'Anthos/Novartis factor XI — analyst peak $3-5B' },
  { brand: 'Milvexian', inn: 'milvexian', codes: ['JNJ-70033093'], peakSales_M: 3000, therapeuticArea: 'cardiovascular', source: 'J&J/BMS factor XIa — analyst peak $3B' },
  { brand: 'Asundexian', inn: 'asundexian', codes: ['BAY-2433334'], peakSales_M: 2500, therapeuticArea: 'cardiovascular', source: 'Bayer factor XIa — analyst peak $2-3B (post Ph3 risk)' },

  // ─── ADC / bispecific pipeline (Phase 1-3 with analyst peak) ─────
  { brand: 'Ifinatamab deruxtecan', inn: 'ifinatamab deruxtecan', codes: ['DS-7300', 'I-DXd'], peakSales_M: 3000, therapeuticArea: 'oncology', source: 'Daiichi/Merck B7-H3 ADC SCLC — analyst peak $3B' },
  { brand: 'Raludotatug deruxtecan', inn: 'raludotatug deruxtecan', codes: ['R-DXd', 'DS-6000'], peakSales_M: 2500, therapeuticArea: 'oncology', source: 'Daiichi/Merck CDH6 ADC ovarian — analyst peak $2-3B' },
  { brand: 'Patritumab deruxtecan', inn: 'patritumab deruxtecan', codes: ['HER3-DXd', 'U3-1402'], peakSales_M: 4000, therapeuticArea: 'oncology', source: 'Daiichi/Merck HER3 ADC NSCLC/breast — analyst peak $3-5B' },
  { brand: 'BNT327', inn: 'BNT327', codes: ['PM8002'], peakSales_M: 5000, therapeuticArea: 'oncology', source: 'BioNTech PD-L1×VEGF-A bispecific — licensed from Biotheus $800M upfront; analyst peak $5B' },
  { brand: 'Ivonescimab', inn: 'ivonescimab', codes: ['AK112'], peakSales_M: 6000, therapeuticArea: 'oncology', source: 'Akeso/Summit PD-1×VEGF — beat Keytruda in HARMONi-2 — analyst peak $5-8B' },
  { brand: 'Golcadomide', inn: 'golcadomide', codes: ['CC-99282'], peakSales_M: 2500, therapeuticArea: 'oncology', source: 'BMS CELMoD — lymphoma — analyst peak $2-3B' },
  { brand: 'Mezigdomide', inn: 'mezigdomide', codes: ['CC-92480'], peakSales_M: 2500, therapeuticArea: 'oncology', source: 'BMS CELMoD — MM — analyst peak $2-3B' },

  // ─── R62 EXPANSION (2026-04-14) — 80+ additional entries ─────────────
  // Sourced from: 2024 10-K product revenues (still-current) + JPM Healthcare
  // 2025 analyst decks + Barclays/Jefferies/Evercore ISI peak projections
  // (publicly cited in BioCentury, Endpoints News, FierceBiotech).

  // ─── Oncology — more TKIs / small mol ────────────────────────────
  { brand: 'Braftovi', inn: 'encorafenib', codes: [], peakSales_M: 1200, therapeuticArea: 'oncology', source: 'Pfizer 2024 — $600M growing (CRC/melanoma BRAF)' },
  { brand: 'Mektovi', inn: 'binimetinib', codes: [], peakSales_M: 800, therapeuticArea: 'oncology', source: 'Pfizer 2024 — MEK inhibitor combos' },
  { brand: 'Tabrecta', inn: 'capmatinib', codes: [], peakSales_M: 400, therapeuticArea: 'oncology', source: 'Novartis 2024 — MET NSCLC' },
  { brand: 'Tepmetko', inn: 'tepotinib', codes: [], peakSales_M: 500, therapeuticArea: 'oncology', source: 'Merck KGaA 2024 — MET NSCLC' },
  { brand: 'Retevmo', inn: 'selpercatinib', codes: [], peakSales_M: 1500, therapeuticArea: 'oncology', source: 'Eli Lilly 2024 — $700M growing (RET NSCLC/MTC)' },
  { brand: 'Gavreto', inn: 'pralsetinib', codes: [], peakSales_M: 500, therapeuticArea: 'oncology', source: 'Roche/Blueprint 2024 — RET' },
  { brand: 'Lorbrena', inn: 'lorlatinib', codes: [], peakSales_M: 1200, therapeuticArea: 'oncology', source: 'Pfizer 2024 — $850M (ALK NSCLC)' },
  { brand: 'Alecensa', inn: 'alectinib', codes: [], peakSales_M: 2000, therapeuticArea: 'oncology', source: 'Roche 2024 — $1.8B (ALK NSCLC)' },
  { brand: 'Rozlytrek', inn: 'entrectinib', codes: [], peakSales_M: 400, therapeuticArea: 'oncology', source: 'Roche 2024 — TRK/ROS1' },
  { brand: 'Vitrakvi', inn: 'larotrectinib', codes: [], peakSales_M: 400, therapeuticArea: 'oncology', source: 'Bayer/Loxo 2024 — TRK fusion' },
  { brand: 'Krazati', inn: 'adagrasib', codes: ['MRTX-849'], peakSales_M: 1500, therapeuticArea: 'oncology', source: 'BMS/Mirati 2024 — KRAS G12C NSCLC, CRC' },
  { brand: 'Lumakras', inn: 'sotorasib', codes: ['AMG-510'], peakSales_M: 1000, therapeuticArea: 'oncology', source: 'Amgen 2024 — $200M first-gen KRAS G12C' },
  { brand: 'Divarasib', inn: 'divarasib', codes: ['GDC-6036'], peakSales_M: 3500, therapeuticArea: 'oncology', source: 'Roche KRAS G12C phase 3 — analyst peak $3-4B' },
  { brand: 'Mirdametinib', inn: 'mirdametinib', codes: ['PD-0325901'], peakSales_M: 1000, therapeuticArea: 'oncology', source: 'SpringWorks MEK NF1-PN — analyst peak $1B' },
  { brand: 'Vimseltinib', inn: 'vimseltinib', codes: ['DCC-3014'], peakSales_M: 500, therapeuticArea: 'oncology', source: 'Deciphera TGCT — analyst peak $500M' },
  { brand: 'Niraparib', inn: 'niraparib', codes: [], peakSales_M: 1000, therapeuticArea: 'oncology', source: 'GSK Zejula 2024 — PARP ovarian' },
  { brand: 'Zejula', inn: 'niraparib', codes: [], peakSales_M: 1000, therapeuticArea: 'oncology', source: 'GSK 2024 — $700M' },
  { brand: 'Rubraca', inn: 'rucaparib', codes: [], peakSales_M: 300, therapeuticArea: 'oncology', source: 'Clovis post-bankruptcy' },

  // ─── Oncology — more ADC / bispecific / cell therapy ─────────────
  { brand: 'Polivy', inn: 'polatuzumab vedotin', codes: [], peakSales_M: 1500, therapeuticArea: 'oncology', source: 'Roche 2024 — $900M growing (DLBCL)' },
  { brand: 'Blenrep', inn: 'belantamab mafodotin', codes: [], peakSales_M: 2500, therapeuticArea: 'oncology', source: 'GSK 2024 re-launch (BCMA ADC MM)' },
  { brand: 'Columvi', inn: 'glofitamab', codes: [], peakSales_M: 1500, therapeuticArea: 'oncology', source: 'Roche 2024 — CD20xCD3 bispecific DLBCL' },
  { brand: 'Talvey', inn: 'talquetamab', codes: [], peakSales_M: 2500, therapeuticArea: 'oncology', source: 'J&J 2024 — GPRC5D×CD3 MM' },
  { brand: 'Elrexfio', inn: 'elranatamab', codes: [], peakSales_M: 2000, therapeuticArea: 'oncology', source: 'Pfizer 2024 — BCMA×CD3 MM' },
  { brand: 'Erleada', inn: 'apalutamide', codes: [], peakSales_M: 3000, therapeuticArea: 'oncology', source: 'J&J 2024 — $2.4B (AR prostate)' },
  { brand: 'Nubeqa', inn: 'darolutamide', codes: [], peakSales_M: 3000, therapeuticArea: 'oncology', source: 'Bayer/Orion 2024 — $1.5B growing (AR prostate)' },
  { brand: 'Xtandi', inn: 'enzalutamide', codes: [], peakSales_M: 7000, therapeuticArea: 'oncology', source: 'Astellas/Pfizer 2024 — $6.5B (AR prostate)' },
  { brand: 'Pluvicto', inn: 'lutetium-177-PSMA-617', codes: [], peakSales_M: 5000, therapeuticArea: 'oncology', source: 'Novartis 2024 — $1.4B growing (PSMA radiopharm prostate)' },
  { brand: 'Lutathera', inn: 'lutetium-177-dotatate', codes: [], peakSales_M: 1200, therapeuticArea: 'oncology', source: 'Novartis 2024 — $680M (NET radiopharm)' },
  { brand: 'Vanflyta', inn: 'quizartinib', codes: [], peakSales_M: 500, therapeuticArea: 'oncology', source: 'Daiichi 2024 — FLT3 AML' },
  { brand: 'Rezlidhia', inn: 'olutasidenib', codes: [], peakSales_M: 300, therapeuticArea: 'oncology', source: 'Rigel 2024 — IDH1 AML' },
  { brand: 'Tibsovo', inn: 'ivosidenib', codes: [], peakSales_M: 600, therapeuticArea: 'oncology', source: 'Servier 2024 — IDH1 AML/cholangiocarcinoma' },

  // ─── Immunology — more ────────────────────────────────────────────
  { brand: 'Xeljanz', inn: 'tofacitinib', codes: [], peakSales_M: 2000, therapeuticArea: 'immunology', source: 'Pfizer 2024 — $1.7B (JAK RA/UC)' },
  { brand: 'Olumiant', inn: 'baricitinib', codes: [], peakSales_M: 1200, therapeuticArea: 'immunology', source: 'Eli Lilly 2024 — $900M' },
  { brand: 'Cibinqo', inn: 'abrocitinib', codes: [], peakSales_M: 1500, therapeuticArea: 'immunology', source: 'Pfizer 2024 — JAK AD' },
  { brand: 'Kevzara', inn: 'sarilumab', codes: [], peakSales_M: 600, therapeuticArea: 'immunology', source: 'Sanofi/Regeneron 2024 — IL-6 RA' },
  { brand: 'Actemra', inn: 'tocilizumab', codes: [], peakSales_M: 2500, therapeuticArea: 'immunology', source: 'Roche 2024 — post-biosimilar' },
  { brand: 'Simponi', inn: 'golimumab', codes: [], peakSales_M: 2000, therapeuticArea: 'immunology', source: 'J&J 2024 — post-biosimilar TNF' },
  { brand: 'Nucala', inn: 'mepolizumab', codes: [], peakSales_M: 2200, therapeuticArea: 'immunology', source: 'GSK 2024 — $1.9B (IL-5 eosinophilic)' },
  { brand: 'Fasenra', inn: 'benralizumab', codes: [], peakSales_M: 2500, therapeuticArea: 'immunology', source: 'AstraZeneca 2024 — $2.1B' },
  { brand: 'Tezspire', inn: 'tezepelumab', codes: [], peakSales_M: 3500, therapeuticArea: 'immunology', source: 'AstraZeneca/Amgen 2024 — $900M growing (TSLP asthma)' },
  { brand: 'Evenity', inn: 'romosozumab', codes: [], peakSales_M: 1500, therapeuticArea: 'immunology', source: 'Amgen/UCB 2024 — sclerostin osteoporosis' },
  { brand: 'Prolia', inn: 'denosumab', codes: [], peakSales_M: 4500, therapeuticArea: 'immunology', source: 'Amgen 2024 — $4.3B osteoporosis' },
  { brand: 'Xgeva', inn: 'denosumab (oncology)', codes: [], peakSales_M: 2500, therapeuticArea: 'oncology', source: 'Amgen 2024 — bone metastasis' },

  // ─── Neurology — more ────────────────────────────────────────────
  { brand: 'Tafinlar', inn: 'dabrafenib', codes: [], peakSales_M: 1200, therapeuticArea: 'oncology', source: 'Novartis 2024 — BRAF combo (moved from onc per indication)' },
  { brand: 'Qulipta', inn: 'atogepant', codes: [], peakSales_M: 2500, therapeuticArea: 'neurology', source: 'AbbVie 2024 — $550M growing (CGRP migraine)' },
  { brand: 'Ubrelvy', inn: 'ubrogepant', codes: [], peakSales_M: 1500, therapeuticArea: 'neurology', source: 'AbbVie 2024 — acute migraine CGRP' },
  { brand: 'Nurtec', inn: 'rimegepant', codes: [], peakSales_M: 2500, therapeuticArea: 'neurology', source: 'Pfizer 2024 — $1.3B growing' },
  { brand: 'Aimovig', inn: 'erenumab', codes: [], peakSales_M: 1200, therapeuticArea: 'neurology', source: 'Amgen/Novartis 2024 — CGRP migraine prev' },
  { brand: 'Ajovy', inn: 'fremanezumab', codes: [], peakSales_M: 800, therapeuticArea: 'neurology', source: 'Teva 2024 — CGRP' },
  { brand: 'Emgality', inn: 'galcanezumab', codes: [], peakSales_M: 900, therapeuticArea: 'neurology', source: 'Eli Lilly 2024 — CGRP' },
  { brand: 'Mayzent', inn: 'siponimod', codes: [], peakSales_M: 800, therapeuticArea: 'neurology', source: 'Novartis 2024 — SPMS S1P' },
  { brand: 'Ponvory', inn: 'ponesimod', codes: [], peakSales_M: 300, therapeuticArea: 'neurology', source: 'J&J 2024 — S1P MS' },
  { brand: 'Zeposia', inn: 'ozanimod', codes: [], peakSales_M: 2000, therapeuticArea: 'immunology', source: 'BMS 2024 — $460M growing (S1P MS/UC)' },
  { brand: 'Kesimpta', inn: 'ofatumumab', codes: [], peakSales_M: 4000, therapeuticArea: 'neurology', source: 'Novartis 2024 — $2.2B growing (anti-CD20 MS)' },
  { brand: 'Briumvi', inn: 'ublituximab', codes: [], peakSales_M: 500, therapeuticArea: 'neurology', source: 'TG Therapeutics 2024' },

  // ─── Metabolic / CF — more ────────────────────────────────────────
  { brand: 'Kalydeco', inn: 'ivacaftor', codes: [], peakSales_M: 1500, therapeuticArea: 'rareDisease', source: 'Vertex 2024 — CFTR G551D' },
  { brand: 'Symdeko', inn: 'tezacaftor/ivacaftor', codes: [], peakSales_M: 800, therapeuticArea: 'rareDisease', source: 'Vertex 2024 — CF' },
  { brand: 'Orkambi', inn: 'lumacaftor/ivacaftor', codes: [], peakSales_M: 400, therapeuticArea: 'rareDisease', source: 'Vertex 2024 post-Trikafta' },
  { brand: 'Journavx', inn: 'suzetrigine', codes: ['VX-548'], peakSales_M: 5000, therapeuticArea: 'pain_management', source: 'Vertex 2025 launch — Nav1.8 non-opioid pain, analyst peak $5B' },
  { brand: 'Sotyktu', inn: 'deucravacitinib', codes: [], peakSales_M: 4000, therapeuticArea: 'immunology', source: 'BMS 2024 — $1.2B growing (TYK2 psoriasis)' },
  { brand: 'Tremfya', inn: 'guselkumab (expansion)', codes: [], peakSales_M: 4500, therapeuticArea: 'immunology', source: 'J&J 2024 — IL-23 franchise' },

  // ─── Cardiovascular / factor XI / Lp(a) ───────────────────────────
  { brand: 'Olpasiran', inn: 'olpasiran', codes: ['AMG-890'], peakSales_M: 3500, therapeuticArea: 'cardiovascular', source: 'Amgen Lp(a) siRNA phase 3 — analyst peak $3-4B' },
  { brand: 'Pelacarsen', inn: 'pelacarsen', codes: ['TQJ-230'], peakSales_M: 4000, therapeuticArea: 'cardiovascular', source: 'Novartis/Akcea Lp(a) ASO phase 3 — analyst peak $3-5B' },
  { brand: 'Lepodisiran', inn: 'lepodisiran', codes: ['LY3561774'], peakSales_M: 3500, therapeuticArea: 'cardiovascular', source: 'Eli Lilly Lp(a) siRNA — analyst peak' },
  { brand: 'Plozasiran', inn: 'plozasiran', codes: ['ARO-APOC3'], peakSales_M: 2000, therapeuticArea: 'cardiovascular', source: 'Arrowhead/Amgen APOC3 siRNA — analyst peak $2B' },
  { brand: 'Olezarsen', inn: 'olezarsen', codes: [], peakSales_M: 1500, therapeuticArea: 'cardiovascular', source: 'Ionis APOC3 ASO FCS — analyst peak' },
  { brand: 'Tryngolza', inn: 'olezarsen', codes: [], peakSales_M: 1500, therapeuticArea: 'cardiovascular', source: 'Ionis 2024 launch — FCS' },
  { brand: 'Mavyret', inn: 'glecaprevir/pibrentasvir', codes: [], peakSales_M: 2000, therapeuticArea: 'infectiousDisease', source: 'AbbVie 2024 — HCV' },

  // ─── Rare disease / gene therapy — more ──────────────────────────
  { brand: 'Vyjuvek', inn: 'beremagene geperpavec', codes: [], peakSales_M: 800, therapeuticArea: 'rareDisease', source: 'Krystal Bio DEB gene therapy 2024' },
  { brand: 'Upstaza', inn: 'eladocagene exuparvovec', codes: [], peakSales_M: 300, therapeuticArea: 'rareDisease', source: 'PTC AADC gene therapy' },
  { brand: 'Elfabrio', inn: 'pegunigalsidase alfa', codes: [], peakSales_M: 500, therapeuticArea: 'rareDisease', source: 'Chiesi/Protalix Fabry' },
  { brand: 'Xenpozyme', inn: 'olipudase alfa', codes: [], peakSales_M: 800, therapeuticArea: 'rareDisease', source: 'Sanofi ASMD 2024' },
  { brand: 'Joenja', inn: 'leniolisib', codes: [], peakSales_M: 400, therapeuticArea: 'rareDisease', source: 'Pharming APDS' },
  { brand: 'Skyclarys', inn: 'omaveloxolone', codes: [], peakSales_M: 1200, therapeuticArea: 'rareDisease', source: 'Reata/Biogen 2024 — Friedreich ataxia' },
  { brand: 'Pombiliti', inn: 'cipaglucosidase alfa', codes: [], peakSales_M: 500, therapeuticArea: 'rareDisease', source: 'Amicus Pompe' },
  { brand: 'Elevidys', inn: 'delandistrogene moxeparvovec (expansion)', codes: [], peakSales_M: 4000, therapeuticArea: 'rareDisease', source: 'Sarepta DMD — expanded analyst peak $3-5B' },

  // ─── Dermatology / topical ────────────────────────────────────────
  { brand: 'Vtama', inn: 'tapinarof', codes: [], peakSales_M: 1200, therapeuticArea: 'dermatology', source: 'Organon/Dermavant — AhR psoriasis/AD' },
  { brand: 'Zoryve', inn: 'roflumilast', codes: [], peakSales_M: 1500, therapeuticArea: 'dermatology', source: 'Arcutis 2024 — PDE4 topical psoriasis/AD' },
  { brand: 'Opzelura', inn: 'ruxolitinib topical', codes: [], peakSales_M: 2000, therapeuticArea: 'dermatology', source: 'Incyte 2024 — $520M growing (JAK topical)' },
  { brand: 'Winlevi', inn: 'clascoterone', codes: [], peakSales_M: 400, therapeuticArea: 'dermatology', source: 'Cassiopea acne AR' },

  // ─── Infectious disease / antivirals ─────────────────────────────
  { brand: 'Lagevrio', inn: 'molnupiravir', codes: [], peakSales_M: 1500, therapeuticArea: 'infectiousDisease', source: 'Merck 2024 — post-COVID decline' },
  { brand: 'Remdesivir', inn: 'remdesivir', codes: [], peakSales_M: 2500, therapeuticArea: 'infectiousDisease', source: 'Gilead Veklury 2024' },
  { brand: 'Veklury', inn: 'remdesivir', codes: [], peakSales_M: 2500, therapeuticArea: 'infectiousDisease', source: 'Gilead 2024 — $1.6B COVID antiviral' },
  { brand: 'Shingrix', inn: 'zoster recombinant', codes: [], peakSales_M: 4500, therapeuticArea: 'infectiousDisease', source: 'GSK 2024 — $4.2B vaccine' },
  { brand: 'Prevnar', inn: 'pneumococcal conjugate', codes: [], peakSales_M: 6500, therapeuticArea: 'infectiousDisease', source: 'Pfizer 2024 — $6.5B vaccine' },
  { brand: 'Arexvy', inn: 'RSV vaccine adults', codes: [], peakSales_M: 3500, therapeuticArea: 'infectiousDisease', source: 'GSK 2024 — $1.6B launch' },
  { brand: 'Abrysvo', inn: 'RSV vaccine adults/maternal', codes: [], peakSales_M: 3000, therapeuticArea: 'infectiousDisease', source: 'Pfizer 2024 — $890M growing' },
  { brand: 'mRESVIA', inn: 'mRNA RSV vaccine', codes: ['mRNA-1345'], peakSales_M: 2000, therapeuticArea: 'infectiousDisease', source: 'Moderna 2024 approval' },
  { brand: 'Beyfortus', inn: 'nirsevimab', codes: [], peakSales_M: 2500, therapeuticArea: 'infectiousDisease', source: 'Sanofi/AZ 2024 — $1.7B infant RSV mAb' },

  // ─── Nephrology / renal ─────────────────────────────────────────
  { brand: 'Filspari', inn: 'sparsentan', codes: [], peakSales_M: 1500, therapeuticArea: 'nephrology', source: 'Travere IgA nephropathy — analyst peak $1.5B' },
  { brand: 'Tarpeyo', inn: 'budesonide delayed-release', codes: [], peakSales_M: 1000, therapeuticArea: 'nephrology', source: 'Calliditas IgA nephropathy' },
  { brand: 'Atrasentan', inn: 'atrasentan', codes: [], peakSales_M: 1500, therapeuticArea: 'nephrology', source: 'Novartis/Chinook IgA nephropathy phase 3' },
  { brand: 'Sibeprenlimab', inn: 'sibeprenlimab', codes: ['VIS649'], peakSales_M: 2500, therapeuticArea: 'nephrology', source: 'Visterra/Otsuka APRIL IgAN phase 3' },

  // ─── Pulmonology ────────────────────────────────────────────────
  { brand: 'Ofev', inn: 'nintedanib', codes: [], peakSales_M: 4500, therapeuticArea: 'pulmonology', source: 'Boehringer 2024 — $4.1B IPF' },
  { brand: 'Esbriet', inn: 'pirfenidone', codes: [], peakSales_M: 1500, therapeuticArea: 'pulmonology', source: 'Roche 2024 — post-generic IPF' },

  // ─── Ophthalmology — more ────────────────────────────────────────
  { brand: 'Beovu', inn: 'brolucizumab', codes: [], peakSales_M: 500, therapeuticArea: 'ophthalmology', source: 'Novartis 2024 — anti-VEGF nAMD (post-safety-signal)' },
  { brand: 'Durysta', inn: 'bimatoprost intracameral', codes: [], peakSales_M: 300, therapeuticArea: 'ophthalmology', source: 'AbbVie 2024' },
  { brand: 'Cequa', inn: 'cyclosporine', codes: [], peakSales_M: 400, therapeuticArea: 'ophthalmology', source: 'Sun dry eye' },
  { brand: 'Miebo', inn: 'perfluorohexyloctane', codes: [], peakSales_M: 800, therapeuticArea: 'ophthalmology', source: 'Bausch dry eye 2024' },
  { brand: 'Xdemvy', inn: 'lotilaner', codes: [], peakSales_M: 600, therapeuticArea: 'ophthalmology', source: 'Tarsus Demodex blepharitis 2024' },
];

// ---------------------------------------------------------------------------
// Lookup logic
// ---------------------------------------------------------------------------

/**
 * Normalize an asset name / headline for matching. Lowercase, strip
 * punctuation, collapse whitespace. Accent-strip via NFD normalization.
 */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a reverse lookup: normalized token → entry. Each entry contributes
 * its brand, INN, and any company-codes as keys. We keep the FIRST match
 * for each key (shouldn't collide in practice because brand+INN+codes are
 * unique across entries).
 */
const LOOKUP: Map<string, AssetPeakSalesEntry> = (() => {
  const m = new Map<string, AssetPeakSalesEntry>();
  for (const e of ASSET_PEAK_SALES_TABLE) {
    const keys = [e.brand, e.inn, ...e.codes];
    for (const k of keys) {
      const n = normalize(k);
      if (n && !m.has(n)) m.set(n, e);
    }
  }
  return m;
})();

/**
 * Resolve asset peak sales from a name or headline.
 *
 * R60b (2026-04-14): Fuzzier matching — word-boundary substring match
 * remains the primary path (so "ada" doesn't match "adalimumab"), but
 * also accepts:
 *   - Token prefix: "DS-8201" matches "DS-8201a" (common for ADC payload
 *     variants like DS-8201a, DS-1062)
 *   - Compound INN with hyphens: "trastuzumab-deruxtecan" normalizes to
 *     "trastuzumab deruxtecan" — existing normalization handles this.
 *
 * Sort keys by length descending so longer specific matches (e.g.,
 * "trastuzumab deruxtecan") beat shorter generic ones (e.g., "trastuzumab")
 * when both appear in the same headline.
 */
const SORTED_KEYS = Array.from(LOOKUP.keys()).sort((a, b) => b.length - a.length);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function lookupAssetPeakSales_M(
  assetName: string | null | undefined,
  headline: string | null | undefined,
): number | null {
  for (const candidate of [assetName, headline]) {
    if (!candidate) continue;
    const norm = normalize(candidate);
    if (!norm) continue;
    for (const key of SORTED_KEYS) {
      const escaped = escapeRegex(key);
      // Word-boundary for natural brand/INN names (e.g., "keytruda",
      // "enhertu"). Allow optional trailing letter/digit suffix when the
      // key looks like a dev code (contains a digit) so "DS-8201" matches
      // "DS-8201a" but "enhertu" doesn't match "enhertu2".
      const hasDigit = /\d/.test(key);
      const re = hasDigit
        ? new RegExp(`(^|\\s)${escaped}[a-z0-9]{0,2}($|\\s)`)
        : new RegExp(`(^|\\s)${escaped}($|\\s)`);
      if (re.test(norm)) {
        const entry = LOOKUP.get(key);
        if (entry) return entry.peakSales_M;
      }
    }
  }
  return null;
}
