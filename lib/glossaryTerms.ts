export interface GlossaryTerm {
  term: string;
  slug: string;
  definition: string;
  relatedTerms: string[];
  category: string;
}

function toSlug(term: string): string {
  return term
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const rawTerms: Omit<GlossaryTerm, 'slug'>[] = [
  {
    term: 'Upfront Payment',
    definition: 'A non-refundable payment made by the licensee to the licensor at the signing of a licensing agreement. Upfront payments compensate the licensor for the value created to date and provide immediate capital.',
    relatedTerms: ['Option Payment', 'Signing Bonus'],
    category: 'Financial Terms',
  },
  {
    term: 'Milestone Payment',
    definition: 'Contingent payments triggered by the achievement of specific development, regulatory, or commercial events. Milestones align incentives and reduce risk for licensees.',
    relatedTerms: ['Development Milestones', 'Regulatory Milestones', 'Commercial Milestones'],
    category: 'Financial Terms',
  },
  {
    term: 'Development Milestones',
    definition: 'Payments triggered by clinical development achievements such as IND filing, Phase 1/2/3 initiation, Phase 2/3 data readout, or successful completion of pivotal trials.',
    relatedTerms: ['Clinical Milestones', 'Milestone Payment'],
    category: 'Financial Terms',
  },
  {
    term: 'Regulatory Milestones',
    definition: 'Payments triggered by regulatory achievements such as FDA acceptance of BLA/NDA, FDA approval, EMA approval, or approvals in other major markets (Japan, China).',
    relatedTerms: ['Approval Milestones', 'Filing Milestones'],
    category: 'Financial Terms',
  },
  {
    term: 'Commercial Milestones',
    definition: 'Payments triggered when cumulative net sales reach specified thresholds (e.g., $500M, $1B, $2B). Also called sales milestones.',
    relatedTerms: ['Sales Milestones', 'Revenue Milestones'],
    category: 'Financial Terms',
  },
  {
    term: 'Royalty Rate',
    definition: 'A percentage of net sales paid by the licensee to the licensor for the duration of the royalty term. Typically ranges from low single digits to mid-teens depending on deal stage and modality.',
    relatedTerms: ['Tiered Royalties', 'Net Sales', 'Royalty Term'],
    category: 'Financial Terms',
  },
  {
    term: 'Tiered Royalties',
    definition: 'A royalty structure where the percentage increases as cumulative sales reach higher thresholds. For example: 8% on first $500M, 10% on $500M-$1B, 12% above $1B.',
    relatedTerms: ['Royalty Rate', 'Escalating Royalties'],
    category: 'Financial Terms',
  },
  {
    term: 'Net Sales',
    definition: 'Gross sales minus deductions such as returns, rebates, chargebacks, distribution fees, and taxes. The basis for calculating royalty payments.',
    relatedTerms: ['Gross Sales', 'Royalty Rate'],
    category: 'Financial Terms',
  },
  {
    term: 'CVR (Contingent Value Right)',
    definition: 'A tradeable security that entitles holders to receive payments upon achievement of specified milestones, often used in M&A transactions to bridge valuation gaps.',
    relatedTerms: ['Earnout', 'Milestone Payment'],
    category: 'Deal Structures',
  },
  {
    term: 'Earnout',
    definition: 'Post-closing payments in an M&A transaction contingent on achieving specified targets. Similar to milestones but typically used in acquisition contexts.',
    relatedTerms: ['CVR', 'Contingent Consideration'],
    category: 'Deal Structures',
  },
  {
    term: 'Option Agreement',
    definition: 'A contract granting the optionee the right (but not obligation) to acquire a license or purchase an asset by a specified date, typically in exchange for an upfront option fee.',
    relatedTerms: ['Option Fee', 'Exercise Price', 'Option Period'],
    category: 'Deal Structures',
  },
  {
    term: 'Co-Development Agreement',
    definition: 'A partnership structure where both parties share development costs and responsibilities, typically with shared economics on the back end.',
    relatedTerms: ['Cost Sharing', 'Profit Sharing', 'Co-Commercialization'],
    category: 'Deal Structures',
  },
  {
    term: 'Exclusive License',
    definition: 'A license granting the licensee sole rights to develop and commercialize the asset in the specified territory and field, excluding even the licensor from competing.',
    relatedTerms: ['Non-Exclusive License', 'Sole License', 'Field of Use'],
    category: 'License Types',
  },
  {
    term: 'Field of Use',
    definition: 'The specific therapeutic area, indication, or application covered by a license. Licensors may grant different licenses for different fields to maximize value.',
    relatedTerms: ['Indication', 'Territory', 'Exclusive License'],
    category: 'License Types',
  },
  {
    term: 'Territory',
    definition: 'The geographic region(s) covered by a license. Common splits include US-only, ex-US, Greater China, Japan, Europe, and Rest of World.',
    relatedTerms: ['Geographic Rights', 'Regional License'],
    category: 'License Types',
  },
  {
    term: 'ADC (Antibody-Drug Conjugate)',
    definition: 'A therapeutic modality combining a monoclonal antibody with a cytotoxic payload via a chemical linker. ADCs enable targeted delivery of potent drugs to cancer cells.',
    relatedTerms: ['Payload', 'Linker', 'DAR'],
    category: 'Modalities',
  },
  {
    term: 'CAR-T (Chimeric Antigen Receptor T-cell)',
    definition: 'A cell therapy approach where patient T-cells are engineered to express a chimeric antigen receptor targeting specific tumor antigens.',
    relatedTerms: ['Cell Therapy', 'Autologous', 'Allogeneic'],
    category: 'Modalities',
  },
  {
    term: 'Bispecific Antibody',
    definition: 'An engineered antibody that can simultaneously bind two different antigens or epitopes, enabling novel mechanisms like T-cell engagement or dual pathway inhibition.',
    relatedTerms: ['T-Cell Engager', 'BiTE', 'Dual-Targeting'],
    category: 'Modalities',
  },
  {
    term: 'PROTAC (Proteolysis Targeting Chimera)',
    definition: 'A heterobifunctional molecule that recruits an E3 ubiquitin ligase to a target protein, inducing its degradation via the proteasome.',
    relatedTerms: ['Molecular Glue', 'Targeted Protein Degradation', 'E3 Ligase'],
    category: 'Modalities',
  },
  {
    term: 'Gene Therapy',
    definition: 'A therapeutic approach that introduces, alters, or replaces genetic material within cells to treat disease. Includes AAV-based approaches and gene editing.',
    relatedTerms: ['AAV', 'Gene Editing', 'CRISPR'],
    category: 'Modalities',
  },
  {
    term: 'mRNA Therapeutics',
    definition: 'Medicines using messenger RNA to instruct cells to produce therapeutic proteins. Validated by COVID-19 vaccines and expanding into oncology and rare diseases.',
    relatedTerms: ['LNP', 'Modified Nucleosides', 'Self-Amplifying RNA'],
    category: 'Modalities',
  },
  {
    term: 'IND (Investigational New Drug)',
    definition: 'An FDA application that must be approved before human clinical trials can begin in the US. The IND includes preclinical data, manufacturing information, and clinical protocols.',
    relatedTerms: ['CTA', 'Pre-IND Meeting', 'IND-Enabling Studies'],
    category: 'Regulatory',
  },
  {
    term: 'BLA (Biologics License Application)',
    definition: 'The FDA application required for approval of a biologic product. Equivalent to an NDA for small molecules.',
    relatedTerms: ['NDA', 'MAA', 'Regulatory Filing'],
    category: 'Regulatory',
  },
  {
    term: 'Breakthrough Therapy Designation',
    definition: 'An FDA designation for drugs intended for serious conditions where preliminary evidence shows substantial improvement over existing therapies. Provides intensive FDA guidance and potential expedited review.',
    relatedTerms: ['Fast Track', 'Priority Review', 'Accelerated Approval'],
    category: 'Regulatory',
  },
  {
    term: 'Orphan Drug Designation',
    definition: 'A designation for drugs treating rare diseases (affecting <200,000 people in US). Provides tax credits, fee waivers, and 7 years of market exclusivity upon approval.',
    relatedTerms: ['Rare Disease', 'Market Exclusivity', 'Orphan Drug Act'],
    category: 'Regulatory',
  },
  {
    term: 'Phase 1 Clinical Trial',
    definition: 'First-in-human studies primarily assessing safety, tolerability, and pharmacokinetics in a small number of subjects (typically 20-80).',
    relatedTerms: ['Dose Escalation', 'MTD', 'PK/PD'],
    category: 'Clinical Development',
  },
  {
    term: 'Phase 2 Clinical Trial',
    definition: 'Studies evaluating efficacy and side effects in a larger patient population (typically 100-300). Often provides first proof-of-concept in the target indication.',
    relatedTerms: ['Proof of Concept', 'Dose Finding', 'Expansion Cohort'],
    category: 'Clinical Development',
  },
  {
    term: 'Phase 3 Clinical Trial',
    definition: 'Large-scale studies (typically 300-3000+ patients) designed to confirm efficacy, monitor side effects, and compare to standard of care. Forms basis for regulatory approval.',
    relatedTerms: ['Pivotal Trial', 'Registrational Study', 'Primary Endpoint'],
    category: 'Clinical Development',
  },
  {
    term: 'Due Diligence',
    definition: 'The comprehensive investigation of a potential partner or acquisition target, including scientific, clinical, regulatory, IP, manufacturing, and commercial assessments.',
    relatedTerms: ['Data Room', 'DD Findings', 'Technical DD'],
    category: 'Deal Process',
  },
  {
    term: 'Term Sheet',
    definition: 'A non-binding document outlining the key terms of a proposed deal, including financial terms, governance, and key obligations. Precedes definitive agreements.',
    relatedTerms: ['LOI', 'MOU', 'Definitive Agreement'],
    category: 'Deal Process',
  },
  {
    term: 'Data Room',
    definition: 'A secure repository (typically virtual) where confidential documents are shared with potential partners or acquirers during due diligence.',
    relatedTerms: ['VDR', 'Due Diligence', 'Confidential Information'],
    category: 'Deal Process',
  },
];

export const glossaryTerms: GlossaryTerm[] = rawTerms.map((t) => ({
  ...t,
  slug: toSlug(t.term),
}));

export const glossaryCategories = [...new Set(glossaryTerms.map((t) => t.category))];

export function getTermBySlug(slug: string): GlossaryTerm | undefined {
  return glossaryTerms.find((t) => t.slug === slug);
}

export function getAllTermSlugs(): string[] {
  return glossaryTerms.map((t) => t.slug);
}

export function getRelatedTermEntries(relatedTerms: string[]): GlossaryTerm[] {
  return relatedTerms
    .map((name) => glossaryTerms.find((t) => t.term === name))
    .filter((t): t is GlossaryTerm => !!t);
}
