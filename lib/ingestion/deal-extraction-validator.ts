/**
 * Shared validator for LLM-extracted biopharma deals.
 *
 * Applied post-extraction, pre-DB-insert by every ingestion pipeline
 * (sec-edgar, press-releases, perplexity-deals) to catch hallucinated
 * fields before they pollute the deals table.
 *
 * Background (Phase 1 audit, 2026-04-14): audit of 2,050 unverified LLM-
 * extracted rows found ~475 fabricated entries across three patterns:
 *
 *   1. Asset-modality suffix mismatch (314 rows): asset ending -mab but
 *      modality tagged as small_molecule or rnai; asset ending -tinib
 *      but modality tagged cell_therapy; Anti-TARGET prefix but non-
 *      antibody modality.
 *
 *   2. Placeholder asset codes (49 rows): TARGET-NNN pattern like
 *      "KRAS G12C-301" with no matching source URL (real dev codes
 *      look like "KT-253", "TUB-040", "ABBV-383" — alphanumeric company
 *      prefix, not a target name).
 *
 *   3. Licensor-modality mismatch (77 rows): known companies with
 *      established single-platform pipelines tagged with incompatible
 *      modalities (e.g., Arrowhead tagged mAb when they're RNAi-only;
 *      Intellia tagged mAb when they're CRISPR gene-editing).
 *
 * This validator catches all three patterns at ingestion time so future
 * cron runs do not re-introduce fabrications.
 *
 * @module lib/ingestion/deal-extraction-validator
 */

/** Normalized "extracted deal" shape accepted by the validator. */
export interface ValidatableDeal {
  licensor?: string | null;
  licensee?: string | null;
  modality?: string | null;
  asset_name?: string | null;
  indication_specific?: string | null;
  upfront_usd?: number | null;
  total_deal_value_usd?: number | null;
  confidence_score?: number | null;
  source_url?: string | null;
  source_filing_id?: string | null;
}

export interface ValidationResult {
  valid: boolean;
  /** When valid=false, a machine-readable reason code */
  rejectCode?:
    | 'suffix_modality_mismatch'
    | 'placeholder_asset_pattern'
    | 'licensor_modality_mismatch'
    | 'missing_critical_field'
    | 'confidence_below_threshold';
  /** Human-readable explanation for audit trail */
  rejectReason?: string;
}

// ---------------------------------------------------------------------------
// Licensor primary-modality lookup
// ---------------------------------------------------------------------------
//
// Companies with a well-established single-platform pipeline. Ingestion
// rejects any deal that tags these licensors with a modality outside their
// known set. Extendable: add rows here as new specialist companies are
// identified (e.g., via manual audit of future pending queue).

export const LICENSOR_PRIMARY_MODALITIES: Record<string, readonly string[]> = {
  // Radiopharmaceutical / antibody pediatric oncology
  'Y-mAbs Therapeutics': ['mab', 'antibody', 'bispecific', 'adc', 'radiopharm', 'radiopharmaceutical'],
  // Molecular glue / protein degrader (small-mol platform)
  'Monte Rosa Therapeutics': ['small_molecule', 'smallMolecule', 'protac'],
  // CAR-T platform (integrated vector + manufacturing)
  'Umoja Biopharma': ['cell_therapy', 'cellTherapy', 'car_t', 'carT_heme', 'carT_solid', 'carT_autoimmune'],
  // RNAi (Alnylam spinout heritage)
  'Arrowhead Pharmaceuticals': ['rnai', 'oligonucleotide'],
  // Allosteric small molecules (motion-based drug design)
  'Relay Therapeutics': ['small_molecule', 'smallMolecule', 'protac'],
  // FGFR-family small molecules
  'Tyra Biosciences': ['small_molecule', 'smallMolecule'],
  // CRISPR gene editing
  'Intellia Therapeutics': ['gene_therapy', 'geneTherapy', 'crispr_base_editing', 'crispr_prime_editing', 'geneEditing'],
  // TCR-based bispecifics
  'Immunocore': ['bispecific', 'bispecificAntibody', 'tce_gpcr', 'tce_bcma', 'tce_cd20'],
  // TIL / cell therapy
  'Iovance Biotherapeutics': ['cell_therapy', 'cellTherapy', 'til_therapy'],
  'G1 Therapeutics': ['small_molecule', 'smallMolecule'],
  'Mirati Therapeutics': ['small_molecule', 'smallMolecule'],
  'Alphamab Oncology': ['mab', 'antibody', 'bispecific', 'bispecificAntibody', 'adc'],
  'Fate Therapeutics': ['cell_therapy', 'cellTherapy', 'car_t', 'carT_heme'],
  'Affimed': ['bispecific', 'bispecificAntibody', 'mab', 'antibody'],
  'Celldex Therapeutics': ['mab', 'antibody'],
  'IGM Biosciences': ['mab', 'antibody', 'bispecific'],
  'Elevation Oncology': ['mab', 'antibody', 'adc'],
  'Beam Therapeutics': ['gene_therapy', 'geneTherapy', 'crispr_base_editing', 'crispr_prime_editing', 'geneEditing'],
  'Karyopharm Therapeutics': ['small_molecule', 'smallMolecule'],
  'PMV Pharmaceuticals': ['small_molecule', 'smallMolecule'],
  'Verve Therapeutics': ['gene_therapy', 'geneTherapy', 'crispr_base_editing', 'geneEditing'],
  'Vigil Neuroscience': ['mab', 'antibody'],
  'ORIC Pharmaceuticals': ['small_molecule', 'smallMolecule'],
  'Roivant Sciences': ['mab', 'antibody', 'small_molecule', 'smallMolecule'],
  'Ideaya Biosciences': ['small_molecule', 'smallMolecule'],
  'Nuvation Bio': ['small_molecule', 'smallMolecule'],
  'Hookipa Pharma': ['vaccine', 'vaccinePreventive', 'mrna'],
  'CytomX Therapeutics': ['mab', 'antibody', 'bispecific', 'adc'],
  'Blueprint Medicines': ['small_molecule', 'smallMolecule'],
  'Stoke Therapeutics': ['oligonucleotide', 'aso', 'rnai'],
  // Additional known specialist licensors (extend as audits discover more)
  'Kymera Therapeutics': ['small_molecule', 'smallMolecule', 'protac'],
  'Arvinas': ['small_molecule', 'smallMolecule', 'protac'],
  'Moderna': ['mrna', 'vaccine', 'vaccinePreventive'],
  'BioNTech': ['mrna', 'vaccine', 'adc'],
  'Alnylam Pharmaceuticals': ['rnai', 'oligonucleotide'],
  'Ionis Pharmaceuticals': ['oligonucleotide', 'aso', 'rnai'],
  'CRISPR Therapeutics': ['gene_therapy', 'geneTherapy', 'crispr_base_editing', 'crispr_prime_editing', 'geneEditing'],
  'Editas Medicine': ['gene_therapy', 'geneTherapy', 'crispr_base_editing', 'geneEditing'],
  'Sangamo Therapeutics': ['gene_therapy', 'geneTherapy', 'geneEditing'],
  'Bluebird Bio': ['gene_therapy', 'geneTherapy'],
  'Sana Biotechnology': ['gene_therapy', 'geneTherapy', 'cell_therapy', 'cellTherapy'],
};

// ---------------------------------------------------------------------------
// Modality-asset-suffix consistency rules
// ---------------------------------------------------------------------------
//
// WHO INN suffix classes map to modality categories. If asset suffix and
// tagged modality conflict, the extraction is almost certainly fabricated.

interface SuffixRule {
  pattern: RegExp;
  allowedModalities: readonly string[];
}

const SUFFIX_RULES: SuffixRule[] = [
  {
    pattern: /-mab$/i,
    allowedModalities: ['mab', 'antibody', 'bispecific', 'bispecificAntibody', 'adc'],
  },
  {
    pattern: /(-tinib|-ciclib|-parib|-rafenib|-lisib|-ciclib)$/i,
    allowedModalities: ['small_molecule', 'smallMolecule', 'protac'],
  },
  {
    pattern: /-nib$/i,
    allowedModalities: ['small_molecule', 'smallMolecule', 'protac'],
  },
  {
    pattern: /-tide$/i,
    allowedModalities: ['peptide'],
  },
  {
    pattern: /(-sen|-rsen|-mer|-siran)$/i,
    allowedModalities: ['oligonucleotide', 'aso', 'rnai', 'mrna'],
  },
  {
    pattern: /^Anti-[A-Za-z0-9]/,
    allowedModalities: ['mab', 'antibody', 'bispecific', 'bispecificAntibody', 'adc'],
  },
];

// Placeholder-asset pattern (generic target-NNN with no company prefix).
// Real dev codes like "KT-253" (Kymera), "TUB-040" (Tubulis), "ABBV-383"
// have a company prefix (letters before digits). Placeholder patterns
// tend to be "KRAS G12C-101", "Anti-PD-L1-301", "HER3-501" — target
// names followed by 3-digit codes.
const PLACEHOLDER_ASSET_PATTERN = /^(Anti-)?[A-Z][A-Za-z0-9/]*(\s?[A-Za-z][0-9]+[A-Za-z]?)?-[0-9]{3,4}$/;

/**
 * Core validation function. Returns `{valid: true}` for deals that pass
 * all fabrication checks, or `{valid: false, rejectCode, rejectReason}`
 * for deals that should not enter the DB in a `pending` state.
 *
 * Pipelines should call this after LLM extraction but before Supabase
 * insert. Rejected extractions can either be dropped entirely or inserted
 * with `verification_status='rejected'` so the audit trail is preserved.
 */
export function validateExtractedDeal(deal: ValidatableDeal): ValidationResult {
  // ── 1. Missing critical fields ──
  if (!deal.licensor?.trim() || !deal.licensee?.trim()) {
    return {
      valid: false,
      rejectCode: 'missing_critical_field',
      rejectReason: 'Missing licensor or licensee',
    };
  }
  if (!deal.modality?.trim()) {
    return {
      valid: false,
      rejectCode: 'missing_critical_field',
      rejectReason: 'Missing modality',
    };
  }

  // ── 2. Confidence threshold (stricter than prior 75) ──
  if (deal.confidence_score != null && deal.confidence_score < 85) {
    return {
      valid: false,
      rejectCode: 'confidence_below_threshold',
      rejectReason: `Confidence ${deal.confidence_score} below minimum 85`,
    };
  }

  // ── 3. Asset-modality suffix consistency ──
  if (deal.asset_name?.trim()) {
    for (const rule of SUFFIX_RULES) {
      if (rule.pattern.test(deal.asset_name.trim())) {
        if (!rule.allowedModalities.includes(deal.modality)) {
          return {
            valid: false,
            rejectCode: 'suffix_modality_mismatch',
            rejectReason:
              `Asset "${deal.asset_name}" suffix implies modality class ${
                rule.allowedModalities.slice(0, 3).join('/')
              }, but tagged as "${deal.modality}"`,
          };
        }
        break; // first-matching rule wins
      }
    }
  }

  // ── 4. Placeholder asset pattern (target-NNN with no source URL) ──
  if (
    deal.asset_name?.trim() &&
    PLACEHOLDER_ASSET_PATTERN.test(deal.asset_name.trim()) &&
    !deal.source_url?.trim() &&
    !deal.source_filing_id?.trim()
  ) {
    return {
      valid: false,
      rejectCode: 'placeholder_asset_pattern',
      rejectReason:
        `Asset name "${deal.asset_name}" matches placeholder pattern (TARGET-NNN) with no source URL or filing ID`,
    };
  }

  // ── 5. Licensor-modality known-pipeline check ──
  const licensorKey = findLicensorKey(deal.licensor.trim());
  if (licensorKey) {
    const allowed = LICENSOR_PRIMARY_MODALITIES[licensorKey];
    if (!allowed.includes(deal.modality)) {
      return {
        valid: false,
        rejectCode: 'licensor_modality_mismatch',
        rejectReason:
          `${licensorKey} develops ${allowed.slice(0, 3).join('/')}, but tagged as "${deal.modality}"`,
      };
    }
  }

  return { valid: true };
}

/** Case-insensitive, punctuation-tolerant match of licensor names. */
function findLicensorKey(name: string): string | null {
  const norm = name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  for (const key of Object.keys(LICENSOR_PRIMARY_MODALITIES)) {
    const keyNorm = key.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
    if (norm === keyNorm || norm.startsWith(keyNorm + ' ') || norm === keyNorm.split(' ')[0]) {
      return key;
    }
  }
  return null;
}

/** Returns first ~500 characters of `filingText` around the first mention
 * of the licensee company name (or from the start if no mention). Used by
 * ingestion pipelines to populate `raw_text_excerpt` so audits can verify
 * deal terms against the original source. */
export function extractAuditExcerpt(filingText: string, licensee: string, maxLen = 500): string {
  if (!filingText) return '';
  const needle = licensee?.toLowerCase().trim();
  const hay = filingText.toLowerCase();
  const idx = needle ? hay.indexOf(needle) : -1;
  const start = idx > 100 ? idx - 100 : 0;
  return filingText.slice(start, start + maxLen).replace(/\s+/g, ' ').trim();
}
