import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { generateFAQSchema } from '@/lib/seo/structured-data';

interface TAConfig {
  name: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  heroDescription: string;
  keywords: string[];
  faqs: Array<{ question: string; answer: string }>;
}

const TA_CONFIG: Record<string, TAConfig> = {
  oncology: {
    name: 'Oncology',
    slug: 'oncology',
    metaTitle: 'Oncology Deal Benchmarks 2026 — Licensing, M&A & Royalty Data | Solidus',
    metaDescription: 'Benchmark oncology licensing deals, ADC partnerships & immuno-oncology M&A with verified deal terms. The most active TA for biopharma transactions.',
    heroDescription: 'The most active therapeutic area for biopharma deals. Benchmark licensing terms, ADC partnerships, immuno-oncology collaborations, and M&A across solid tumors and hematologic malignancies.',
    keywords: ['oncology deal benchmarks 2026', 'oncology licensing deals', 'ADC deal benchmarks', 'immuno-oncology partnerships', 'cancer drug M&A', 'oncology royalty rates', 'bispecific antibody deals', 'oncology upfront payments', 'tumor deal terms', 'oncology collaboration benchmarks'],
    faqs: [
      { question: 'What are typical upfront payments in oncology licensing deals?', answer: 'Oncology licensing upfronts vary widely by modality and stage. ADC and bispecific deals command premium upfronts ($50M-$300M+ for clinical-stage assets), while small molecule oncology deals typically range $20M-$100M. Solidus benchmarks are derived from verified SEC filings and press releases across all oncology sub-segments.' },
      { question: 'How do oncology deal structures compare to other therapeutic areas?', answer: 'Oncology consistently leads in total deal volume and competition for assets. Deals tend to feature higher milestone-to-upfront ratios, reflecting clinical risk in late-stage trials. Royalty rates for marketed oncology products typically range 15-25%, above the cross-TA median of 10-18%.' },
      { question: 'What oncology modalities are driving the most deal activity in 2026?', answer: 'ADCs (antibody-drug conjugates), bispecific antibodies, and radiopharmaceuticals are the most active oncology modalities in 2026. ADC deals have seen upfront payments increase 40%+ since 2023, driven by competition for next-gen payloads and novel targets beyond HER2 and Trop2.' },
    ],
  },
  neurology: {
    name: 'Neurology & CNS',
    slug: 'neurology',
    metaTitle: 'Neurology & CNS Deal Benchmarks 2026 — Licensing & M&A Data | Solidus',
    metaDescription: 'Neurology overtook oncology in total deal value in 2026. Benchmark CNS licensing deals, Alzheimer\'s partnerships & neuropsychiatry M&A terms.',
    heroDescription: 'Neurology overtook oncology in total deal value in 2026, driven by blockbuster Alzheimer\'s and neuropsychiatry transactions. Benchmark licensing terms for CNS, epilepsy, migraine, Parkinson\'s, and schizophrenia deals.',
    keywords: ['neurology deal benchmarks 2026', 'CNS licensing deals', 'Alzheimer deal benchmarks', 'Parkinson partnerships', 'neuropsychiatry M&A', 'neurology royalty rates', 'CNS drug deal terms', 'brain disease licensing', 'neuroscience deal benchmarks', 'CNS collaboration terms'],
    faqs: [
      { question: 'Why did neurology deal values surpass oncology in 2026?', answer: 'Several mega-deals in Alzheimer\'s disease and neuropsychiatry pushed CNS total deal value above oncology in 2026. The success of anti-amyloid antibodies validated the target, triggering a wave of next-generation partnerships. Neuropsychiatry also saw renewed interest with novel mechanisms for treatment-resistant depression and schizophrenia.' },
      { question: 'What are typical deal structures for CNS licensing agreements?', answer: 'CNS deals typically feature higher upfronts relative to total deal value compared to oncology, reflecting longer development timelines and higher clinical failure rates in the CNS. Opt-in/opt-out structures are common, allowing licensees to evaluate Phase 2 data before committing to full development costs.' },
      { question: 'How do neurology royalty rates compare across indications?', answer: 'Neurology royalty rates vary significantly by indication. Alzheimer\'s disease deals command premium royalties (18-25%+ for late-stage assets) given the massive commercial opportunity. Epilepsy and migraine deals typically see lower royalties (8-15%) due to established competition, while rare neurological conditions fall in between.' },
    ],
  },
  immunology: {
    name: 'Immunology & Autoimmune',
    slug: 'immunology',
    metaTitle: 'Immunology Deal Benchmarks 2026 — Autoimmune Licensing & M&A | Solidus',
    metaDescription: 'Benchmark autoimmune licensing deals across RA, lupus, IBD & psoriasis. $13B+ in verified immunology deal value with upfront and royalty data.',
    heroDescription: 'Over $13B in verified immunology deal value spanning rheumatoid arthritis, lupus, IBD, psoriasis, and other autoimmune conditions. Benchmark licensing terms, M&A premiums, and royalty structures.',
    keywords: ['immunology deal benchmarks 2026', 'autoimmune licensing deals', 'IBD deal benchmarks', 'psoriasis M&A', 'immunology royalty rates', 'lupus drug deals', 'rheumatoid arthritis partnerships', 'autoimmune drug M&A', 'IL-17 deal terms', 'JAK inhibitor licensing'],
    faqs: [
      { question: 'What drives immunology deal valuations in 2026?', answer: 'Immunology deals are increasingly driven by next-generation biologics (IL-17, IL-23, TL1A) and oral small molecules (JAK inhibitors, TYK2). Assets demonstrating superiority over anti-TNF standards of care command premium valuations. The shift toward precision immunology — matching patients to mechanisms — is also driving higher deal values for targeted approaches.' },
      { question: 'How do IBD deal terms differ from other autoimmune indications?', answer: 'IBD deals (Crohn\'s disease and ulcerative colitis) typically feature larger total deal values than other autoimmune indications, reflecting the large patient population and high unmet need. Upfronts for clinical-stage IBD assets range $50M-$200M, with royalties of 12-20% on net sales.' },
      { question: 'What immunology modalities are attracting the most licensing activity?', answer: 'Bispecific antibodies targeting dual immune pathways, oral peptides, and cell therapies (including CAR-T for lupus) are generating the most immunology deal activity in 2026. TL1A-targeting antibodies specifically saw a surge in deal-making following positive Phase 2 data across multiple IBD programs.' },
    ],
  },
  cardiovascular: {
    name: 'Cardiovascular',
    slug: 'cardiovascular',
    metaTitle: 'Cardiovascular Deal Benchmarks 2026 — Heart Failure & ATTR Deals | Solidus',
    metaDescription: 'Benchmark cardiovascular licensing deals for heart failure, ATTR cardiomyopathy, PAH & hypertension with verified upfront and royalty data.',
    heroDescription: 'Benchmark deal terms across heart failure, ATTR cardiomyopathy, pulmonary arterial hypertension, and hypertension. Cardiovascular deals have seen renewed interest with novel mechanisms and gene therapy approaches.',
    keywords: ['cardiovascular deal benchmarks 2026', 'heart failure licensing deals', 'ATTR cardiomyopathy deals', 'PAH partnerships', 'cardiovascular M&A', 'cardiology royalty rates', 'cardiac drug deals', 'cardiovascular collaboration terms', 'heart disease licensing', 'CV deal benchmarks'],
    faqs: [
      { question: 'What is driving renewed deal activity in cardiovascular drugs?', answer: 'Novel mechanisms such as cardiac myosin inhibitors, gene therapies for inherited cardiomyopathies, and RNA-based approaches for ATTR have revitalized cardiovascular deal-making. The success of SGLT2 inhibitors in heart failure also validated the crossover between metabolic and CV indications, attracting new entrants.' },
      { question: 'How do ATTR cardiomyopathy deal structures compare to other CV deals?', answer: 'ATTR deals command premium valuations due to the validated biology (following tafamidis approval) and large addressable market in wild-type ATTR. Gene silencing and editing approaches for hereditary ATTR have seen upfronts of $100M+ with total deal values exceeding $1B, significantly above typical cardiovascular deal ranges.' },
      { question: 'What cardiovascular deal terms should licensors benchmark against?', answer: 'Cardiovascular licensing deals typically feature upfronts of $20M-$150M depending on stage and mechanism novelty. Royalties range 10-18% for licensed products. Co-development structures are common for late-stage assets, while gene therapy approaches tend to use milestone-heavy structures reflecting the longer path to market.' },
    ],
  },
  metabolic: {
    name: 'Metabolic & Obesity',
    slug: 'metabolic',
    metaTitle: 'GLP-1 & Obesity Deal Benchmarks 2026 — Metabolic Licensing Data | Solidus',
    metaDescription: 'GLP-1 and obesity licensing deals are the hottest segment in biopharma. Benchmark metabolic deal terms, NASH/MASH M&A & diabetes partnerships.',
    heroDescription: 'The GLP-1 and obesity licensing race is the hottest segment in biopharma. Benchmark deal terms across next-gen incretins, oral GLP-1s, NASH/MASH, and diabetes with $25B+ in verified metabolic deal value.',
    keywords: ['GLP-1 licensing deals 2026', 'obesity deal benchmarks', 'metabolic drug M&A', 'GLP-1 deal terms', 'NASH deal benchmarks', 'diabetes licensing deals', 'weight loss drug partnerships', 'incretin deal benchmarks', 'obesity royalty rates', 'oral GLP-1 deals', 'MASH drug M&A', 'metabolic collaboration terms'],
    faqs: [
      { question: 'How have GLP-1 deals reshaped metabolic deal benchmarks?', answer: 'GLP-1 receptor agonist deals have dramatically raised metabolic deal valuations since 2023. Next-gen incretin deals (dual and triple agonists, oral formulations) now command upfronts of $100M-$500M+ with total deal values regularly exceeding $2B. The obesity market expansion has made metabolic deals among the most competitive in all of biopharma.' },
      { question: 'What are current deal terms for oral GLP-1 licensing agreements?', answer: 'Oral GLP-1 licensing deals are commanding premium terms given the massive commercial opportunity of convenient dosing. Upfronts for clinical-stage oral GLP-1 assets range $200M-$500M+, with royalties of 15-25% reflecting the differentiated market position. Companies are competing aggressively for oral formulation technology platforms.' },
      { question: 'Are NASH/MASH deal terms recovering after clinical setbacks?', answer: 'NASH/MASH deal activity has stabilized following the FDA approval of resmetirom in 2024. New deals are increasingly structured with risk-sharing milestones tied to histological endpoints. Upfronts have moderated ($30M-$100M for Phase 2 assets) but total deal values remain substantial given the large addressable liver disease market.' },
    ],
  },
  rareDisease: {
    name: 'Rare Disease',
    slug: 'rareDisease',
    metaTitle: 'Rare Disease Deal Benchmarks 2026 — Gene Therapy & Orphan Drug Data | Solidus',
    metaDescription: 'Rare disease deals show 15-25% PoS vs 7-12% overall. Benchmark orphan drug licensing, gene therapy partnerships & SMA/DMD deal terms.',
    heroDescription: 'Rare disease assets benefit from 15-25% probability of success vs 7-12% overall, orphan drug exclusivity, and premium pricing power. Benchmark gene therapy, SMA, Duchenne, hemophilia, and orphan drug deal structures.',
    keywords: ['rare disease deal benchmarks 2026', 'gene therapy licensing deals', 'orphan drug deal terms', 'SMA partnerships', 'Duchenne deal benchmarks', 'rare disease M&A', 'gene therapy royalty rates', 'hemophilia licensing', 'cell therapy rare disease deals', 'orphan drug M&A'],
    faqs: [
      { question: 'Why do rare disease deals command premium valuations?', answer: 'Rare disease assets benefit from higher probability of success (15-25% vs 7-12% for all indications), 7 years of orphan drug market exclusivity, expedited regulatory pathways (Breakthrough Therapy, Accelerated Approval), and premium pricing ($200K-$3M+ per patient per year). These structural advantages drive higher upfronts and total deal values relative to patient population size.' },
      { question: 'How are gene therapy deal structures evolving in 2026?', answer: 'Gene therapy deals are shifting toward outcomes-based structures as payers demand evidence of durability. Upfronts remain substantial ($50M-$300M for clinical-stage assets), but milestones increasingly tie to long-term efficacy data (2-5 year follow-up). Royalties on gene therapies are typically lower (8-15%) but are applied to products priced at $1M-$3M+ per treatment.' },
      { question: 'What deal terms are typical for rare disease licensing agreements?', answer: 'Rare disease licensing deals typically feature upfronts of $30M-$200M for clinical-stage assets, total deal values of $500M-$2B+, and royalties of 10-20%. Geographic splits are common, with licensors retaining the US/EU and licensing ex-US rights. Development milestones are often weighted toward regulatory rather than commercial events.' },
    ],
  },
  infectiousDisease: {
    name: 'Infectious Disease',
    slug: 'infectiousDisease',
    metaTitle: 'Infectious Disease Deal Benchmarks 2026 — Vaccine & Antiviral Data | Solidus',
    metaDescription: 'Benchmark infectious disease licensing deals across vaccines, HIV, HBV cure programs, RSV & next-gen antibiotics with verified deal terms.',
    heroDescription: 'Benchmark deal terms across vaccines, HIV, hepatitis B functional cure programs, RSV prevention, and next-generation antibiotics. Post-pandemic platforms continue driving partnership activity.',
    keywords: ['infectious disease deal benchmarks 2026', 'vaccine licensing deals', 'antiviral deal terms', 'HIV cure partnerships', 'HBV drug deals', 'RSV deal benchmarks', 'antibiotic M&A', 'mRNA vaccine deals', 'infectious disease royalty rates', 'pandemic preparedness deals'],
    faqs: [
      { question: 'How did COVID reshape infectious disease deal structures?', answer: 'The pandemic permanently changed infectious disease deal-making by validating mRNA and viral vector platforms. Post-COVID deals increasingly feature platform licensing (not just single products), with licensees securing access to technology for multiple pathogens. Upfronts for platform deals range $100M-$500M+, significantly above pre-pandemic levels.' },
      { question: 'What are current HBV functional cure deal terms?', answer: 'Hepatitis B functional cure programs are one of the most active segments, with multiple mechanisms (siRNA, ASO, capsid inhibitors, immunotherapy) being licensed. Combination approach deals are common, with upfronts of $50M-$200M and total deal values exceeding $1B for programs targeting the estimated 300M chronic HBV patients worldwide.' },
      { question: 'How do antibiotic deal structures address the commercial challenge?', answer: 'Antibiotic deals are uniquely structured to address the "broken economics" of antimicrobials. Pull incentives (subscription models, guaranteed revenue floors) are increasingly incorporated into deal terms. Upfronts are typically lower ($10M-$50M) but include novel milestone structures tied to regulatory designations (QIDP, GAIN Act) rather than traditional sales thresholds.' },
    ],
  },
  ophthalmology: {
    name: 'Ophthalmology',
    slug: 'ophthalmology',
    metaTitle: 'Ophthalmology Deal Benchmarks 2026 — Retinal & Dry Eye Licensing | Solidus',
    metaDescription: 'Benchmark ophthalmology deal terms for AMD, glaucoma, dry eye & retinal gene therapy. Verified licensing, M&A & royalty data from Solidus.',
    heroDescription: 'Benchmark licensing terms for age-related macular degeneration, glaucoma, dry eye disease, and retinal gene therapy. Ophthalmology deals are driven by high unmet need and premium pricing in retinal diseases.',
    keywords: ['ophthalmology deal benchmarks 2026', 'retinal drug licensing', 'AMD deal terms', 'dry eye licensing deals', 'glaucoma partnerships', 'ophthalmology M&A', 'eye disease royalty rates', 'retinal gene therapy deals', 'ocular drug delivery deals', 'ophthalmology collaboration terms'],
    faqs: [
      { question: 'What drives premium valuations in retinal disease deals?', answer: 'Retinal disease deals (AMD, diabetic macular edema, geographic atrophy) command premium valuations due to the large addressable market ($15B+ globally), premium pricing ($10K-$20K+ per injection), and long duration of treatment. Gene therapy approaches for inherited retinal diseases add further upside with potential one-time curative pricing.' },
      { question: 'How are ophthalmology drug delivery deals structured?', answer: 'Ocular drug delivery platform deals (sustained-release implants, port delivery systems, suprachoroidal injection) are structured as platform licenses with multiple product options. Upfronts range $30M-$150M with per-product milestones and royalties. These deals often include co-development provisions where the platform owner retains manufacturing rights.' },
      { question: 'What are typical royalty rates for ophthalmology licensing deals?', answer: 'Ophthalmology royalties typically range 12-22% for retinal products and 8-15% for anterior segment (glaucoma, dry eye). Anti-VEGF biosimilars and next-gen competitors have compressed royalty expectations for AMD, while novel mechanisms (complement inhibitors, gene therapy) still command premium rates above 18%.' },
    ],
  },
  dermatology: {
    name: 'Dermatology',
    slug: 'dermatology',
    metaTitle: 'Dermatology Deal Benchmarks 2026 — Atopic Dermatitis & Psoriasis | Solidus',
    metaDescription: 'Benchmark dermatology deal terms for atopic dermatitis, psoriasis, vitiligo & alopecia. Verified licensing, M&A & royalty data from Solidus.',
    heroDescription: 'Benchmark licensing terms for atopic dermatitis, psoriasis, vitiligo, alopecia areata, and other skin conditions. Dermatology deals benefit from large patient populations and growing biologic adoption.',
    keywords: ['dermatology deal benchmarks 2026', 'atopic dermatitis licensing deals', 'psoriasis deal terms', 'vitiligo drug partnerships', 'alopecia M&A', 'dermatology royalty rates', 'skin disease deal benchmarks', 'JAK inhibitor dermatology deals', 'IL-13 licensing terms', 'dermatology collaboration deals'],
    faqs: [
      { question: 'How are atopic dermatitis deal valuations trending in 2026?', answer: 'Atopic dermatitis remains the highest-value dermatology indication for deal-making, driven by the validated dupilumab franchise and competition among next-gen IL-13, IL-31, and OX40 approaches. Clinical-stage AD assets command upfronts of $50M-$200M+ with total deal values exceeding $1B for differentiated mechanisms.' },
      { question: 'What deal structures are common in dermatology licensing?', answer: 'Dermatology deals frequently use geographic licensing structures, with licensors retaining North America and out-licensing ex-US rights. Co-promotion agreements are also common for launched products. Upfronts range $20M-$150M depending on indication breadth and stage, with royalties of 10-20% on net sales.' },
      { question: 'How do topical vs systemic dermatology deals compare?', answer: 'Systemic dermatology deals (biologics, oral JAK inhibitors) command significantly higher valuations than topical deals, reflecting larger commercial potential. Topical deals typically feature lower upfronts ($5M-$30M) and royalties (5-12%), while systemic biologic deals for psoriasis and AD are benchmarked alongside immunology transactions.' },
    ],
  },
  womensHealth: {
    name: 'Women\'s Health',
    slug: 'womensHealth',
    metaTitle: 'Women\'s Health Deal Benchmarks 2026 — Endometriosis & Fertility | Solidus',
    metaDescription: 'Benchmark women\'s health licensing deals for endometriosis, uterine fibroids, menopause & fertility with verified deal terms and royalty data.',
    heroDescription: 'Benchmark deal terms for endometriosis, uterine fibroids, menopause, and fertility treatments. Women\'s health has seen increasing deal activity as novel mechanisms address historically underserved conditions.',
    keywords: ['women health deal benchmarks 2026', 'endometriosis licensing deals', 'fertility deal terms', 'uterine fibroid partnerships', 'women health M&A', 'menopause drug deals', 'reproductive health licensing', 'women health royalty rates'],
    faqs: [
      { question: 'Why is women\'s health deal activity increasing?', answer: 'Women\'s health has been historically underserved by pharma, but new mechanisms (GnRH antagonists, non-hormonal approaches) and increased venture funding have driven a deal-making resurgence. The approval of oral GnRH antagonists for endometriosis and fibroids validated the commercial opportunity, spurring follow-on partnerships.' },
      { question: 'What are typical deal terms for endometriosis licensing agreements?', answer: 'Endometriosis deals typically feature upfronts of $20M-$100M for clinical-stage assets, with total deal values of $300M-$1B. Non-hormonal approaches command premium terms due to differentiation from established GnRH therapy. Royalties range 10-18% depending on the stage and competitive positioning.' },
      { question: 'How do fertility technology deals differ from traditional pharma licensing?', answer: 'Fertility deals increasingly involve technology platforms (AI-driven embryo selection, in vitro maturation, genetic testing) rather than traditional drug licensing. These deals often feature lower upfronts but equity participation and revenue-sharing structures, reflecting the medtech-pharma hybrid nature of fertility innovation.' },
    ],
  },
  gastroenterology: {
    name: 'Gastroenterology',
    slug: 'gastroenterology',
    metaTitle: 'Gastroenterology Deal Benchmarks 2026 — IBD, Crohn\'s & GI Data | Solidus',
    metaDescription: 'Benchmark GI licensing deals for IBD, Crohn\'s, celiac disease & NASH. Verified deal terms, M&A data & royalty rates from Solidus.',
    heroDescription: 'Benchmark deal terms for inflammatory bowel disease, Crohn\'s, celiac disease, NASH/MASH, and other GI conditions. Gastroenterology deals benefit from large patient populations and evolving treatment paradigms.',
    keywords: ['gastroenterology deal benchmarks 2026', 'IBD licensing deals', 'Crohn disease deal terms', 'celiac drug partnerships', 'GI M&A', 'gastroenterology royalty rates', 'gut-brain axis deals', 'microbiome licensing', 'NASH deal terms', 'GI collaboration benchmarks'],
    faqs: [
      { question: 'How do IBD deal valuations compare across mechanisms?', answer: 'IBD deal valuations vary significantly by mechanism. Anti-TL1A and S1P modulators are commanding the highest valuations in 2026 ($200M+ upfronts for clinical-stage assets), while anti-integrin follow-ons and IL-23 inhibitors see more moderate terms. Bispecific approaches targeting dual pathways represent the next wave of premium-valued IBD assets.' },
      { question: 'What is the current state of celiac disease deal-making?', answer: 'Celiac disease has emerged as a high-interest GI indication following multiple Phase 2 readouts. With no approved therapies beyond a gluten-free diet, first-in-class assets are commanding premium terms. Licensing deals for clinical-stage celiac programs feature upfronts of $50M-$150M with total values exceeding $1B.' },
      { question: 'How are microbiome therapy deals structured?', answer: 'Microbiome deals have matured from pure-platform plays to product-specific licensing. Following the first FDA-approved microbiome therapy, deals now feature more traditional structures with upfronts of $20M-$80M and milestone-heavy payment schedules tied to clinical and regulatory events, plus royalties of 8-15% on net sales.' },
    ],
  },
  hematology: {
    name: 'Hematology',
    slug: 'hematology',
    metaTitle: 'Hematology Deal Benchmarks 2026 — CAR-T, Sickle Cell & Blood Cancer | Solidus',
    metaDescription: 'Benchmark hematology deal terms for CAR-T cell therapy, sickle cell gene therapy, lymphoma & myeloma licensing. Verified M&A and royalty data.',
    heroDescription: 'Benchmark deal terms across leukemia, lymphoma, myeloma, sickle cell disease, and hemophilia. Hematology deals are driven by CAR-T cell therapy licensing, gene therapy for hemoglobinopathies, and next-gen bispecifics.',
    keywords: ['hematology deal benchmarks 2026', 'CAR-T licensing deals', 'sickle cell gene therapy deals', 'lymphoma deal terms', 'myeloma partnerships', 'hematology M&A', 'cell therapy deal benchmarks', 'hemophilia licensing', 'blood cancer royalty rates', 'bispecific antibody hematology deals'],
    faqs: [
      { question: 'How are CAR-T cell therapy deals structured in 2026?', answer: 'CAR-T deals have evolved beyond the initial licensing wave to feature more sophisticated structures. Allogeneic (off-the-shelf) CAR-T deals command premium upfronts ($100M-$400M+) given the manufacturing scalability advantage. Autologous CAR-T deals are increasingly structured as co-development or profit-sharing arrangements, with royalties of 15-25% for licensed products.' },
      { question: 'What deal terms are typical for sickle cell gene therapy?', answer: 'Sickle cell gene therapy deals are among the highest-valued in hematology, reflecting the curative potential and large addressable population. Following the approval of gene therapies for SCD, next-gen approaches (in vivo gene editing, non-viral delivery) are seeing upfronts of $100M-$300M+ with total deal values exceeding $2B.' },
      { question: 'How do bispecific antibody hematology deals compare to solid tumor deals?', answer: 'Hematology bispecific deals typically feature higher upfronts than solid tumor bispecifics due to the validated mechanism (following blinatumomab and teclistamab approvals). CD20xCD3, BCMAxCD3, and novel target combinations see upfronts of $75M-$250M, with royalties of 12-20%. The competitive landscape is more defined, allowing more confident valuation benchmarking.' },
    ],
  },
};

export async function generateStaticParams() {
  return Object.keys(TA_CONFIG).map(ta => ({ ta }));
}

export async function generateMetadata({ params }: { params: Promise<{ ta: string }> }): Promise<Metadata> {
  const { ta } = await params;
  const config = TA_CONFIG[ta];
  if (!config) return {};

  return {
    title: config.metaTitle,
    description: config.metaDescription,
    keywords: config.keywords,
    openGraph: {
      title: config.metaTitle,
      description: config.metaDescription,
      type: 'website',
      url: `https://solidus.ambrosiaventures.co/therapeutic-areas/${ta}`,
      siteName: 'Solidus by Ambrosia Ventures',
      images: [{ url: `/api/og?title=${encodeURIComponent(config.name + ' Deal Benchmarks 2026')}&subtitle=Licensing+%7C+M%26A+%7C+Royalty+Data`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: config.metaTitle,
      description: config.metaDescription,
    },
    alternates: { canonical: `https://solidus.ambrosiaventures.co/therapeutic-areas/${ta}` },
  };
}

export default async function TherapeuticAreaPage({ params }: { params: Promise<{ ta: string }> }) {
  const { ta } = await params;
  const config = TA_CONFIG[ta];
  if (!config) notFound();

  const supabase = createServiceClient();

  // Fetch live stats for this TA.
  // R68 (2026-04-15): exclude is_synthetic=true so 845 flagged fakes
  // don't appear on public TA pages or in the deal-count.
  const [dealCountResult, recentDealsResult, dealTypeBreakdown] = await Promise.all([
    supabase.from('deals').select('id', { count: 'exact', head: true })
      .eq('therapeutic_area', ta)
      .eq('is_synthetic', false),
    supabase.from('deals')
      .select('licensor_name, licensee_name, asset_name, deal_type, upfront_usd, total_deal_value_usd, announced_date, modality, phase_at_signing')
      .eq('therapeutic_area', ta)
      .eq('is_synthetic', false)
      .eq('terms_disclosed', true)
      .not('upfront_usd', 'is', null)
      .order('announced_date', { ascending: false })
      .limit(10),
    supabase.from('deals')
      .select('deal_type')
      .eq('therapeutic_area', ta)
      .eq('is_synthetic', false),
  ]);

  const totalDeals = dealCountResult.count || 0;
  const recentDeals = recentDealsResult.data || [];

  // Count deal types
  const typeCounts: Record<string, number> = {};
  for (const d of dealTypeBreakdown.data || []) {
    typeCounts[d.deal_type || 'license'] = (typeCounts[d.deal_type || 'license'] || 0) + 1;
  }

  // Calculate averages
  const withUpfront = recentDeals.filter(d => d.upfront_usd && d.upfront_usd > 0);
  const avgUpfront = withUpfront.length > 0 ? withUpfront.reduce((s, d) => s + (d.upfront_usd || 0), 0) / withUpfront.length : 0;

  const formatUsd = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${Math.round(n / 1e6)}M`;

  return (
    <>
    <main className="min-h-screen bg-white dark:bg-slate-900">
      {/* Hero */}
      <section className="py-16 sm:py-20 px-4 bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
        <div className="max-w-5xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Home', href: '/' },
            { label: 'Therapeutic Areas', href: '/therapeutic-areas' },
            { label: config.name },
          ]} />

          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {config.name} Deal Benchmarks
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mb-8">
            {config.heroDescription} Benchmarks derived from {totalDeals.toLocaleString()} verified transactions.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalDeals.toLocaleString()}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Deals</div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{avgUpfront > 0 ? formatUsd(avgUpfront) : 'N/A'}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Upfront</div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{Object.keys(typeCounts).length}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Deal Types</div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{withUpfront.length > 0 ? `${Math.round(withUpfront.length / recentDeals.length * 100)}%` : 'N/A'}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Terms Disclosed</div>
            </div>
          </div>
        </div>
      </section>

      {/* Deal Type Breakdown */}
      <section className="py-10 px-4 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Deal Structure Distribution</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {['license', 'acquisition', 'collaboration', 'option', 'co_development'].map(type => (
              <div key={type} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                <div className="text-xl font-bold text-slate-900 dark:text-white">{typeCounts[type] || 0}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">{type.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Deals */}
      <section className="py-10 px-4 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Recent Deals with Disclosed Terms</h2>
          {recentDeals.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">No deals with disclosed terms available yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Parties</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Type</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Upfront</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Value</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {recentDeals.map((deal, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-white">{deal.licensor_name} → {deal.licensee_name}</div>
                        {deal.asset_name && <div className="text-xs text-slate-400">{deal.asset_name}</div>}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 capitalize text-xs">{(deal.deal_type || 'license').replace('_', ' ')}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">{deal.upfront_usd ? formatUsd(deal.upfront_usd) : '—'}</td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-300">{deal.total_deal_value_usd ? formatUsd(deal.total_deal_value_usd) : '—'}</td>
                      <td className="py-3 px-4 text-right text-xs text-slate-500 dark:text-slate-400">{new Date(deal.announced_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-4 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Benchmark Your {config.name} Deal
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Get instant benchmarks for upfront payments, milestones, and royalties based on {totalDeals.toLocaleString()} verified {config.name.toLowerCase()} transactions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/calculator?therapeuticArea=${ta}`}
              className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-lg"
            >
              Run {config.name} Benchmark
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
            <a
              href="https://ambrosiaventures.co/advisory"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              Talk to an Advisor
            </a>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 px-4 border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{config.name} Deal Benchmarking FAQ</h2>
          <div className="space-y-4">
            {config.faqs.map((faq, idx) => (
              <details key={idx} className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                <summary className="cursor-pointer list-none p-5 font-medium text-slate-900 dark:text-white flex items-center justify-between">
                  {faq.question}
                  <svg className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-5 pb-5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* JSON-LD: Dataset */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Dataset",
        "name": `${config.name} Biopharma Deal Benchmarks 2026`,
        "description": `${totalDeals} verified ${config.name.toLowerCase()} licensing, acquisition, and collaboration deals with financial terms including upfront payments, milestones, and royalty rates.`,
        "url": `https://solidus.ambrosiaventures.co/therapeutic-areas/${ta}`,
        "creator": { "@type": "Organization", "name": "Ambrosia Ventures", "url": "https://ambrosiaventures.co" },
        "variableMeasured": ["Upfront Payment", "Total Deal Value", "Development Milestones", "Commercial Milestones", "Royalty Rate", "Deal Structure"],
        "temporalCoverage": "2017/2026",
        "keywords": config.keywords.join(', '),
      })}} />

      {/* JSON-LD: FAQ */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema(config.faqs)) }} />

      {/* JSON-LD: WebPage */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": config.metaTitle,
        "description": config.metaDescription,
        "url": `https://solidus.ambrosiaventures.co/therapeutic-areas/${ta}`,
        "isPartOf": { "@type": "WebSite", "name": "Solidus", "url": "https://solidus.ambrosiaventures.co" },
        "about": { "@type": "Thing", "name": `${config.name} Deal Benchmarks` },
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://solidus.ambrosiaventures.co" },
            { "@type": "ListItem", "position": 2, "name": "Therapeutic Areas", "item": "https://solidus.ambrosiaventures.co/therapeutic-areas" },
            { "@type": "ListItem", "position": 3, "name": config.name },
          ],
        },
      })}} />
    </main>
    </>
  );
}
