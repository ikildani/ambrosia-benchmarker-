/**
 * Indication-level typical-asset peak sales consensus estimates.
 *
 * Fills the gap where INDICATION_MARKET_CAPS entries are missing
 * `typicalAssetPeakSales_M`. The engine uses these as the default
 * peak sales input when the user doesn't override — so getting these
 * right is the single biggest accuracy lever.
 *
 * Each estimate is the TYPICAL (not blockbuster) single-asset peak
 * for a new entrant in the indication, based on:
 *   - Market leader precedent (10-K actual revenue)
 *   - Class structure (how many drugs share the market)
 *   - Analyst consensus where publicly available
 *
 * Sources cited per entry. All values in $M USD.
 *
 * @module lib/financial/indication-peak-consensus
 */

export const INDICATION_PEAK_CONSENSUS: Record<string, {
  typicalAssetPeakSales_M: number;
  source: string;
}> = {
  // ── Oncology ──
  lung_nsclc: {
    typicalAssetPeakSales_M: 3000,
    source: 'Non-Keytruda NSCLC: Opdivo $5B, Alecensa $3B, Tagrisso $6B — typical new entrant $2-4B (AZ/BMS/Roche 2024 10-Ks)',
  },
  breast_her2: {
    typicalAssetPeakSales_M: 3000,
    source: 'Non-Enhertu: Phesgo $3B, Tukysa $1B, Kadcyla $2.4B — typical HER2 asset $2-4B (AZ/Daiichi/Roche 2024 10-Ks)',
  },
  breast_tnbc: {
    typicalAssetPeakSales_M: 1000,
    source: 'Trodelvy $1.3B, Keytruda-TNBC allocation — typical TNBC $800M-1.2B (Gilead 2024 10-K)',
  },
  melanoma: {
    typicalAssetPeakSales_M: 1500,
    source: 'Opdivo-Yervoy combo $2B, Tafinlar $1B — typical $1-2B (BMS/Novartis 2024 10-Ks)',
  },
  colorectal: {
    typicalAssetPeakSales_M: 1200,
    source: 'Stivarga, Lonsurf all <$2B — typical CRC $800M-1.5B (Bayer/Servier 2024)',
  },
  prostate: {
    typicalAssetPeakSales_M: 2000,
    source: 'Xtandi $5B, Erleada $2.5B, Nubeqa $2B — typical $1.5-2.5B (Astellas/J&J/Bayer 2024)',
  },
  pancreatic: {
    typicalAssetPeakSales_M: 500,
    source: 'Onivyde $600M, Lynparza-BRCA slice — tough market, typical $300-700M (Ipsen/AZ 2024)',
  },
  ovarian: {
    typicalAssetPeakSales_M: 1000,
    source: 'Lynparza $2.5B, Zejula $1B, Rubraca $500M — typical $800M-1.2B (AZ/GSK 2024)',
  },
  head_neck: {
    typicalAssetPeakSales_M: 800,
    source: 'Keytruda HN $1.5B, Erbitux declining — niche, typical $500M-1B (Merck 2024)',
  },
  dlbcl: {
    typicalAssetPeakSales_M: 1500,
    source: 'Polivy $2B, CAR-T $1B class — typical heme-onc $1-2B (Roche/Gilead/BMS 2024)',
  },
  aml: {
    typicalAssetPeakSales_M: 800,
    source: 'Venetoclax-AML $2B, Onureg $500M — typical $500M-1B (AbbVie/BMS 2024)',
  },

  // ── Neurology ──
  alzheimers: {
    typicalAssetPeakSales_M: 2000,
    source: 'Leqembi ramping $3-4B, donanemab $3B — typical amyloid $1.5-2.5B (Eisai/Lilly 2024)',
  },
  parkinsons: {
    typicalAssetPeakSales_M: 800,
    source: 'Nuplazid $800M, Ongentys $300M — fragmented, typical $500M-1B (Acadia 2024)',
  },
  epilepsy: {
    typicalAssetPeakSales_M: 1000,
    source: 'Briviact $700M, cenobamate $1B — typical $700M-1.2B (UCB/SK 2024)',
  },
  depression: {
    typicalAssetPeakSales_M: 1500,
    source: 'Rexulti $2.5B, Auvelity $1B, Spravato $1.5B — typical $1-2B (Otsuka/Axsome/J&J 2024)',
  },
  migraine: {
    typicalAssetPeakSales_M: 1000,
    source: 'Aimovig $600M, Emgality $800M, Ubrelvy $1B — CGRP class $500M-1.2B (Amgen/Lilly 2024)',
  },
  schizophrenia: {
    typicalAssetPeakSales_M: 2000,
    source: 'Cobenfy projected $4-6B, Caplyta $1.5B — typical $1.5-2.5B (BMS/Intra-Cellular 2024-25)',
  },
  als: {
    typicalAssetPeakSales_M: 300,
    source: 'Radicava $400M, Relyvrio withdrawn — small market, typical $200-400M (MT Pharma 2024)',
  },
  huntingtons: {
    typicalAssetPeakSales_M: 300,
    source: 'No approved DMT — Tominersen failed. Typical $200-400M if approved (Roche/CHDI 2024)',
  },

  // ── Immunology ──
  asthma: {
    typicalAssetPeakSales_M: 3000,
    source: 'Dupixent-asthma $3B, Fasenra $2B, Nucala $2B — typical biologic $2-4B (Sanofi/AZ/GSK 2024)',
  },
  psoriasis: {
    typicalAssetPeakSales_M: 3000,
    source: 'Skyrizi $5B, Tremfya $3B, Bimzelx $2B — typical IL-23/17 $2-4B (AbbVie/J&J/UCB 2024)',
  },
  lupus: {
    typicalAssetPeakSales_M: 800,
    source: 'Benlysta $1.5B near-monopoly — typical lupus asset $500M-1B (GSK 2024)',
  },
  ibd_cd: {
    typicalAssetPeakSales_M: 2000,
    source: 'Skyrizi-Crohns $2B, Stelara declining, Entyvio $4B — typical $1.5-2.5B (AbbVie/Takeda 2024)',
  },
  ibd_uc: {
    typicalAssetPeakSales_M: 1500,
    source: 'Entyvio UC slice, Zeposia $500M — typical UC $1-2B (Takeda/BMS 2024)',
  },

  // ── Cardiovascular ──
  heart_failure: {
    typicalAssetPeakSales_M: 2000,
    source: 'Entresto $7B, Farxiga-HF $2B, Verquvo $500M — typical $1.5-2.5B (Novartis/AZ 2024)',
  },
  atrial_fibrillation: {
    typicalAssetPeakSales_M: 2000,
    source: 'Eliquis $10B (AF-driven), Xarelto declining — typical AF $1.5-3B (BMS-Pfizer/Bayer 2024)',
  },
  hypercholesterolemia: {
    typicalAssetPeakSales_M: 1500,
    source: 'Repatha $2B, Leqvio $1B — typical lipid $1-2B (Amgen/Novartis 2024)',
  },
  atherosclerosis: {
    typicalAssetPeakSales_M: 2000,
    source: 'Repatha/Leqvio CV-outcomes — typical ASCVD $1.5-2.5B (Amgen/Novartis 2024)',
  },

  // ── Metabolic ──
  nash_mash: {
    typicalAssetPeakSales_M: 2000,
    source: 'Rezdiffra first-to-market $3-5B projected — typical MASH $1.5-2.5B (Madrigal 2024-25)',
  },
  dyslipidemia: {
    typicalAssetPeakSales_M: 1500,
    source: 'PCSK9 class Repatha/Leqvio — typical $1-2B (Amgen/Novartis 2024)',
  },
  cardiometabolic: {
    typicalAssetPeakSales_M: 2000,
    source: 'Non-GLP-1 cardiometabolic: Farxiga/Jardiance $8B each — typical $1.5-2.5B (AZ/Lilly 2024)',
  },

  // ── Infectious Disease ──
  hepatitis_b: {
    typicalAssetPeakSales_M: 800,
    source: 'Vemlidy $1.5B, Viread declining — cure elusive, typical $500M-1B (Gilead/GSK 2024)',
  },
  bacterial_infection: {
    typicalAssetPeakSales_M: 500,
    source: 'Zerbaxa $500M, Fetroja $200M — stewardship pricing, typical $300-600M (Merck/Shionogi 2024)',
  },

  // ── Ophthalmology ──
  dry_eye: {
    typicalAssetPeakSales_M: 500,
    source: 'Restasis generic, Xiidra $500M — typical $300-600M (AbbVie/Novartis 2024)',
  },

  // ── Rare Disease ──
  sma: {
    typicalAssetPeakSales_M: 1500,
    source: 'Spinraza $1.5B, Zolgensma $1.5B — typical SMA $1-2B (Biogen/Novartis 2024)',
  },
  dmd: {
    typicalAssetPeakSales_M: 700,
    source: 'Exondys $700M, Elevidys $1B — typical DMD $500M-1B (Sarepta 2024)',
  },
  hae: {
    typicalAssetPeakSales_M: 600,
    source: 'Takhzyro $1.5B, Haegarda $500M — typical HAE $400-800M (Takeda/CSL 2024)',
  },
  friedreichs_ataxia: {
    typicalAssetPeakSales_M: 200,
    source: 'Skyclarys $300M projected — very rare, typical $150-250M (Biogen 2024)',
  },
  spinal_cord_injury: {
    typicalAssetPeakSales_M: 200,
    source: 'No approved therapies — preclinical space, typical $100-300M if approved',
  },
  wilson_disease: {
    typicalAssetPeakSales_M: 150,
    source: 'Syprine niche — ultra-rare, typical $100-200M',
  },
};
