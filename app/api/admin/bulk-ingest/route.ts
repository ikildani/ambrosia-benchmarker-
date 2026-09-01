/**
 * Bulk Deal Ingestion API
 *
 * On-demand endpoint to backfill missing deals across all TAs and years.
 * Uses Perplexity for discovery + Claude for extraction + multi-layer dedup.
 *
 * Dedup strategy (precision over recall):
 *   1. Source URL exact match (fastest)
 *   2. Licensor + Licensee + Asset name fuzzy match
 *   3. Licensor + Licensee + Year match (only when no asset name)
 *   4. Unique constraint on DB catches anything else (23505)
 *
 * Usage: POST /api/admin/bulk-ingest
 *   Body: { ta?: string, yearRange?: string, maxQueries?: number }
 *   - No body = run all 2025-2026 queries
 *   - ta + yearRange = run specific gap
 *   - maxQueries = limit concurrent queries (default 6)
 *
 * Auth: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { validateExtractedDeal } from '@/lib/ingestion/deal-extraction-validator';
import { findOrCreateCompany, deriveTherapeuticArea } from '@/lib/ingestion/sec-edgar';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const TIME_BUDGET = 270_000;
const PERPLEXITY_API = 'https://api.perplexity.ai/chat/completions';

// ═══════════════════════════════════════════════════════════════════════
// Target queries — comprehensive by company and TA
// ═══════════════════════════════════════════════════════════════════════

interface BulkQuery {
  id: string;
  ta: string;
  query: string;
}

const BULK_QUERIES: BulkQuery[] = [
  // ═══ 2025-2026: By major pharma company ════════════════════════════
  { id: 'lilly-2025-2026', ta: 'multi', query: 'List EVERY Eli Lilly acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include Scorpion Therapeutics ($2.5B), Centessa ($7.8B), Kelonia ($7B), Ajax ($2.3B), CrossBridge ($300M), Merida ($2.875B), Aktis Oncology ($1.1B), and any others. For EACH deal provide: target company name, asset/drug name, therapeutic area, development phase, upfront payment, milestone payments, total deal value, announced date, and a URL to the press release or SEC filing.' },
  { id: 'pfizer-2025-2026', ta: 'multi', query: 'List EVERY Pfizer acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include Metsera (~$10B obesity), 3SBio ($6B PD-1xVEGF), YaoPharma (oral GLP-1), and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms (upfront, milestones, total value), announced date, and source URL.' },
  { id: 'abbvie-2025-2026', ta: 'multi', query: 'List EVERY AbbVie acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include Capstan ($2.1B in vivo CAR-T), Gilgamesh ($906M psychedelic), RemeGen ($5.6B ADC), Apogee ($10.9B anti-inflammatory), Nimble ($200M oral IL23R), and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'novartis-2025-2026', ta: 'multi', query: 'List EVERY Novartis acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include Monte Rosa ($120M+$5.7B degraders), PeptiDream ($2.7B radiopharm), Myricx Bio (ADC), and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'roche-2025-2026', ta: 'multi', query: 'List EVERY Roche and Genentech acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include 89bio ($3.5B MASH), Zealand Pharma ($5.3B GLP-1/obesity), Manifold Bio ($55M+ biologics), and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'bms-2025-2026', ta: 'multi', query: 'List EVERY Bristol Myers Squibb acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include BioNTech ($11.1B bispecifics), Orbital Therapeutics ($1.5B circular RNA), and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'jnj-2025-2026', ta: 'multi', query: 'List EVERY Johnson & Johnson and Janssen acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include Intra-Cellular Therapies ($14.6B Caplyta), Firefly Bio ($1B), and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'merck-2025-2026', ta: 'multi', query: 'List EVERY Merck acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include Verona Pharma (~$10B ensifentrine COPD), Hengrui ($2B cardiovascular), Terns Pharmaceuticals, and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'sanofi-2025-2026', ta: 'multi', query: 'List EVERY Sanofi acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include Blueprint Medicines ($9.5B rare disease), RadioMedix ($352M radiopharm), and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'astrazeneca-2025-2026', ta: 'multi', query: 'List EVERY AstraZeneca acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include CSPC Pharmaceutical ($18.5B weight-loss), and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'gilead-2025-2026', ta: 'multi', query: 'List EVERY Gilead Sciences acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include Arcellx (~$4B CAR-T myeloma), and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },

  // ═══ 2025-2026: Mid-cap pharma & large biotech ═════════════════════
  { id: 'amgen-2025-2026', ta: 'multi', query: 'List EVERY Amgen acquisition, licensing deal, and collaboration announced in 2025 and 2026 with financial terms. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'regeneron-2025-2026', ta: 'multi', query: 'List EVERY Regeneron acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include Hansoh ($2B GLP-1) and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'vertex-2025-2026', ta: 'multi', query: 'List EVERY Vertex Pharmaceuticals acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include Alpine Immune Sciences and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'biogen-2025-2026', ta: 'multi', query: 'List EVERY Biogen acquisition, licensing deal, and collaboration announced in 2025 and 2026 with financial terms. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'gsk-2025-2026', ta: 'multi', query: 'List EVERY GSK (GlaxoSmithKline) acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include Hengrui multi-program deal and any others. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'bayer-2025-2026', ta: 'multi', query: 'List EVERY Bayer acquisition, licensing deal, and collaboration announced in 2025 and 2026 with financial terms. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'takeda-2025-2026', ta: 'multi', query: 'List EVERY Takeda acquisition, licensing deal, and collaboration announced in 2025 and 2026 with financial terms. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'boehringer-2025-2026', ta: 'multi', query: 'List EVERY Boehringer Ingelheim acquisition, licensing deal, and collaboration announced in 2025 and 2026 with financial terms. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'ipsen-ucb-servier-2025-2026', ta: 'multi', query: 'List EVERY Ipsen, UCB, and Servier acquisition, licensing deal, and collaboration announced in 2025 and 2026 with financial terms. For EACH deal provide: acquirer, target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'astellas-daiichi-2025-2026', ta: 'multi', query: 'List EVERY Astellas Pharma and Daiichi Sankyo acquisition, licensing deal, and collaboration announced in 2025 and 2026. Include all Enhertu-related deals and ADC collaborations. For EACH deal provide: target company, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },

  // ═══ 2025-2026: Biotech-to-biotech & specialty ═════════════════════
  { id: 'biotech-mega-2025-2026', ta: 'multi', query: 'List ALL biotech-to-biotech and mid-cap pharma licensing deals and acquisitions from 2025 and 2026 worth over $500M. Include Genmab/Merus ($8B), Akeso/Summit ($5B ivonescimab), OmniAb/Lilly ($370M), Lantheus/Evergreen ($1B radiopharm), and any others. For EACH deal provide: both company names, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'biotech-mid-2025-2026', ta: 'multi', query: 'List biopharma licensing deals and collaborations announced in 2025 and 2026 with total deal values between $100M and $500M. Include option agreements, co-developments, and research collaborations by mid-size companies. For EACH deal provide: both company names, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },

  // ═══ 2025-2026: By modality ════════════════════════════════════════
  { id: 'adc-deals-2025-2026', ta: 'oncology', query: 'List ALL antibody-drug conjugate (ADC) licensing deals and acquisitions announced in 2025 and 2026 with disclosed financial terms. Include AbbVie/RemeGen, Daiichi Sankyo partnerships, and all other ADC deals. For EACH provide: both companies, drug name, target antigen, indication, phase, financial terms, announced date, and source URL.' },
  { id: 'radiopharm-deals-2024-2026', ta: 'oncology', query: 'List ALL radiopharmaceutical and radioligand therapy licensing deals and acquisitions from 2024, 2025, and 2026. Include Novartis/PeptiDream, Sanofi/RadioMedix, Lantheus/Evergreen, Lilly/Aktis, and all other radiopharm deals. For EACH provide: both companies, drug name, target, indication, phase, financial terms, announced date, and source URL.' },
  { id: 'cell-therapy-deals-2024-2026', ta: 'multi', query: 'List ALL cell therapy (CAR-T, TCR, NK, TIL) and in vivo cell therapy licensing deals and acquisitions from 2024, 2025, and 2026. Include Gilead/Arcellx, AbbVie/Capstan, Lilly/Kelonia, BMS/Orbital, J&J/Firefly, and all others. For EACH provide: both companies, drug name, cell type, target, indication, phase, financial terms, announced date, and source URL.' },
  { id: 'gene-therapy-deals-2024-2026', ta: 'rareDisease', query: 'List ALL gene therapy and gene editing licensing deals and acquisitions from 2024, 2025, and 2026. Include AAV, lentiviral, CRISPR, base editing, and prime editing deals. For EACH provide: both companies, drug name, gene/target, indication, phase, financial terms, announced date, and source URL.' },
  { id: 'obesity-glp1-deals-2024-2026', ta: 'metabolic', query: 'List ALL obesity, GLP-1, GIP, and weight-loss drug licensing deals and acquisitions from 2024, 2025, and 2026. Include Pfizer/Metsera, Roche/Zealand, AZ/CSPC, Regeneron/Hansoh, Pfizer/YaoPharma, and all oral, injectable, and next-gen incretin deals. For EACH provide: both companies, drug name, mechanism, phase, financial terms, announced date, and source URL.' },
  { id: 'mrna-deals-2020-2026', ta: 'multi', query: 'List ALL mRNA therapeutics licensing deals from 2020 to 2026 with disclosed financial terms. Include Moderna, BioNTech, CureVac, Arcturus, Ethris partnerships and collaborations beyond COVID vaccines. Include mRNA oncology, rare disease, and autoimmune deals. For EACH provide: both companies, program, indication, phase, financial terms, announced date, and source URL.' },
  { id: 'bispecific-deals-2023-2026', ta: 'oncology', query: 'List ALL bispecific antibody and T-cell engager licensing deals from 2023, 2024, 2025, and 2026 with disclosed financial terms. Include BMS/BioNTech, Genmab partnerships, Roche bispecific deals, and all TCE/BiTE deals. For EACH provide: both companies, drug name, targets, indication, phase, financial terms, announced date, and source URL.' },
  { id: '505b2-reformulation-2020-2026', ta: 'multi', query: 'List ALL 505(b)(2), reformulation, and lifecycle management licensing deals from 2020 to 2026 with disclosed financial terms. Include novel formulations, extended-release, combination products, and delivery device deals. For EACH provide: both companies, drug name, original product, indication, phase, financial terms, announced date, and source URL.' },

  // ═══ 2024 ══════════════════════════════════════════════════════════
  { id: 'all-major-2024', ta: 'multi', query: 'List the 30 largest biopharma licensing deals and acquisitions announced in 2024 by total deal value. Include all deals over $500M total value. For EACH deal provide: acquirer/licensee company, target/licensor company, asset/drug name, therapeutic area, development phase, deal type (acquisition/license/collaboration), upfront payment, milestone payments, total deal value, royalty information, announced date, and source URL.' },
  { id: 'all-mid-2024', ta: 'multi', query: 'List biopharma licensing deals and collaborations announced in 2024 with total deal values between $100M and $500M. For EACH deal provide: both company names, asset name, therapeutic area, phase, financial terms (upfront, milestones, total value, royalties), announced date, and source URL.' },
  { id: 'all-small-2024', ta: 'multi', query: 'List biopharma licensing deals and collaborations announced in 2024 with total deal values between $20M and $100M. Include option agreements, co-development deals, research collaborations, and regional licensing. For EACH deal provide: both company names, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },

  // ═══ 2023 ══════════════════════════════════════════════════════════
  { id: 'all-major-2023', ta: 'multi', query: 'List the 30 largest biopharma licensing deals and acquisitions announced in 2023 by total deal value. Include Pfizer/Seagen ($43B), AbbVie/ImmunoGen ($10.1B), Bristol Myers/RayzeBio ($4.1B), Bristol Myers/Karuna ($14B), Roche/Telavant ($7.25B), Merck/Prometheus ($10.8B), Amgen/Horizon ($27.8B), AbbVie/Cerevel ($8.7B), Ipsen/Albireo ($1B), Astellas/Iveric Bio ($5.9B). For EACH provide: company names, asset, TA, phase, deal type, financial terms, date, source URL.' },
  { id: 'all-mid-2023', ta: 'multi', query: 'List biopharma licensing deals and collaborations announced in 2023 with total deal values between $100M and $500M. For EACH deal provide: both company names, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },
  { id: 'all-small-2023', ta: 'multi', query: 'List biopharma licensing deals announced in 2023 with total deal values between $20M and $100M including option and co-development deals. For EACH deal provide: both company names, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },

  // ═══ 2022 ══════════════════════════════════════════════════════════
  { id: 'all-major-2022', ta: 'multi', query: 'List the 30 largest biopharma licensing deals and acquisitions announced in 2022 by total deal value. Include Amgen/ChemoCentryx ($3.7B), Pfizer/Biohaven ($11.6B), Pfizer/Global Blood Therapeutics ($5.4B), Pfizer/Arena ($6.7B), GSK/Affinivax ($3.3B), Merck/Imago ($1.35B), AstraZeneca/TeneoTwo ($1.27B), BMS/Turning Point ($4.1B), Sanofi/Amunix ($1B), J&J/Abiomed ($16.6B). For EACH provide: company names, asset, TA, phase, deal type, financial terms, date, source URL.' },
  { id: 'all-mid-2022', ta: 'multi', query: 'List biopharma licensing deals and collaborations announced in 2022 with total deal values between $100M and $1B. For EACH deal provide: both company names, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },

  // ═══ 2021 ══════════════════════════════════════════════════════════
  { id: 'all-major-2021', ta: 'multi', query: 'List the 30 largest biopharma licensing deals and acquisitions announced in 2021 by total deal value. Include AstraZeneca/Alexion ($39B), Merck/Acceleron ($11.5B), Jazz/GW Pharma ($7.2B), Sanofi/Translate Bio ($3.2B), Roche/GenMark ($1.8B), Gilead/MYR GmbH ($1.4B), Pfizer/Trillium ($2.3B), Bayer/Vividion ($2B). For EACH provide: company names, asset, TA, phase, deal type, financial terms, date, source URL.' },
  { id: 'all-mid-2021', ta: 'multi', query: 'List biopharma licensing deals and collaborations announced in 2021 with total deal values between $100M and $1B. For EACH deal provide: both company names, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },

  // ═══ 2020 ══════════════════════════════════════════════════════════
  { id: 'all-major-2020', ta: 'multi', query: 'List the 30 largest biopharma licensing deals and acquisitions announced in 2020 by total deal value. Include Gilead/Immunomedics ($21B), BMS/MyoKardia ($13.1B), Sanofi/Principia ($3.7B), Gilead/Forty Seven ($4.9B), Merck/VelosBio ($2.75B). Include COVID deals: Pfizer/BioNTech, Moderna/Lonza. For EACH provide: company names, asset, TA, phase, deal type, financial terms, date, source URL.' },
  { id: 'all-mid-2020', ta: 'multi', query: 'List biopharma licensing deals and collaborations announced in 2020 with total deal values between $100M and $1B. Include COVID-19 and non-COVID deals. For EACH deal provide: both company names, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },

  // ═══ 2019 ══════════════════════════════════════════════════════════
  { id: 'all-major-2019', ta: 'multi', query: 'List the 30 largest biopharma licensing deals and acquisitions announced in 2019 by total deal value. Include BMS/Celgene ($74B), AbbVie/Allergan ($63B), Roche/Spark ($4.3B), Pfizer/Array ($11.4B), Novartis/Medicines Company ($9.7B), Merck/ArQule ($2.7B), AZ/Daiichi Sankyo ($6.9B Enhertu), Amgen/Otezla ($13.4B), Sanofi/Synthorx ($2.5B), Gilead/Galapagos ($5.1B). For EACH provide: company names, asset, TA, phase, deal type, financial terms, date, source URL.' },
  { id: 'all-mid-2019', ta: 'multi', query: 'List biopharma licensing deals and collaborations announced in 2019 with total deal values between $100M and $1B. For EACH deal provide: both company names, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },

  // ═══ 2018 ══════════════════════════════════════════════════════════
  { id: 'all-major-2018', ta: 'multi', query: 'List the 30 largest biopharma licensing deals and acquisitions announced in 2018 by total deal value. Include Takeda/Shire ($62B), Sanofi/Ablynx ($4.8B), Sanofi/Bioverativ ($11.6B), Celgene/Juno ($9B), Celgene/Impact ($7B), Novartis/AveXis ($8.7B), Roche/Foundation Medicine ($2.4B), GSK/Tesaro ($5.1B), Lilly/Armo ($1.6B). For EACH provide: company names, asset, TA, phase, deal type, financial terms, date, source URL.' },
  { id: 'all-mid-2018', ta: 'multi', query: 'List biopharma licensing deals and collaborations announced in 2018 with total deal values between $100M and $1B. For EACH deal provide: both company names, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },

  // ═══ 2017 ══════════════════════════════════════════════════════════
  { id: 'all-major-2017', ta: 'multi', query: 'List the 30 largest biopharma licensing deals and acquisitions announced in 2017 by total deal value. Include J&J/Actelion ($30B), Gilead/Kite ($11.9B), Takeda/Ariad ($5.2B), BMS/IFM ($2.3B). For EACH provide: company names, asset, TA, phase, deal type, financial terms, date, source URL.' },
  { id: 'all-mid-2017', ta: 'multi', query: 'List biopharma licensing deals and collaborations announced in 2017 with total deal values between $100M and $1B. For EACH deal provide: both company names, asset name, therapeutic area, phase, financial terms, announced date, and source URL.' },

  // ═══ Cross-border deals ════════════════════════════════════════════
  { id: 'china-2024-2026', ta: 'multi', query: 'List ALL China biotech out-licensing deals to US and European pharma companies from 2024, 2025, and 2026. Include ADC, bispecific, small molecule, cell therapy out-licensing from BeiGene, Hengrui, CSPC, 3SBio, Akeso, Innovent, Legend, RemeGen, WuXi, Harbour BioMed, and all others. For EACH deal provide: Chinese company, Western partner, asset name, therapeutic area, financial terms, and source URL.' },
  { id: 'china-2020-2023', ta: 'multi', query: 'List ALL China biotech out-licensing deals to US and European pharma from 2020 to 2023. Include Legend/J&J CARVYKTI, BeiGene/Novartis tislelizumab, Zymeworks partnerships, Innovent/Lilly deals, and all others. For EACH provide: Chinese company, Western partner, asset name, TA, financial terms, and source URL.' },
  { id: 'china-2017-2019', ta: 'multi', query: 'List ALL China biotech out-licensing deals to US and European pharma from 2017 to 2019. Include early deals by BeiGene, Zai Lab, Hutchmed, CStone. For EACH provide: Chinese company, Western partner, asset name, TA, financial terms, and source URL.' },
  { id: 'japan-korea-2020-2026', ta: 'multi', query: 'List ALL Japanese and Korean biotech/pharma out-licensing deals to US and European companies from 2020 to 2026. Include Daiichi Sankyo, Takeda, Astellas, Shionogi, Eisai, Samsung Bioepis, Celltrion, SK Life Science, Yuhan partnerships. For EACH provide: Asian company, Western partner, asset name, TA, financial terms, and source URL.' },
  { id: 'israel-2020-2026', ta: 'multi', query: 'List ALL Israeli biotech out-licensing deals and acquisitions from 2020 to 2026 with disclosed financial terms. Include Teva, Check-Cap, Compugen, Kamada, BioLineRx, MediWound, Plurilock, Can-Fite, Taro partnerships. For EACH provide: Israeli company, partner, asset name, TA, financial terms, and source URL.' },

  // ═══ By deal type (gap-specific) ═══════════════════════════════════
  { id: 'option-deals-2020-2026', ta: 'multi', query: 'List ALL biopharma option agreement deals from 2020 to 2026 with disclosed financial terms. Option deals include opt-in/opt-out rights, exclusive negotiation rights, and first-refusal rights. For EACH provide: both companies, asset name, option terms, exercise conditions, TA, phase, financial terms, and source URL.' },
  { id: 'codev-deals-2020-2026', ta: 'multi', query: 'List ALL biopharma co-development and profit-sharing deals from 2020 to 2026 with disclosed financial terms. Include cost-sharing ratios, profit splits, and co-commercialization agreements. For EACH provide: both companies, asset name, cost/profit split terms, TA, phase, financial terms, and source URL.' },
  { id: 'research-collab-2022-2026', ta: 'multi', query: 'List ALL biopharma multi-target research collaborations from 2022 to 2026 with disclosed financial terms over $100M. Include platform deals, multi-program alliances, and discovery collaborations. For EACH provide: both companies, platform/program description, TA, financial terms (upfront, per-target milestones, total potential), and source URL.' },
];

// ═══════════════════════════════════════════════════════════════════════
// Perplexity + Claude extraction (same as historical-backfill)
// ═══════════════════════════════════════════════════════════════════════

async function queryPerplexity(query: string, apiKey: string): Promise<string> {
  const response = await fetchWithTimeout(PERPLEXITY_API, {
    timeoutMs: 60_000,
    retries: 1,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{ role: 'user', content: query }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Perplexity ${response.status}: ${body.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

interface ExtractedDeal {
  licensor: string;
  licensee: string;
  asset_name: string | null;
  deal_type: string;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  milestones_development_usd: number | null;
  milestones_regulatory_usd: number | null;
  milestones_commercial_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  indication_category: string | null;
  indication_specific: string | null;
  modality: string;
  phase_at_signing: string;
  territory: string;
  announced_date: string;
  source_url: string;
  confidence: number;
}

async function extractDeals(text: string, queryId: string, anthropicApiKey: string): Promise<ExtractedDeal[]> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey, timeout: 120_000 });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 16000,
    system: `You are an expert biopharma deal data extractor. Extract ONLY deals explicitly mentioned in the provided text with verifiable details.

RULES:
1. NEVER fabricate deals. Only extract what is explicitly stated.
2. NEVER fabricate financial terms. Use null for unknown values.
3. Every deal MUST have a source_url. Omit deals without one.
4. For acquisitions: the acquired company is the licensor, the acquirer is the licensee.
5. Convert all financial values to USD (full dollars, not millions). Example: $2.5 billion = 2500000000.
6. Royalties as decimals: 10% = 0.10.
7. If upfront vs milestones breakdown isn't clear but total is known, put total in total_deal_value_usd and leave upfront/milestones as null.

INDICATION CATEGORIES: solid_tumor, hematological, autoimmune, cns, cardiovascular, infectious, metabolic, rare_disease, respiratory, dermatology, ophthalmology, reproductive, other
MODALITIES: smallMolecule, antibody, adc, bispecific, car_t, cell_therapy, gene_therapy, mrna, radiopharm, peptide, oligonucleotide, vaccine, other
PHASES: discovery, preclinical, phase_1, phase_2, phase_3, approved, unknown
DEAL TYPES: license, option, collaboration, acquisition, co_development, other
TERRITORIES: global, us, ex_us, ex_china, greater_china, japan, europe, other`,
    messages: [{
      role: 'user',
      content: `Extract ALL biopharma deals from this text. Return ONLY a JSON array of deal objects.

Each deal object:
{
  "licensor": "company granting rights / being acquired",
  "licensee": "company receiving rights / acquirer",
  "asset_name": "drug/compound name or null",
  "deal_type": "license|option|collaboration|acquisition|co_development|other",
  "upfront_usd": number or null,
  "milestones_total_usd": number or null,
  "milestones_development_usd": number or null,
  "milestones_regulatory_usd": number or null,
  "milestones_commercial_usd": number or null,
  "total_deal_value_usd": number or null,
  "royalty_low_pct": decimal or null,
  "royalty_high_pct": decimal or null,
  "indication_category": "one of the categories",
  "indication_specific": "specific disease name or null",
  "modality": "one of the modalities",
  "phase_at_signing": "one of the phases",
  "territory": "one of the territories",
  "announced_date": "YYYY-MM-DD",
  "source_url": "URL to press release or article (REQUIRED)",
  "confidence": 75-95
}

Return [] if no verifiable deals found. Text:\n${text.substring(0, 15000)}`
    }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    console.log(`[bulk-ingest] ${queryId}: No text block in Claude response`);
    return [];
  }

  let raw = textBlock.text;
  // Strip markdown code fences
  raw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.log(`[bulk-ingest] ${queryId}: No JSON array found in Claude response (${raw.length} chars). First 200: ${raw.substring(0, 200)}`);
    return [];
  }

  try {
    const deals = JSON.parse(jsonMatch[0]) as ExtractedDeal[];
    console.log(`[bulk-ingest] ${queryId}: Parsed ${deals.length} deals from Claude`);
    return deals;
  } catch (err) {
    console.log(`[bulk-ingest] ${queryId}: JSON parse failed: ${String(err).substring(0, 100)}`);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Smart dedup — checks source URL, then asset+companies, then year+companies
// ═══════════════════════════════════════════════════════════════════════

async function isDuplicate(
  supabase: ReturnType<typeof createServiceClient>,
  deal: ExtractedDeal
): Promise<boolean> {
  // Layer 1: exact source URL match
  if (deal.source_url) {
    const { data: byUrl } = await supabase
      .from('deals')
      .select('id')
      .eq('source_url', deal.source_url)
      .limit(1)
      .maybeSingle();
    if (byUrl) return true;
  }

  // Layer 2: licensor + licensee + asset name
  if (deal.asset_name?.trim()) {
    const assetToken = deal.asset_name.substring(0, 20);
    const { data: byAsset } = await supabase
      .from('deals')
      .select('id')
      .ilike('licensor_name', `%${deal.licensor.substring(0, 15)}%`)
      .ilike('licensee_name', `%${deal.licensee.substring(0, 15)}%`)
      .ilike('asset_name', `%${assetToken}%`)
      .limit(1)
      .maybeSingle();
    if (byAsset) return true;
  }

  // Layer 3: same companies + same year (only if no asset name to match on)
  if (!deal.asset_name?.trim() && deal.announced_date?.length >= 4) {
    const year = deal.announced_date.substring(0, 4);
    const { data: byYear } = await supabase
      .from('deals')
      .select('id')
      .ilike('licensor_name', `%${deal.licensor.substring(0, 15)}%`)
      .ilike('licensee_name', `%${deal.licensee.substring(0, 15)}%`)
      .gte('announced_date', `${year}-01-01`)
      .lte('announced_date', `${year}-12-31`)
      .limit(1)
      .maybeSingle();
    if (byYear) return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════
// Route handler
// ═══════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!perplexityApiKey || !anthropicApiKey) {
    return NextResponse.json({ error: 'PERPLEXITY_API_KEY or ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const targetId = body.queryId as string | undefined;
  const maxQueries = Math.min(body.maxQueries || 6, 15);

  const supabase = createServiceClient();
  const startTime = Date.now();

  const queries = targetId
    ? BULK_QUERIES.filter(q => q.id === targetId)
    : BULK_QUERIES.slice(0, maxQueries);

  if (queries.length === 0) {
    return NextResponse.json({ error: `No query found for id: ${targetId}` }, { status: 400 });
  }

  const result = {
    queries_run: 0,
    debug: [] as string[],
    deals_discovered: 0,
    deals_deduplicated: 0,
    deals_validated: 0,
    deals_inserted: 0,
    deals_by_query: {} as Record<string, { discovered: number; inserted: number; dupes: number }>,
    errors: [] as string[],
  };

  for (const query of queries) {
    if (Date.now() - startTime > TIME_BUDGET) break;

    const qResult = { discovered: 0, inserted: 0, dupes: 0 };
    result.deals_by_query[query.id] = qResult;

    try {
      console.log(`[bulk-ingest] Running: ${query.id}`);

      // Step 1: Perplexity discovery
      const searchText = await queryPerplexity(query.query, perplexityApiKey);
      result.queries_run++;

      result.debug.push(`${query.id}: perplexity=${searchText.length} chars`);

      if (!searchText || searchText.length < 100) {
        result.errors.push(`${query.id}: empty Perplexity response`);
        continue;
      }

      // Step 2: Claude extraction
      const deals = await extractDeals(searchText, query.id, anthropicApiKey);
      result.debug.push(`${query.id}: claude extracted ${deals.length} deals`);
      qResult.discovered = deals.length;
      result.deals_discovered += deals.length;
      console.log(`[bulk-ingest] ${query.id}: ${deals.length} deals extracted`);

      // Step 3: Process each deal
      for (const deal of deals) {
        if (Date.now() - startTime > TIME_BUDGET) break;

        // Validate required fields
        if (!deal.licensor?.trim() || !deal.licensee?.trim()) continue;
        if (!deal.source_url?.trim()) continue;

        // Validator
        const validation = validateExtractedDeal({
          licensor: deal.licensor,
          licensee: deal.licensee,
          modality: deal.modality || 'other',
          asset_name: deal.asset_name,
          indication_specific: deal.indication_specific,
          upfront_usd: deal.upfront_usd,
          total_deal_value_usd: deal.total_deal_value_usd,
          confidence_score: deal.confidence,
          source_url: deal.source_url,
        });

        if (!validation.valid) {
          result.errors.push(`${query.id}: rejected ${deal.licensor}→${deal.licensee} (${validation.rejectCode})`);
          continue;
        }
        result.deals_validated++;

        // Smart dedup
        const dupe = await isDuplicate(supabase, deal);
        if (dupe) {
          qResult.dupes++;
          result.deals_deduplicated++;
          continue;
        }

        // Normalize date
        let announcedDate = deal.announced_date;
        if (announcedDate?.length === 4) announcedDate += '-06-15';
        if (announcedDate?.length === 7) announcedDate += '-15';

        // Derive TA
        const ta = deriveTherapeuticArea(deal.indication_category);

        // Find or create companies
        const licensorId = await findOrCreateCompany(supabase, deal.licensor, false).catch(() => null);
        const licenseeId = await findOrCreateCompany(supabase, deal.licensee, true).catch(() => null);

        // Sanitize asset name — clear fabrication patterns that hit the DB constraint
        let safeAssetName = deal.asset_name?.trim() || null;
        if (safeAssetName) {
          const isFab = /^[A-Za-z0-9/]+-[0-9]{3}$/.test(safeAssetName)
            || (/^[A-Za-z0-9/-]+-mab$/.test(safeAssetName) && !/^anti-/i.test(safeAssetName))
            || /^Anti-[A-Za-z0-9]+(-mab)?$/.test(safeAssetName);
          if (isFab) safeAssetName = null;
        }

        // Insert
        const { error: insertError } = await supabase.from('deals').insert({
          licensor_name: deal.licensor,
          licensee_name: deal.licensee,
          licensor_id: licensorId,
          licensee_id: licenseeId,
          asset_name: safeAssetName,
          asset_description: deal.indication_specific || null,
          modality: deal.modality || 'other',
          indication_category: deal.indication_category,
          indication_specific: deal.indication_specific,
          phase_at_signing: deal.phase_at_signing || 'unknown',
          territory: deal.territory || 'global',
          deal_type: deal.deal_type || 'license',
          upfront_usd: deal.upfront_usd,
          milestones_total_usd: deal.milestones_total_usd,
          milestones_development_usd: deal.milestones_development_usd,
          milestones_regulatory_usd: deal.milestones_regulatory_usd,
          milestones_commercial_usd: deal.milestones_commercial_usd,
          royalty_low_pct: deal.royalty_low_pct,
          royalty_high_pct: deal.royalty_high_pct,
          total_deal_value_usd: deal.total_deal_value_usd,
          announced_date: announcedDate,
          source_type: 'manual',
          source_url: deal.source_url,
          terms_disclosed: (deal.upfront_usd !== null) || (deal.total_deal_value_usd !== null) || (deal.milestones_total_usd !== null),
          confidence_score: deal.confidence,
          verification_status: 'pending',
          extraction_notes: `Bulk backfill via ${query.id}`,
          extraction_model: 'perplexity+claude-opus-4-6',
          extraction_timestamp: new Date().toISOString(),
          therapeutic_area: ta === 'other' ? (query.ta !== 'multi' ? query.ta : 'other') : ta,
        });

        if (insertError?.code === '23505') {
          qResult.dupes++;
          result.deals_deduplicated++;
        } else if (!insertError) {
          qResult.inserted++;
          result.deals_inserted++;
          console.log(`[bulk-ingest] + ${deal.licensor} → ${deal.licensee} (${deal.asset_name || deal.deal_type}) ${deal.total_deal_value_usd ? `$${(deal.total_deal_value_usd / 1e6).toFixed(0)}M` : ''}`);
        } else {
          result.errors.push(`${query.id}: DB error ${deal.licensor}→${deal.licensee}: ${insertError.message}`);
        }
      }

      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      result.errors.push(`${query.id}: ${String(err).substring(0, 200)}`);
    }
  }

  // Log the run
  await supabase.from('data_ingestion_log').insert({
    source: 'bulk_ingest',
    run_type: 'manual',
    parameters: { queries: queries.map(q => q.id), maxQueries },
    records_fetched: result.deals_discovered,
    records_processed: result.deals_validated,
    records_inserted: result.deals_inserted,
    records_failed: result.errors.length,
    errors: result.errors.slice(0, 100),
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[bulk-ingest] Done in ${elapsed}s: ${result.queries_run} queries, ${result.deals_discovered} found, ${result.deals_deduplicated} dupes, ${result.deals_inserted} inserted`);

  return NextResponse.json({ success: true, elapsed_seconds: elapsed, ...result });
}
