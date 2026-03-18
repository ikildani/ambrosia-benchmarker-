'use client';

import { useState, useCallback, useRef, useMemo, useEffect, createRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { toast as sonnerToast } from 'sonner';
import { CalculationResult, CalculationInput, formatCurrency, formatRange, calculateRiskScore, type GuardrailWarning } from '@/lib/calculations';
import type { PartnerForPDF } from '@/lib/report';
const ReportGenerationModal = dynamic(() => import('./ReportGenerationModal'), { ssr: false });
const ShareModal = dynamic(() => import('./ShareModal'), { ssr: false });
import { useTracking } from './TrackingProvider';
import { captureClientError } from '@/lib/sentry-client';
import { PRICING, DEAL_STATS } from '@/lib/config/constants';
import type { DealMemo } from '@/lib/ai/deal-memo-generator';
import { staticBenchmarks as benchmarks } from '@/lib/benchmarks';
import { getHistory, formatDate as historyFormatDate } from '@/lib/history';
import type { CalculationHistoryItem } from '@/lib/history';

// Dynamic imports for heavy below-fold components
import { ChartSkeleton, TableSkeleton, AnalysisPanelSkeleton } from './skeletons/SectionSkeleton';
import PartnerMatchesSkeleton from './skeletons/PartnerMatchesSkeleton';
const SensitivityAnalysis = dynamic(() => import('./sensitivity').then(m => ({ default: m.SensitivityAnalysis })), { ssr: false, loading: () => <TableSkeleton /> });
const ChartSection = dynamic(() => import('./charts/ChartSection'), { ssr: false, loading: () => <ChartSkeleton /> });
const ScenarioComparison = dynamic(() => import('./ScenarioComparison'), { ssr: false });
const NegotiationPlaybookModal = dynamic(() => import('./NegotiationPlaybookModal'), { ssr: false });
const PartnerMatchesContainer = dynamic(() => import('./PartnerMatchesContainer'), { ssr: false, loading: () => <PartnerMatchesSkeleton /> });
const ComparableDeals = dynamic(() => import('./ComparableDeals'), { ssr: false, loading: () => <TableSkeleton /> });
const HistoryPicker = dynamic(() => import('./results/HistoryPicker'), { ssr: false });
const ScenarioComparisonPanel = dynamic(() => import('./results/ScenarioComparison'), { ssr: false });
const MarketUrgency = dynamic(() => import('./results/MarketUrgency'), { ssr: false, loading: () => <AnalysisPanelSkeleton /> });
const PipelineIntelligence = dynamic(() => import('./results/PipelineIntelligence'), { ssr: false, loading: () => <AnalysisPanelSkeleton /> });
const RnpvAnalysis = dynamic(() => import('./results/RnpvAnalysis'), { ssr: false, loading: () => <AnalysisPanelSkeleton /> });
const MonteCarloResults = dynamic(() => import('./results/MonteCarloResults'), { ssr: false, loading: () => <ChartSkeleton /> });
const MarketSizePanel = dynamic(() => import('./results/MarketSizePanel'), { ssr: false, loading: () => <AnalysisPanelSkeleton /> });
const ScenarioPlanner = dynamic(() => import('./results/ScenarioPlanner'), { ssr: false, loading: () => <AnalysisPanelSkeleton /> });
const CompetitiveLandscapePanel = dynamic(() => import('./results/CompetitiveLandscapePanel'), { ssr: false, loading: () => <AnalysisPanelSkeleton /> });
const DealFlowForecastPanel = dynamic(() => import('./results/DealFlowForecastPanel'), { ssr: false, loading: () => <AnalysisPanelSkeleton /> });

// Static type import (types are erased at runtime, safe alongside dynamic component import)
import type { PartnerMatchForPDF } from './PartnerMatchesContainer';
export type { PartnerMatchForPDF };

// Sub-components
import FinancialErrorBoundary from './results/FinancialErrorBoundary';
import ResultsHeader from './results/ResultsHeader';
import InfoTooltip from './calculator/InfoTooltip';
import MetricCard from './results/MetricCard';
import DrillDownPanel from './results/DrillDownPanel';
import DealMemoSection from './results/DealMemoSection';
import ResultsDisclaimer from './results/ResultsDisclaimer';
import { runFinancialModel, type FinancialModelResult } from '@/lib/financial/run-financial-model';
import type { CompetitiveLandscape, DealFlowForecast } from '@/lib/financial/types';
import { computeTornadoSensitivities } from '@/lib/financial/tornado-sensitivity';
import { findComparableDeals } from '@/lib/comparableDeals';
import epiData from '@/data/epidemiology.json';

// Dynamic import for TornadoChart (Recharts-heavy, below the fold)
const TornadoChart = dynamic(() => import('./TornadoChart'), { ssr: false, loading: () => <ChartSkeleton /> });

interface ResultsProps {
  result: CalculationResult;
  tier?: 'free' | 'report' | 'pro';
  onUpgrade?: () => void;
  onBuyReport?: () => void;
  reportId?: string;
  userId?: string;
  userEmail?: string;
  inputs?: {
    modality: string;
    phase: string;
    indication: string;
    territory: string;
  };
  fullInputs?: CalculationInput;
  onApplyNewInputs?: (inputs: Partial<CalculationInput>) => void;
  onPartnerMatchesLoaded?: (matches: PartnerMatchForPDF[]) => void;
}

// Default badge/tooltip configuration — overridden per deal type via dealTypeLabels
const DEFAULT_METRIC_BADGES: Record<string, { label: string; color: string }> = {
  upfront: { label: 'Guaranteed', color: 'teal' },
  totalDealValue: { label: 'Potential', color: 'success' },
  devMilestones: { label: 'If Achieved', color: 'cyan' },
  regMilestones: { label: 'Upon Approval', color: 'teal' },
  commMilestones: { label: 'Sales-Based', color: 'cyan' },
  royalties: { label: 'On Net Sales', color: 'teal' }
};

const DEFAULT_METRIC_TOOLTIPS: Record<string, string> = {
  upfront: 'The guaranteed payment at deal signing, regardless of future milestones. Typically 20-40% of total deal value for Phase 2+ assets.',
  totalDealValue: 'Maximum potential value if all milestones are achieved and commercial targets met. Includes upfront, milestones, and estimated royalty value.',
  devMilestones: 'Payments triggered by clinical development progress: IND filing, Phase 1/2/3 initiation, and data readouts. Usually the largest milestone bucket.',
  regMilestones: 'Payments upon regulatory events: FDA/EMA submission, approval, and additional market authorizations. Typically 10-20% of total milestones.',
  commMilestones: 'Sales-based milestone payments triggered when cumulative net sales reach defined thresholds ($500M, $1B, etc.). Paid once per threshold.',
  royalties: 'Ongoing percentage of net sales paid to the licensor. Tiered rates increase at higher sales thresholds. Typically range from single-digit to low-twenties percent.',
};

// Build deal-type-aware badges and tooltips from dealTypeLabels
function getMetricBadges(dtl?: { upfrontBadge: string; milestoneBadge: string; royaltyNote: string }) {
  if (!dtl) return DEFAULT_METRIC_BADGES;
  return {
    upfront: { label: dtl.upfrontBadge, color: 'teal' },
    totalDealValue: { label: 'Potential', color: 'success' },
    devMilestones: { label: dtl.milestoneBadge, color: 'cyan' },
    regMilestones: { label: dtl.milestoneBadge, color: 'teal' },
    commMilestones: { label: dtl.milestoneBadge, color: 'cyan' },
    royalties: { label: dtl.royaltyNote.length > 30 ? 'See Note' : dtl.royaltyNote, color: 'teal' }
  };
}

function getMetricTooltips(dtl?: { upfrontTooltip: string; royaltyNote: string }) {
  if (!dtl) return DEFAULT_METRIC_TOOLTIPS;
  return {
    ...DEFAULT_METRIC_TOOLTIPS,
    upfront: dtl.upfrontTooltip,
    royalties: dtl.royaltyNote,
  };
}

// Helper to extract indication category from specific indication.
// Returns the most specific category key that exists in INDICATION_ADJACENCY
// (from partner-matching.ts). Falls back to broad therapeutic-area categories.
function getIndicationCategory(indication: string): string | null {
  // Explicit mapping from every indication value to its INDICATION_ADJACENCY key.
  // Grouped by therapeutic area for readability.
  const map: Record<string, string> = {
    // ── Oncology: Solid Tumors ──
    'lung_nsclc': 'solid_tumor',
    'lung_sclc': 'solid_tumor',
    'breast_her2': 'solid_tumor',
    'breast_tnbc': 'solid_tumor',
    'breast_hr': 'solid_tumor',
    'colorectal': 'solid_tumor',
    'pancreatic': 'solid_tumor',
    'melanoma': 'solid_tumor',
    'prostate': 'solid_tumor',
    'ovarian': 'solid_tumor',
    'gastric': 'solid_tumor',
    'liver': 'solid_tumor',
    'renal': 'solid_tumor',
    'gbm': 'solid_tumor',
    'bladder': 'solid_tumor',
    'headNeck': 'solid_tumor',
    'cholangiocarcinoma': 'solid_tumor',
    'mesothelioma': 'solid_tumor',
    'sarcoma': 'solid_tumor',
    'endometrial': 'solid_tumor',
    'cervical': 'solid_tumor',
    'thyroid': 'solid_tumor',
    'esophageal': 'solid_tumor',
    'smallBowel': 'solid_tumor',
    'neuroendocrine': 'solid_tumor',
    'uvealMelanoma': 'solid_tumor',
    'testicular': 'solid_tumor',
    'adrenocortical': 'solid_tumor',
    'nasopharyngeal': 'solid_tumor',
    'thymoma': 'solid_tumor',
    'penile': 'solid_tumor',
    'merkelCell': 'solid_tumor',
    'vulvar': 'solid_tumor',
    // Pediatric solid tumors
    'neuroblastoma': 'solid_tumor',
    'retinoblastoma': 'solid_tumor',
    'osteosarcoma': 'solid_tumor',
    'ewingSarcoma': 'solid_tumor',
    'rhabdomyosarcoma': 'solid_tumor',

    // ── Oncology: Hematologic Malignancies ──
    'aml': 'hematological',
    'all': 'hematological',
    'cll': 'hematological',
    'myeloma': 'hematological',
    'dlbcl': 'hematological',
    'follicular': 'hematological',
    'mantleCell': 'hematological',
    'mds': 'hematological',
    'mpn': 'hematological',
    'tCellLymphoma': 'hematological',
    'cml': 'hematological',
    'waldenstrom': 'hematological',
    'hodgkins': 'hematological',
    'marginalZone': 'hematological',
    'burkitt': 'hematological',
    'primaryCNSLymphoma': 'hematological',
    'systemicMastocytosis': 'hematological',
    'cmml': 'hematological',
    'hairyCell': 'hematological',
    'amyloidosisAL': 'hematological',
    'castlemanDisease': 'hematological',
    'aplasticAnemia': 'hematological',
    'bpdcn': 'hematological',

    // ── Neurology: Neurodegeneration ──
    'alzheimers': 'alzheimers',
    'parkinsons': 'parkinsons',
    'als': 'als',
    'huntingtons': 'huntingtons',
    'frontotemporal': 'alzheimers',   // FTD is closest to alzheimers (dementia family)
    'lewyBody': 'alzheimers',         // Lewy Body Dementia closest to alzheimers

    // ── Neurology: Psychiatry ──
    'schizophrenia': 'schizophrenia',
    'depression': 'depression',
    'addiction': 'addiction',
    'bipolar': 'depression',           // bipolar maps to depression (mood disorder family)
    'ptsd': 'depression',              // PTSD maps to depression
    'ocd': 'depression',               // OCD/anxiety maps to depression
    'adhd': 'cns',                     // ADHD — broad CNS
    'insomnia': 'narcolepsy',          // sleep disorders → narcolepsy

    // ── Neurology: Movement & Seizure ──
    'epilepsy': 'epilepsy',
    'tremor': 'tremor',

    // ── Neurology: Other CNS ──
    'pain': 'pain',
    'ms': 'multiple_sclerosis',
    'migraine': 'migraine',
    'narcolepsy': 'narcolepsy',
    'tbi': 'tbi',
    'chronicPain': 'pain',            // chronic non-neuropathic → pain
    'clusterHeadache': 'migraine',    // cluster headache → migraine
    'restlessLeg': 'cns',             // no specific key, broad CNS
    'rareNeuro': 'rare_neurological',

    // ── Neurology: Neurodevelopmental & Rare ──
    'autism': 'rare_neurological',
    'rett': 'rare_neurological',
    'friedreichs': 'rare_neurological',
    'dmd': 'neuromuscular',
    'sma': 'neuromuscular',
    'angelman': 'rare_neurological',
    'dravet': 'epilepsy',             // Dravet is an epilepsy syndrome
    'myotonicDystrophy': 'neuromuscular',
    'tuberousSclerosis': 'rare_neurological',
    'cmt': 'neuromuscular',
    'fragileX': 'rare_neurological',
    'cdkl5': 'rare_neurological',
    'praderWilli': 'rare_neurological',
    'batten': 'rare_neurological',
    'ataxiaTelangiectasia': 'rare_neurological',

    // ── Neurology: Neuromuscular ──
    'lgmd': 'neuromuscular',
    'fshd': 'neuromuscular',
    'stiffPerson': 'neuromuscular',
    'gbs': 'neuromuscular',
    'neurofibromatosis': 'rare_neurological',

    // ── Neurology: Other ──
    'peripheralNeuropathy': 'pain',
    'spinalCordInjury': 'tbi',        // spinal cord injury → tbi (trauma family)

    // ── Immunology: Inflammatory Bowel ──
    'ulcerativeColitis': 'ibd',
    'crohns': 'ibd',
    'ibd_broad': 'ibd',
    'celiac': 'autoimmune',           // celiac → autoimmune (no specific key)

    // ── Immunology: Rheumatologic ──
    'rheumatoidArthritis': 'rheumatology',
    'sle_lupus': 'rheumatology',
    'lupusNephritis': 'nephrology',
    'systemicSclerosis': 'rheumatology',
    'sjogrens': 'rheumatology',
    'aancaVasculitis': 'rheumatology',

    // ── Immunology: Dermatologic ──
    'atopicderm': 'dermatology',
    'psoriasis': 'dermatology',
    'psoriaticArthritis': 'dermatology',
    'alopecia': 'dermatology',
    'hidradenitis': 'dermatology',
    'vitiligo': 'dermatology',
    'epidermolysis': 'dermatology',
    'chronicUrticaria': 'dermatology',

    // ── Immunology: Neuromuscular & Rare ──
    'myastheniaGravis': 'neuromuscular',
    'cidp': 'neuromuscular',
    'multipleSclerosisMod': 'multiple_sclerosis',
    'pnh': 'complement',
    'pemphigus': 'autoimmune',
    'itp': 'complement',
    'dermatomyositis': 'neuromuscular',
    'coldAgglutinin': 'complement',
    'ttpAutoimmune': 'complement',

    // ── Immunology: Respiratory & Allergic ──
    'asthma': 'respiratory',
    'copd': 'respiratory',
    'ipf': 'respiratory',
    'eosinophilicEsophagitis': 'autoimmune',
    'foodAllergy': 'autoimmune',
    'heredAngioedema': 'complement',

    // ── Immunology: Transplant ──
    'gvhd': 'autoimmune',
    'organTransplant': 'autoimmune',

    // ── Immunology: Renal & Rare ──
    'igan': 'nephrology',
    'membranousNephropathy': 'nephrology',
    'fsgs': 'nephrology',
    'thyroidEye': 'autoimmune',
    'pbc': 'autoimmune',
    'psc': 'autoimmune',
    'autoImmuneHepatitis': 'autoimmune',
    'nephroticSyndrome': 'nephrology',
    'rareAutoimmune': 'autoimmune',

    // ── Immunology: Musculoskeletal & Vascular ──
    'ankylosingSpondylitis': 'rheumatology',
    'giantCellArteritis': 'rheumatology',
    'polymyalgiaRheumatica': 'rheumatology',
    'behcets': 'rheumatology',
    'egpa': 'rheumatology',
    'antiphospholipid': 'rheumatology',
    'systemicJIA': 'rheumatology',

    // ── Immunology: Other Autoimmune ──
    'sarcoidosis': 'autoimmune',
    'uveitis': 'autoimmune',
    'primaryImmunodeficiency': 'autoimmune',

    // ── Metabolic: Obesity & Weight ──
    'obesity': 'obesity',
    'metabolicSyndrome': 'metabolic_syndrome',

    // ── Metabolic: Diabetes & Glycemic ──
    'type2Diabetes': 'type2_diabetes',
    'type1Diabetes': 'metabolic',      // T1D — no specific key, broad metabolic

    // ── Metabolic: Organ-Specific ──
    'nashMash': 'nash_mash',
    'lipodystrophy': 'lipodystrophy',
    'ckdMetabolic': 'metabolic',

    // ── Metabolic: Cardiovascular-Metabolic ──
    'hfpef': 'cardiovascular',
    'familialHypercholesterolemia': 'cardiovascular',

    // ── Metabolic: Endocrine ──
    'acromegaly': 'metabolic',
    'cushings': 'metabolic',
    'congenitalAdrenalHyperplasia': 'metabolic',
    'congenitalHyperinsulinism': 'metabolic',

    // ── Metabolic: Other ──
    'gout': 'metabolic',
    'hemochromatosis': 'metabolic',

    // ── Metabolic: Rare Metabolic ──
    'glycogenStorage': 'glycogen_storage',
    'pku': 'pku',
    'wilsonDisease': 'rare_metabolic',
    'fabry': 'rare_metabolic',
    'gaucher': 'rare_metabolic',
    'pompe': 'rare_metabolic',
    'mpsDisorders': 'rare_metabolic',
    'aatDeficiency': 'rare_metabolic',
    'hyperoxaluria': 'rare_metabolic',
    'ureaCycleDisorders': 'rare_metabolic',
    'asmd': 'rare_metabolic',
    'cystinosis': 'rare_metabolic',
    'galactosemia': 'rare_metabolic',
    'krabbe': 'rare_metabolic',
    'hypophosphatasia': 'rare_metabolic',
    'porphyria': 'rare_metabolic',
    'mitochondrialDisease': 'rare_metabolic',
    'rareMetabolic': 'rare_metabolic',

    // ── Metabolic: Hematologic (Non-Malignant) ──
    'sickleCell': 'rare_disease',
    'betaThalassemia': 'rare_disease',
    'hemophiliaA': 'rare_disease',
    'hemophiliaB': 'rare_disease',
    'attrAmyloidosis': 'rare_disease',

    // ── Metabolic: Respiratory (Genetic) ──
    'cysticFibrosis': 'rare_disease',

    // ── Cardiovascular ──
    'heartFailureHfref': 'cardiovascular',
    'cardiomyopathy': 'cardiovascular',
    'atrialFibrillation': 'cardiovascular',
    'cardiacArrhythmia': 'cardiovascular',
    'aorticStenosis': 'cardiovascular',
    'pulmonaryArterialHypertension': 'cardiovascular',
    'coronaryArteryDisease': 'cardiovascular',
    'peripheralArteryDisease': 'cardiovascular',
    'atherosclerosis': 'cardiovascular',
    'venousThromboembolism': 'cardiovascular',
    'dyslipidemia': 'cardiovascular',
    'resistantHypertension': 'cardiovascular',
    'myocarditis': 'cardiovascular',

    // ── Infectious Disease ──
    'hivAids': 'infectious',
    'hepatitisB': 'infectious',
    'hepatitisD': 'infectious',
    'cmvInfection': 'infectious',
    'rsv': 'infectious',
    'influenza': 'infectious',
    'covid': 'infectious',
    'dengueMalaria': 'infectious',
    'amrBacterial': 'infectious',
    'tuberculosis': 'infectious',
    'fungalInfections': 'infectious',
    'clostridioides': 'infectious',

    // ── Ophthalmology ──
    'wetAmd': 'ophthalmology',
    'dryAmdGA': 'ophthalmology',
    'diabeticRetinopathy': 'ophthalmology',
    'diabeticMacularEdema': 'ophthalmology',
    'retinitisPigmentosa': 'ophthalmology',
    'retinalVeinOcclusion': 'ophthalmology',
    'uveiticMacular': 'ophthalmology',
    'stargardt': 'ophthalmology',
    'glaucoma': 'ophthalmology',
    'dryEyeDisease': 'ophthalmology',
    'myopiaProgression': 'ophthalmology',

    // ── Women's Health ──
    // No specific INDICATION_ADJACENCY key for women's health indications.
    // Map to the closest broad category where possible.
    'endometriosis': 'autoimmune',           // inflammatory component, closest match
    'uterineFibroids': 'rare_disease',       // niche, limited partner overlap
    'pcos': 'metabolic',                     // strong metabolic component
    'fertilityArt': 'rare_disease',          // niche
    'contraceptionNovel': 'rare_disease',    // niche
    'menopause': 'metabolic',                // hormonal/metabolic overlap
    'postpartumDepression': 'depression',    // maps to depression (CNS)
    'preeclampsia': 'cardiovascular',        // vascular/CV overlap
    'prematureLabor': 'rare_disease',        // niche
    'vulvodynia': 'pain',                    // chronic pain
    'cervicalDysplasia': 'infectious',       // HPV-related
    'breastCancerPrevention': 'solid_tumor', // oncology-adjacent
  };

  return map[indication] ?? null;
}

// Methodology Section component
function MethodologySection() {
  const [isExpanded, setIsExpanded] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="mt-6 sm:mt-8">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-navy-50 to-slate-50 dark:from-slate-700 dark:to-slate-800 rounded-xl border border-navy-200 dark:border-slate-600 hover:border-navy-300 dark:hover:border-slate-500 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-navy-600 to-navy-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <span className="font-semibold text-navy-800 dark:text-white">How We Calculate This</span>
        </div>
        <motion.svg
          className="w-5 h-5 text-navy-500 dark:text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="methodology"
            initial={prefersReducedMotion ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ overflow: 'hidden' }}
          >
          <div className="mt-3 p-5 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-600">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg font-bold text-navy-800 dark:text-white">Powered by</span>
            <span className="text-lg font-bold text-teal-600 dark:text-teal-400">Ambrosia Ventures</span>
          </div>

          <p className="text-sm text-neutral-600 dark:text-slate-300 mb-4 leading-relaxed">
            These estimates are generated using Ambrosia Ventures&apos; proprietary benchmarking model,
            developed from our team&apos;s deep expertise in life sciences M&A and licensing transactions.
          </p>

          <h5 className="text-xs font-semibold text-neutral-500 dark:text-slate-400 uppercase tracking-wider mb-2">Our Model Analyzes</h5>
          <ul className="space-y-2 mb-4">
            {[
              'Publicly disclosed deal terms (SEC filings, press releases)',
              'Industry benchmark reports and market intelligence',
              'Recent transaction activity and emerging trends'
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-neutral-600 dark:text-slate-300">
                <svg className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>

          <p className="text-sm text-neutral-600 dark:text-slate-300 mb-4 leading-relaxed">
            The algorithm weighs multiple factors including development phase, therapeutic modality,
            indication, territory scope, competitive landscape, and clinical data quality to generate
            customized ranges specific to your asset profile.
          </p>

          <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-600/30">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Benchmark ranges reflect the market distribution across {DEAL_STATS.TOTAL_DEALS} comparable transactions.
              Individual deal outcomes depend on asset-specific factors, competitive dynamics, and negotiation leverage.{' '}
              <a href="/methodology" className="text-teal-600 hover:text-teal-700 underline">Learn more about our methodology</a>
            </p>
          </div>
        </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header gradient skeleton */}
      <div className="rounded-2xl bg-gradient-to-r from-neutral-200 to-neutral-100 h-32" />

      {/* Deal structure bar skeleton */}
      <div className="h-12 bg-neutral-100 rounded-xl" />

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-5 space-y-3">
            <div className="h-3 bg-neutral-100 rounded w-2/3" />
            <div className="h-7 bg-neutral-200 rounded w-full" />
            <div className="h-3 bg-neutral-100 rounded w-1/2" />
          </div>
        ))}
      </div>

      {/* Chart area skeleton */}
      <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-6">
        <div className="h-4 bg-neutral-100 rounded w-1/4 mb-4" />
        <div className="h-48 bg-neutral-50 rounded-lg" />
      </div>
    </div>
  );
}

export default function Results({ result, tier = 'free', onUpgrade, onBuyReport, reportId, userId, userEmail, inputs, fullInputs, onApplyNewInputs, onPartnerMatchesLoaded }: ResultsProps) {
  const { terms, tieredRoyalties, dealRecommendation, negotiationInsight, modifiers, labels, dealTypeLabels, drillDown } = result;
  const isPro = tier === 'pro';
  const isReport = tier === 'report';

  // Build per-field warning text from non-critical guardrail warnings
  const fieldWarnings = useMemo(() => {
    const map: Record<string, string> = {};
    if (result.warnings) {
      for (const w of result.warnings) {
        if (w.severity !== 'critical' && !map[w.field]) {
          map[w.field] = w.message;
        }
      }
    }
    return map;
  }, [result.warnings]);

  // Deal-type-aware labels — prevents licensing terminology from leaking into acquisitions, options, etc.
  const metricBadges = getMetricBadges(dealTypeLabels);
  const metricTooltips = getMetricTooltips(dealTypeLabels);
  const dtl = dealTypeLabels; // shorthand
  const hasFullAccess = isPro || isReport;
  const { trackProFeatureClick, trackExportAttempted, trackUpgradeCtaClick } = useTracking();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [partnerMatches, setPartnerMatches] = useState<PartnerForPDF[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [emailForResults, setEmailForResults] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [dealMemo, setDealMemo] = useState<DealMemo | null>(null);
  const [memoLoading, setMemoLoading] = useState(false);
  const [memoError, setMemoError] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [compareItem, setCompareItem] = useState<CalculationHistoryItem | null>(null);
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);
  const comparisonRef = useRef<HTMLDivElement>(null);

  // Financial modeling state
  const [financialModel, setFinancialModel] = useState<FinancialModelResult | null>(null);
  const [serverData, setServerData] = useState<{ competitiveLandscape?: CompetitiveLandscape; dealFlowForecast?: DealFlowForecast }>({});

  // Tornado sensitivity (memoized, computed alongside financial model)
  const tornadoSensitivities = useMemo(() => {
    if (!fullInputs || !result) return null;
    try {
      const sensitivities = computeTornadoSensitivities(fullInputs, result);
      return sensitivities.length > 0 ? sensitivities : null;
    } catch (err) {
      console.error('[TornadoSensitivity] Failed to compute:', err);
      return null;
    }
  }, [fullInputs, result]);

  // Track previous result values for sensitivity analysis delta badges
  const isFirstRenderRef = useRef(true);
  const [previousTerms, setPreviousTerms] = useState<{
    upfront: number;
    totalDealValue: number;
    devMilestones: number;
    regMilestones: number;
    commMilestones: number;
  } | null>(null);

  // Use a ref to always hold the "current" medians so we can capture them before they change
  const currentMediansRef = useRef({
    upfront: terms.upfront.median,
    totalDealValue: terms.totalDealValue.median,
    devMilestones: terms.devMilestones.median,
    regMilestones: terms.regMilestones.median,
    commMilestones: terms.commMilestones.median,
  });

  useEffect(() => {
    const prev = currentMediansRef.current;
    const curr = {
      upfront: terms.upfront.median,
      totalDealValue: terms.totalDealValue.median,
      devMilestones: terms.devMilestones.median,
      regMilestones: terms.regMilestones.median,
      commMilestones: terms.commMilestones.median,
    };

    // Only show delta when values actually changed (not first render)
    if (!isFirstRenderRef.current && (
      prev.upfront !== curr.upfront ||
      prev.totalDealValue !== curr.totalDealValue ||
      prev.devMilestones !== curr.devMilestones ||
      prev.regMilestones !== curr.regMilestones ||
      prev.commMilestones !== curr.commMilestones
    )) {
      setPreviousTerms({ ...prev });
    }

    // Update ref to current values
    currentMediansRef.current = curr;
    isFirstRenderRef.current = false;
  }, [terms]);

  // Check if there's calculation history for the Compare button
  useEffect(() => {
    const history = getHistory();
    setHasHistory(history.length > 0);
  }, []);

  // Auto-scroll to comparison panel when a compare item is selected
  useEffect(() => {
    if (compareItem && comparisonRef.current) {
      setTimeout(() => {
        comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [compareItem]);

  // Run financial modeling pipeline (rNPV, Monte Carlo, scenarios, FX)
  useEffect(() => {
    if (!fullInputs || !result) return;
    try {
      const fm = runFinancialModel(fullInputs, result, epiData.indications);
      setFinancialModel(fm);
    } catch (err) {
      captureClientError(err, 'Results', { context: 'FinancialModel pipeline error' });
    }
  }, [fullInputs, result]);

  // Fetch server-side financial data (competitive landscape, deal flow forecast)
  useEffect(() => {
    if (!fullInputs) return;
    const params = new URLSearchParams({
      therapeuticArea: fullInputs.therapeuticArea,
      indication: fullInputs.indication,
      modality: fullInputs.modality,
    });
    fetch(`/api/financial?${params}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setServerData({ competitiveLandscape: data.competitiveLandscape, dealFlowForecast: data.dealFlowForecast });
      })
      .catch(() => { /* non-critical — panels render empty */ });
  }, [fullInputs]);

  // Build compare label from history item
  const compareLabel = compareItem
    ? `${compareItem.labels.phase} ${compareItem.labels.modality} -- ${historyFormatDate(compareItem.timestamp)}`
    : '';

  // Compute context lines comparing metrics against phase baselines
  const contextLines = useMemo(() => {
    if (!fullInputs) return {};

    const ta = fullInputs.therapeuticArea;
    const phase = fullInputs.phase;

    // Pick the right baselines for the therapeutic area
    const baselines = ta === 'metabolic'
      ? benchmarks.metabolicPhaseBaselines[phase]
      : ta === 'immunology'
      ? benchmarks.immunologyPhaseBaselines[phase]
      : ta === 'neurology'
      ? benchmarks.neurologyPhaseBaselines[phase]
      : benchmarks.phaseBaselines[phase];

    if (!baselines) return {};

    const taLabel = ta === 'oncology' ? 'oncology'
      : ta === 'neurology' ? 'neurology'
      : ta === 'immunology' ? 'immunology'
      : 'metabolic';
    const phaseLabel = benchmarks.labels.phases[phase];

    function buildContextLine(actual: number, baseline: number, metricLabel: string): string {
      if (baseline === 0) return '';
      const pctDiff = Math.round(((actual - baseline) / baseline) * 100);
      if (Math.abs(pctDiff) <= 5) {
        return `In line with typical ${phaseLabel} ${taLabel} ${metricLabel}`;
      }
      const direction = pctDiff > 0 ? 'above' : 'below';
      return `${Math.abs(pctDiff)}% ${direction} ${phaseLabel} ${taLabel} median`;
    }

    return {
      totalDealValue: buildContextLine(terms.totalDealValue.median, baselines.totalValue.median, 'deal terms'),
      upfront: buildContextLine(terms.upfront.median, baselines.upfront.median, 'upfront'),
      devMilestones: '',
      regMilestones: '',
      commMilestones: '',
    };
  }, [fullInputs, terms]);

  // Copy results to clipboard
  const handleCopyResults = useCallback(() => {
    const taLabel = fullInputs?.therapeuticArea
      ? fullInputs.therapeuticArea.charAt(0).toUpperCase() + fullInputs.therapeuticArea.slice(1)
      : '';
    const text = [
      `${taLabel} | ${labels.phase} | ${labels.modality} | ${labels.indication}`,
      '',
      `Total Deal Value: ${formatCurrency(terms.totalDealValue.median)} (range: ${formatCurrency(terms.totalDealValue.low)} - ${formatCurrency(terms.totalDealValue.high)})`,
      `Upfront Payment: ${formatCurrency(terms.upfront.median)} (range: ${formatCurrency(terms.upfront.low)} - ${formatCurrency(terms.upfront.high)})`,
      `Development Milestones: ${formatCurrency(terms.devMilestones.median)} (range: ${formatCurrency(terms.devMilestones.low)} - ${formatCurrency(terms.devMilestones.high)})`,
      `Regulatory Milestones: ${formatCurrency(terms.regMilestones.median)} (range: ${formatCurrency(terms.regMilestones.low)} - ${formatCurrency(terms.regMilestones.high)})`,
      `Commercial Milestones: ${formatCurrency(terms.commMilestones.median)} (range: ${formatCurrency(terms.commMilestones.low)} - ${formatCurrency(terms.commMilestones.high)})`,
      `Royalties: ${tieredRoyalties.base.low}% - ${tieredRoyalties.highTier.high}%`,
      '',
      `Deal Structure (${dtl?.dealTypeDisplay || 'Licensing'}): ${dtl?.recommendationPrefix || `${dealRecommendation.upfrontPercent}% Upfront / ${dealRecommendation.milestonePercent}% Milestones`}`,
      `Generated by Ambrosia Benchmarker`,
    ].join('\n');

    navigator.clipboard.writeText(text);
  }, [fullInputs, labels, terms, tieredRoyalties, dealRecommendation]);

  const handleGenerateMemo = useCallback(async () => {
    if (memoLoading || dealMemo) return;
    setMemoLoading(true);
    setMemoError(null);
    try {
      const response = await fetch('/api/deal-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: reportId || undefined,
          userId: userId || undefined,
          email: userEmail || undefined,
          inputs: fullInputs,
          results: result,
          labels: { phase: labels.phase, modality: labels.modality, indication: labels.indication },
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to generate memo');
      }
      const data = await response.json();
      setDealMemo(data.memo || data);
    } catch {
      setMemoError('Unable to generate memo. Please try again.');
      sonnerToast.error('Failed to generate deal memo');
    } finally {
      setMemoLoading(false);
    }
  }, [memoLoading, dealMemo, reportId, userId, userEmail, fullInputs, result, labels]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForResults || emailSubmitting) return;
    setEmailSubmitting(true);
    try {
      // Send to Formspree
      await fetch('https://formspree.io/f/maqbwgbq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailForResults,
          source: 'results_email_capture',
          analysis: `${labels.phase} ${labels.modality} ${labels.indication}`,
          upfront: `${formatCurrency(terms.upfront.low)} - ${formatCurrency(terms.upfront.high)}`,
          totalDealValue: `${formatCurrency(terms.totalDealValue.low)} - ${formatCurrency(terms.totalDealValue.high)}`,
        }),
      });
      // Also save to newsletter API
      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailForResults, source: 'results' }),
      }).catch(() => {});
      setEmailSubmitted(true);
      sessionStorage.setItem('email_captured', 'true');
      // If this was triggered by PDF gate, open report modal
      if (showEmailGate) {
        setShowEmailGate(false);
        setReportFormat('pdf');
        setShowReportModal(true);
      }
    } catch {
      // Still mark as submitted for UX
      setEmailSubmitted(true);
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleFreePDFClick = () => {
    if (sessionStorage.getItem('email_captured') || emailSubmitted) {
      trackExportAttempted('pdf');
      setReportFormat('pdf');
      setShowReportModal(true);
    } else {
      setShowEmailGate(true);
    }
  };

  const handleLinkedInShare = () => {
    const text = `${labels.phase} ${labels.modality} deals for ${labels.indication}: Upfront ${formatCurrency(terms.upfront.low)}-${formatCurrency(terms.upfront.high)}, Total value up to ${formatCurrency(terms.totalDealValue.high)}.\n\nBenchmark your deal terms: https://calculator.ambrosiaventures.co/calculator`;
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://calculator.ambrosiaventures.co/calculator')}&summary=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=600,height=500');
  };

  const handleDownloadPDF = () => {
    trackExportAttempted('pdf');
    setReportFormat('pdf');
    setShowReportModal(true);
  };

  const handleDownloadExcel = () => {
    trackExportAttempted('excel');
    setReportFormat('excel');
    setShowReportModal(true);
  };

  // Preload ExcelJS chunk on hover so it's cached before the modal opens
  const handlePreloadExcel = useCallback(() => {
    import('@/lib/generateExcel').catch(() => {});
  }, []);

  const handleDownloadExecutiveSummary = useCallback(() => {
    if (!fullInputs || !result) return;

    import('@/lib/report').then(({ generateExecutiveSummaryPDF }) => {
      const pdfData = {
        result,
        inputs: fullInputs,
        riskScore: calculateRiskScore(fullInputs),
      };
      generateExecutiveSummaryPDF(pdfData);
    });
  }, [fullInputs, result]);

  const handlePartnerMatchesLoaded = (matches: PartnerMatchForPDF[]) => {
    setPartnerMatches(matches as PartnerForPDF[]);
    // Also notify parent component if callback provided
    onPartnerMatchesLoaded?.(matches);
  };

  const handleProFeatureClick = (feature: string) => {
    trackProFeatureClick(feature as 'export_excel' | 'export_pdf' | 'comparable_deals' | 'saved_scenarios' | 'team_sharing', 'results_section');
    onUpgrade?.();
  };

  const handleUpgradeClick = () => {
    trackUpgradeCtaClick('results_section');
    onUpgrade?.();
  };

  const getBarWidth = (median: number, max: number) => {
    return Math.min((median / max) * 100, 100);
  };

  const maxTotalValue = terms.totalDealValue.high;

  const toggleCard = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  // Determine if a card can be expanded (free users can only expand upfront)
  const canExpandCard = (cardId: string) => {
    if (hasFullAccess) return true;
    return cardId === 'upfront';
  };

  return (
    <div role="region" aria-live="polite" aria-label="Deal analysis results" className="card-elevated overflow-hidden">
      {/* Header */}
      <ResultsHeader
        labels={labels}
        isPro={isPro}
        hasFullAccess={hasFullAccess}
        tier={tier}
        inputs={inputs}
        onDownloadPDF={handleDownloadPDF}
        onDownloadExcel={handleDownloadExcel}
        onPreloadExcel={handlePreloadExcel}
        onFreePDFClick={handleFreePDFClick}
        onShare={() => setShowShareModal(true)}
        onLinkedInShare={handleLinkedInShare}
        onDownloadExecutiveSummary={handleDownloadExecutiveSummary}
        onCompare={() => setShowHistoryPicker(true)}
        hasHistory={hasHistory}
        onCopyResults={handleCopyResults}
      />

      {/* Email Capture Bar */}
      {!emailSubmitted && !sessionStorage?.getItem?.('email_captured') && (
        <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-b border-teal-100 dark:border-teal-800">
          <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 max-w-xl mx-auto">
            <div className="flex items-center gap-2 text-sm text-teal-700 dark:text-teal-400 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">Email me my results</span>
            </div>
            <input
              type="email"
              value={emailForResults}
              onChange={(e) => setEmailForResults(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 w-full sm:w-auto px-3 py-1.5 text-sm rounded-lg border border-teal-200 dark:border-teal-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={emailSubmitting}
              className="px-4 py-1.5 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {emailSubmitting ? 'Sending...' : 'Send'}
            </button>
          </form>
        </div>
      )}
      {emailSubmitted && (
        <div className="px-4 sm:px-6 lg:px-8 py-2.5 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-800 text-center">
          <span className="text-sm text-teal-700 dark:text-teal-400 font-medium">Results sent! Check your inbox.</span>
        </div>
      )}

      {/* Email Gate Modal for Free PDF */}
      {showEmailGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm" onClick={() => setShowEmailGate(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-xs sm:max-w-sm w-full p-4 sm:p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Download Your PDF Report</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Enter your email to receive the PDF and get weekly deal insights.</p>
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <input
                type="email"
                value={emailForResults}
                onChange={(e) => setEmailForResults(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                aria-label="Email address"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={emailSubmitting}
                className="w-full py-2.5 text-sm font-semibold bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50"
              >
                {emailSubmitting ? 'Processing...' : 'Get PDF Report'}
              </button>
            </form>
            <button onClick={() => setShowEmailGate(false)} aria-label="Close dialog" className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 lg:p-8 xl:p-10 bg-gradient-subtle">
        {/* Deal Structure Recommendation */}
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 lg:p-5 xl:p-6 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl border border-teal-200 dark:border-teal-800">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-soft flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-navy-800 dark:text-white mb-1 text-sm sm:text-base">Recommended Deal Structure{dtl ? ` — ${dtl.dealTypeDisplay}` : ''}</h4>
              <p className="text-base sm:text-lg font-semibold text-teal-700 dark:text-teal-400">
                {dtl?.recommendationPrefix || `${dealRecommendation.upfrontPercent}% Upfront / ${dealRecommendation.milestonePercent}% Milestones`}
              </p>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-slate-400 mt-1">{dealRecommendation.rationale}</p>
            </div>
          </div>
        </div>

        {/* Applied Modifiers - Horizontal scroll on mobile */}
        {modifiers.length > 0 && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 lg:p-5 xl:p-6 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-600 shadow-inner-soft">
            <div className="flex items-center gap-2 mb-2.5 sm:mb-3">
              <svg className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <p className="text-xs sm:text-sm font-semibold text-neutral-700 dark:text-slate-200">Applied Adjustments</p>
              {modifiers.length > 2 && (
                <span className="sm:hidden text-xs text-neutral-400 dark:text-slate-500 ml-auto flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Scroll
                </span>
              )}
            </div>
            {/* Mobile: horizontal scroll, Desktop: wrap */}
            <div className="flex sm:flex-wrap gap-2 overflow-x-auto sm:overflow-visible hide-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
              {modifiers.map((mod, idx) => (
                <div key={idx} className="group relative flex-shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-help ${
                      mod.multiplier > 1
                        ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30'
                        : mod.multiplier < 1
                        ? 'bg-warning-50 dark:bg-amber-500/20 text-warning-700 dark:text-amber-300 border border-warning-200 dark:border-amber-500/30'
                        : 'bg-neutral-50 dark:bg-slate-700 text-neutral-700 dark:text-slate-300 border border-neutral-200 dark:border-slate-600'
                    }`}
                  >
                    {mod.multiplier > 1 ? (
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    ) : mod.multiplier < 1 ? (
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    ) : null}
                    <span className="whitespace-nowrap">{mod.name}</span>
                    {mod.multiplier !== 1 && (
                      <span className="font-bold whitespace-nowrap">
                        ({mod.multiplier > 1 ? '+' : ''}{Math.round((mod.multiplier - 1) * 100)}%)
                      </span>
                    )}
                  </span>
                  {/* Tooltip with context */}
                  {mod.context && (
                    <div className="invisible group-hover:visible sm:group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-navy-800 dark:bg-slate-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[100] shadow-xl min-w-[200px] max-w-[280px] text-center leading-relaxed whitespace-normal hidden sm:block">
                      {mod.context}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-navy-800 dark:border-t-slate-700" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expandable hint for free users */}
        {!hasFullAccess && (
          <div className="mb-4 flex items-center gap-2 text-xs text-neutral-500 dark:text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Click on {dtl?.upfrontLabel || 'Upfront Payment'} to see detailed breakdown. Get Full Report for complete analysis.</span>
          </div>
        )}

        {/* Guardrail Warnings Banner */}
        {result.warnings && result.warnings.some((w: GuardrailWarning) => w.severity === 'critical') && (
          <div className="mb-4 rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">Output sanity check flagged potential issues</p>
                <ul className="mt-1 space-y-0.5 text-amber-700 dark:text-amber-400 text-xs">
                  {result.warnings.filter((w: GuardrailWarning) => w.severity === 'critical').map((w: GuardrailWarning, i: number) => (
                    <li key={i}>{w.message}{w.suggestedAction ? ` ${w.suggestedAction}` : ''}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Deal Summary Strip -- compact single-row overview (Pro/Report only) */}
        {hasFullAccess && <div className="mb-3 sm:mb-4 rounded-lg border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="flex flex-wrap items-center divide-x divide-neutral-200 dark:divide-slate-600">
            {[
              { label: dtl?.upfrontLabel || 'Upfront', value: formatCurrency(terms.upfront.median) },
              { label: 'Milestones', value: formatCurrency(terms.devMilestones.median + terms.regMilestones.median + terms.commMilestones.median) },
              { label: 'Royalty', value: `${tieredRoyalties.base.low}-${tieredRoyalties.highTier.high}%` },
              { label: dtl?.totalValueLabel || 'Total', value: formatCurrency(terms.totalDealValue.median) },
              ...(financialModel ? [{ label: 'rNPV', value: formatCurrency(financialModel.rnpv.riskAdjustedNPV) }] : []),
              ...(financialModel ? [{ label: 'PoS', value: `${(financialModel.rnpv.cumulativePoS * 100).toFixed(0)}%` }] : []),
            ].map((item, idx) => (
              <div key={idx} className="flex-1 min-w-[80px] px-2 sm:px-3 py-2 text-center">
                <p className="text-[10px] sm:text-xs text-neutral-500 dark:text-slate-400 uppercase tracking-wider leading-tight">{item.label}</p>
                <p className="font-mono text-sm sm:text-base font-bold text-neutral-900 dark:text-white leading-tight mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>}

        {/* Scenario Bridge Summary (Pro/Report only) */}
        {hasFullAccess && financialModel?.defensiveAnalysis && (
          <div className="mb-3 sm:mb-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm font-mono">
            <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-slate-700 text-neutral-700 dark:text-slate-300 border border-neutral-200 dark:border-slate-600">
              Base <span className="font-bold">{formatCurrency(financialModel.rnpv.riskAdjustedNPV)}</span>
            </span>
            <span className="px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
              Bear <span className="font-bold">{formatCurrency(financialModel.defensiveAnalysis.worstCase.adjustedRNPV)}</span>
              <span className="ml-1 opacity-75">({financialModel.defensiveAnalysis.worstCase.impactPercent > 0 ? '+' : ''}{financialModel.defensiveAnalysis.worstCase.impactPercent.toFixed(0)}%)</span>
            </span>
            <span className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              Bull <span className="font-bold">{formatCurrency(financialModel.defensiveAnalysis.bestCase.adjustedRNPV)}</span>
              <span className="ml-1 opacity-75">(+{financialModel.defensiveAnalysis.bestCase.impactPercent.toFixed(0)}%)</span>
            </span>
          </div>
        )}

        {/* Deal Terms Grid */}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-5 xl:gap-6">
          {/* Upfront Payment */}
          <MetricCard
            title={dtl?.upfrontLabel || 'Upfront Payment'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            value={formatRange(terms.upfront)}
            expected={formatCurrency(terms.upfront.median)}
            expectedColor="text-teal-600"
            badge={metricBadges.upfront.label}
            badgeColor={metricBadges.upfront.color}
            progressWidth={getBarWidth(terms.upfront.median, maxTotalValue)}
            progressColor="bg-gradient-to-r from-teal-500 to-cyan-500"
            drillDown={drillDown?.upfront}
            isExpanded={expandedCard === 'upfront'}
            onToggle={() => toggleCard('upfront')}
            canExpand={canExpandCard('upfront')}
            isPro={isPro}
            onProClick={() => handleProFeatureClick('comparable_deals')}
            animationIndex={0}
            tooltipContent={metricTooltips.upfront}
            contextLine={contextLines.upfront}
            previousValue={previousTerms?.upfront}
            currentValue={terms.upfront.median}
            warningText={fieldWarnings['upfront']}
          />

          {/* Total Deal Value */}
          <MetricCard
            title={dtl?.totalValueLabel || 'Total Deal Value'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            value={formatRange(terms.totalDealValue)}
            expected={formatCurrency(terms.totalDealValue.median)}
            expectedColor="text-success-600"
            badge={metricBadges.totalDealValue.label}
            badgeColor={metricBadges.totalDealValue.color}
            progressWidth={getBarWidth(terms.totalDealValue.median, maxTotalValue)}
            progressColor="bg-gradient-to-r from-success-500 to-success-400"
            drillDown={drillDown?.totalDealValue}
            isExpanded={expandedCard === 'totalDealValue'}
            onToggle={() => toggleCard('totalDealValue')}
            canExpand={canExpandCard('totalDealValue')}
            isPro={isPro}
            onProClick={() => handleProFeatureClick('comparable_deals')}
            animationIndex={1}
            tooltipContent={metricTooltips.totalDealValue}
            contextLine={contextLines.totalDealValue}
            previousValue={previousTerms?.totalDealValue}
            currentValue={terms.totalDealValue.median}
            warningText={fieldWarnings['totalDealValue']}
          />

          {/* Development Milestones */}
          <MetricCard
            title={dtl?.devMilestoneLabel || 'Development Milestones'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            }
            value={formatRange(terms.devMilestones)}
            expected={formatCurrency(terms.devMilestones.median)}
            expectedColor="text-neutral-700"
            badge={metricBadges.devMilestones.label}
            badgeColor={metricBadges.devMilestones.color}
            progressWidth={getBarWidth(terms.devMilestones.median, maxTotalValue)}
            progressColor="bg-gradient-to-r from-cyan-500 to-cyan-400"
            drillDown={drillDown?.devMilestones}
            isExpanded={expandedCard === 'devMilestones'}
            onToggle={() => toggleCard('devMilestones')}
            canExpand={canExpandCard('devMilestones')}
            isPro={isPro}
            onProClick={() => handleProFeatureClick('comparable_deals')}
            animationIndex={2}
            tooltipContent={metricTooltips.devMilestones}
            previousValue={previousTerms?.devMilestones}
            currentValue={terms.devMilestones.median}
            warningText={fieldWarnings['devMilestones'] || fieldWarnings['milestones']}
          />

          {/* Regulatory Milestones */}
          <MetricCard
            title={dtl?.regMilestoneLabel || 'Regulatory Milestones'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
            value={formatRange(terms.regMilestones)}
            expected={formatCurrency(terms.regMilestones.median)}
            expectedColor="text-neutral-700"
            badge={metricBadges.regMilestones.label}
            badgeColor={metricBadges.regMilestones.color}
            progressWidth={getBarWidth(terms.regMilestones.median, maxTotalValue)}
            progressColor="bg-gradient-to-r from-teal-500 to-teal-400"
            drillDown={drillDown?.regMilestones}
            isExpanded={expandedCard === 'regMilestones'}
            onToggle={() => toggleCard('regMilestones')}
            canExpand={canExpandCard('regMilestones')}
            isPro={isPro}
            onProClick={() => handleProFeatureClick('comparable_deals')}
            animationIndex={3}
            tooltipContent={metricTooltips.regMilestones}
            previousValue={previousTerms?.regMilestones}
            currentValue={terms.regMilestones.median}
            warningText={fieldWarnings['regMilestones']}
          />

          {/* Commercial Milestones */}
          <MetricCard
            title={dtl?.commMilestoneLabel || 'Commercial Milestones'}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            value={formatRange(terms.commMilestones)}
            expected={formatCurrency(terms.commMilestones.median)}
            expectedColor="text-neutral-700"
            badge={metricBadges.commMilestones.label}
            badgeColor={metricBadges.commMilestones.color}
            progressWidth={getBarWidth(terms.commMilestones.median, maxTotalValue)}
            progressColor="bg-gradient-to-r from-cyan-500 to-cyan-400"
            drillDown={drillDown?.commMilestones}
            isExpanded={expandedCard === 'commMilestones'}
            onToggle={() => toggleCard('commMilestones')}
            canExpand={canExpandCard('commMilestones')}
            isPro={isPro}
            onProClick={() => handleProFeatureClick('comparable_deals')}
            animationIndex={4}
            tooltipContent={metricTooltips.commMilestones}
            previousValue={previousTerms?.commMilestones}
            currentValue={terms.commMilestones.median}
            warningText={fieldWarnings['commMilestones']}
          />

          {/* Tiered Royalties */}
          <div
            className={`group metric-card border-neutral-200 dark:border-slate-600 hover:border-teal-200 dark:hover:border-teal-500/50 transition-all duration-300 ${expandedCard === 'royalties' ? 'ring-2 ring-teal-200 dark:ring-teal-500/50' : ''} motion-safe:animate-metric-cascade`}
            style={{ animationDelay: '500ms' }}
          >
            <div
              className={canExpandCard('royalties') ? 'cursor-pointer' : ''}
              onClick={() => {
                if (canExpandCard('royalties')) {
                  toggleCard('royalties');
                } else {
                  handleProFeatureClick('comparable_deals');
                }
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 bg-teal-50 dark:bg-teal-500/20 flex items-center justify-center transition-colors group-hover:bg-teal-100 dark:group-hover:bg-teal-500/30">
                    <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-neutral-700 dark:text-slate-200 truncate">
                    {dtl?.royaltyLabel || 'Tiered Royalties'}
                    <InfoTooltip content={metricTooltips.royalties} />
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300">
                    {metricBadges.royalties.label}
                  </span>
                  {canExpandCard('royalties') ? (
                    <svg
                      className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${expandedCard === 'royalties' ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  ) : (
                    <div className="p-1 bg-navy-100 dark:bg-slate-600 rounded">
                      <svg className="w-3 h-3 text-navy-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600 dark:text-slate-300">Base (&lt;$500M)</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{tieredRoyalties.base.low}% - {tieredRoyalties.base.high}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600 dark:text-slate-300">Mid ($500M-$1B)</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{tieredRoyalties.midTier.low}% - {tieredRoyalties.midTier.high}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-600 dark:text-slate-300">High (&gt;$1B)</span>
                  <span className="font-bold text-neutral-900 dark:text-white">{tieredRoyalties.highTier.low}% - {tieredRoyalties.highTier.high}%</span>
                </div>
              </div>
              {fieldWarnings['royalties'] && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span>{fieldWarnings['royalties']}</span>
                </div>
              )}
            </div>

            {/* Drill-down panel for royalties */}
            {expandedCard === 'royalties' && drillDown?.royalties && (
              <DrillDownPanel data={drillDown.royalties} isRoyalty={true} />
            )}
          </div>
        </div>

        {/* Inline Comparable Deals (top 3, compact — Pro/Report only) */}
        {hasFullAccess && fullInputs && (() => {
          const topDeals = findComparableDeals(
            { therapeuticArea: fullInputs.therapeuticArea, modality: fullInputs.modality, indication: fullInputs.indication, phase: fullInputs.phase, dealType: fullInputs.dealType },
            3
          );
          if (topDeals.length === 0) return null;
          return (
            <div className="mt-3 sm:mt-4 rounded-lg border border-neutral-200 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-800">
              <div className="px-3 py-2 bg-neutral-50 dark:bg-slate-700/50 border-b border-neutral-200 dark:border-slate-600">
                <p className="text-xs font-semibold text-neutral-600 dark:text-slate-300 uppercase tracking-wider">Top Comparable Deals</p>
              </div>
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-slate-700 text-neutral-500 dark:text-slate-400">
                    <th className="text-left px-3 py-1.5 font-medium">Parties</th>
                    <th className="text-right px-3 py-1.5 font-medium font-mono">Value</th>
                    <th className="text-right px-3 py-1.5 font-medium font-mono">Year</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
                  {topDeals.map((d) => (
                    <tr key={d.id} className="hover:bg-neutral-50 dark:hover:bg-slate-700/50">
                      <td className="px-3 py-1.5 text-neutral-800 dark:text-slate-200 truncate max-w-[200px]">{d.parties}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold text-neutral-900 dark:text-white">{d.totalValue}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-neutral-600 dark:text-slate-400">{d.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* Interactive Charts Section */}
        <ChartSection
          terms={terms}
          tieredRoyalties={tieredRoyalties}
          modifiers={modifiers}
          isPro={hasFullAccess}
          onUpgrade={onUpgrade}
          dealTypeLabels={dealTypeLabels}
        />

        {/* Market Urgency - Patent Cliff Signal */}
        {partnerMatches.length > 0 && (
          <MarketUrgency
            partnerMatches={partnerMatches}
            therapeuticArea={fullInputs?.therapeuticArea}
            isPro={hasFullAccess}
            onUpgrade={onUpgrade}
            onBuyReport={onBuyReport}
          />
        )}

        {/* Therapeutic Area Milestone Explanation */}
        {result.milestoneExplanation && (
          <div className="mt-6 p-4 sm:p-5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800/50 rounded-xl">
            <h4 className="text-sm font-bold text-purple-900 dark:text-purple-200 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {fullInputs?.therapeuticArea === 'immunology' ? 'Why Immunology Deal Structures Differ'
                : fullInputs?.therapeuticArea === 'metabolic' ? 'Why Metabolic/Obesity Deal Structures Differ'
                : fullInputs?.therapeuticArea === 'oncology' ? 'Why Oncology Deal Structures Differ'
                : fullInputs?.therapeuticArea === 'cardiovascular' ? 'Why Cardiovascular Deal Structures Differ'
                : fullInputs?.therapeuticArea === 'infectiousDisease' ? 'Why Infectious Disease Deal Structures Differ'
                : fullInputs?.therapeuticArea === 'ophthalmology' ? 'Why Ophthalmology Deal Structures Differ'
                : fullInputs?.therapeuticArea === 'womensHealth' ? "Why Women's Health Deal Structures Differ"
                : 'Why Neurology Deal Structures Differ'}
            </h4>
            <p className="text-sm text-purple-800 dark:text-purple-300 leading-relaxed">
              {result.milestoneExplanation}
            </p>
          </div>
        )}

        {/* Sensitivity Analysis */}
        {fullInputs && onApplyNewInputs && (
          <FinancialErrorBoundary fallbackTitle="Sensitivity Analysis unavailable">
            <SensitivityAnalysis
              currentInputs={fullInputs}
              currentResult={result}
              onApplyChanges={onApplyNewInputs}
              tier={tier}
              onUpgrade={onUpgrade}
              onBuyReport={onBuyReport}
            />
          </FinancialErrorBoundary>
        )}

        {/* Tornado Sensitivity Chart (dollar-impact) */}
        {hasFullAccess && financialModel && (
          tornadoSensitivities && tornadoSensitivities.length > 0 ? (
            <FinancialErrorBoundary fallbackTitle="Tornado Chart unavailable">
              <TornadoChart
                baseValue={financialModel.rnpv.riskAdjustedNPV}
                sensitivities={tornadoSensitivities}
              />
            </FinancialErrorBoundary>
          ) : financialModel.rnpv.riskAdjustedNPV <= 0 ? (
            <div className="mt-6 sm:mt-8 border border-neutral-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
              <div className="px-4 py-3 bg-neutral-50 dark:bg-slate-700/50 border-b border-neutral-200 dark:border-slate-600">
                <h3 className="text-sm font-semibold text-neutral-800 dark:text-slate-200">Sensitivity Impact (Tornado Chart)</h3>
              </div>
              <div className="p-4 text-center text-xs text-neutral-500 dark:text-slate-400">
                <p>Tornado sensitivity analysis is not available for this combination.</p>
                <p className="mt-1">The risk-adjusted NPV is negative (${financialModel.rnpv.riskAdjustedNPV.toFixed(0)}M), indicating development costs exceed probability-weighted revenue at this stage.</p>
              </div>
            </div>
          ) : null
        )}

        {/* Comparable Deals */}
        {fullInputs && (
          <FinancialErrorBoundary fallbackTitle="Comparable Deals unavailable">
            <ComparableDeals inputs={fullInputs} tier={tier} onBuyReport={onBuyReport} />
          </FinancialErrorBoundary>
        )}

        {/* Pipeline Intelligence — Clinical Trials */}
        {fullInputs && (
          <FinancialErrorBoundary fallbackTitle="Pipeline Intelligence unavailable">
            <PipelineIntelligence
              therapeuticArea={fullInputs.therapeuticArea}
              modality={fullInputs.modality}
              tier={tier}
              onUpgrade={onUpgrade}
              onBuyReport={onBuyReport}
            />
          </FinancialErrorBoundary>
        )}

        {/* Financial Modeling — World-Class Tier */}
        {financialModel && (
          <>
            <FinancialErrorBoundary fallbackTitle="rNPV Analysis unavailable">
              <RnpvAnalysis
                rnpvResult={financialModel.rnpv}
                benchmarkMedian={result.terms.totalDealValue.median}
                tier={tier || 'free'}
                onUpgrade={onUpgrade}
                onBuyReport={onBuyReport}
              />
            </FinancialErrorBoundary>
            <FinancialErrorBoundary fallbackTitle="Monte Carlo Analysis unavailable">
              <MonteCarloResults
                monteCarloResult={financialModel.monteCarlo}
                tier={tier || 'free'}
                onUpgrade={onUpgrade}
                onBuyReport={onBuyReport}
              />
            </FinancialErrorBoundary>
            <FinancialErrorBoundary fallbackTitle="Market Size Analysis unavailable">
              <MarketSizePanel
                marketSize={financialModel.marketSize ?? undefined}
                tier={tier || 'free'}
                onUpgrade={onUpgrade}
                onBuyReport={onBuyReport}
              />
            </FinancialErrorBoundary>
            <FinancialErrorBoundary fallbackTitle="Scenario Analysis unavailable">
              <ScenarioPlanner
                scenarios={financialModel.scenarios}
                defensiveAnalysis={financialModel.defensiveAnalysis}
                tier={tier || 'free'}
                onUpgrade={onUpgrade}
                onBuyReport={onBuyReport}
              />
            </FinancialErrorBoundary>
            <FinancialErrorBoundary fallbackTitle="Competitive Landscape unavailable">
              <CompetitiveLandscapePanel
                landscape={serverData.competitiveLandscape}
                tier={tier || 'free'}
                onUpgrade={onUpgrade}
                onBuyReport={onBuyReport}
              />
            </FinancialErrorBoundary>
            <FinancialErrorBoundary fallbackTitle="Deal Flow Forecast unavailable">
              <DealFlowForecastPanel
                forecast={serverData.dealFlowForecast}
                tier={tier || 'free'}
                onUpgrade={onUpgrade}
                onBuyReport={onBuyReport}
              />
            </FinancialErrorBoundary>
          </>
        )}

        {/* AI Deal Memo */}
        <FinancialErrorBoundary fallbackTitle="Deal Memo unavailable">
          <DealMemoSection
            hasFullAccess={hasFullAccess}
            dealMemo={dealMemo}
            memoLoading={memoLoading}
            memoError={memoError}
            onGenerateMemo={handleGenerateMemo}
            onBuyReport={onBuyReport}
          />
        </FinancialErrorBoundary>

        {/* Partner Matches */}
        {inputs && (
          <div className="mb-4 sm:mb-6">
            <FinancialErrorBoundary fallbackTitle="Partner Matches unavailable">
              <PartnerMatchesContainer
                modality={inputs.modality}
                phase={inputs.phase}
                indicationCategory={getIndicationCategory(inputs.indication)}
                indicationSpecific={inputs.indication}
                territory={inputs.territory}
                therapeuticArea={fullInputs?.therapeuticArea}
                regulatoryDesignations={fullInputs?.regulatoryDesignations}
                tier={tier}
                onUpgrade={onUpgrade || (() => {})}
                onMatchesLoaded={handlePartnerMatchesLoaded}
              />
            </FinancialErrorBoundary>
          </div>
        )}

        {/* Negotiation Insight - Pro Feature */}
        <div className="relative mb-4 sm:mb-6">
          <div className={`p-3 sm:p-4 lg:p-5 xl:p-6 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200 ${!hasFullAccess ? 'blur-sm' : ''}`}>
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-soft flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-amber-800 mb-1 text-sm sm:text-base">Negotiation Insight</h4>
                <p className="text-xs sm:text-sm text-amber-900">{negotiationInsight}</p>
              </div>
            </div>
          </div>
          {!hasFullAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() => onBuyReport ? onBuyReport() : handleProFeatureClick('comparable_deals')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Unlock Full Analysis
              </button>
            </div>
          )}
        </div>

        {/* Negotiation Playbook CTA */}
        <div className="relative mt-6 sm:mt-8">
          <div className={`p-4 sm:p-6 bg-gradient-to-r from-navy-800 to-navy-900 rounded-xl ${!hasFullAccess ? 'blur-sm pointer-events-none' : ''}`}>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-glow flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h4 className="text-lg font-bold text-white mb-1">Negotiation Playbook</h4>
                <p className="text-neutral-300 text-sm">
                  Get strategic talking points tailored to your asset profile and market position
                </p>
              </div>
              <button
                onClick={() => setShowPlaybookModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-glow whitespace-nowrap"
              >
                Generate Playbook
              </button>
            </div>
          </div>
          {!hasFullAccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 rounded-xl">
              <button
                onClick={() => onBuyReport ? onBuyReport() : handleProFeatureClick('negotiation_playbook')}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg shadow-soft hover:shadow-glow transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Unlock Full Analysis
              </button>
            </div>
          )}
        </div>

        {/* Scenario Comparison (Pro/Report) */}
        {hasFullAccess && (
          <ScenarioComparison
            currentResult={result}
            currentInputs={inputs}
            currentLabels={labels}
          />
        )}

        {/* Compare with Previous - History-based comparison */}
        <div ref={comparisonRef}>
          {compareItem && (
            <ScenarioComparisonPanel
              currentResult={result}
              compareItem={compareItem}
              compareLabel={compareLabel}
              onClose={() => setCompareItem(null)}
            />
          )}
        </div>

        {/* History Picker Modal */}
        {showHistoryPicker && (
          <HistoryPicker
            onSelect={(item) => {
              setCompareItem(item);
              setShowHistoryPicker(false);
            }}
            onClose={() => setShowHistoryPicker(false)}
          />
        )}

        {/* Share Modal */}
        {inputs && (
          <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            inputs={inputs}
            results={result}
            labels={labels}
          />
        )}

        {/* Negotiation Playbook Modal */}
        {inputs && (
          <NegotiationPlaybookModal
            isOpen={showPlaybookModal}
            onClose={() => setShowPlaybookModal(false)}
            inputs={{ ...inputs, therapeuticArea: fullInputs?.therapeuticArea }}
            results={result}
            labels={labels}
            userId={userId}
            userEmail={userEmail}
            reportId={reportId}
          />
        )}

        {/* Report Generation Modal */}
        {fullInputs && (
          <ReportGenerationModal
            isOpen={showReportModal}
            onClose={() => setShowReportModal(false)}
            result={result}
            fullInputs={fullInputs}
            partnerMatches={partnerMatches}
            existingMemo={dealMemo}
            reportId={reportId}
            userId={userId}
            userEmail={userEmail}
            labels={labels}
            onMemoGenerated={(memo) => setDealMemo(memo)}
            onDownloadComplete={() => setToast({ message: 'Report downloaded successfully', type: 'success' })}
            format={reportFormat}
          />
        )}

        {/* Success Toast */}
        {toast && (
          <div
            className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 left-4 sm:left-auto z-50 flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl shadow-2xl max-w-sm ${toast ? 'animate-toast-in' : 'animate-toast-out'}`}
            role="status"
            onAnimationEnd={() => {
              setTimeout(() => setToast(null), 3000);
            }}
          >
            <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.5L6.5 12L13 4" />
              </svg>
            </div>
            <span className="text-sm font-medium text-neutral-800 dark:text-white">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-slate-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Upgrade CTA for Free Users */}
        {!hasFullAccess && (
          <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gradient-to-r from-navy-800 to-navy-900 rounded-xl text-center">
            <h4 className="text-base sm:text-lg font-bold text-white mb-2">Unlock Full Analysis</h4>
            <p className="text-neutral-300 text-xs sm:text-sm mb-4 sm:mb-5 max-w-md mx-auto">
              AI deal memo, full comparable deals, sensitivity analysis, negotiation playbook, and board-ready PDF
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => onBuyReport?.()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 bg-white text-navy-900 text-sm font-semibold rounded-xl hover:bg-neutral-100 transition-all shadow-soft w-full sm:w-auto"
              >
                <span>Get Full Report — {PRICING.REPORT_PRICE}</span>
              </button>
              <span className="text-neutral-500 text-xs">or</span>
              <button
                onClick={handleUpgradeClick}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-glow w-full sm:w-auto"
              >
                <span>Go Pro — {PRICING.PRO_MONTHLY}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Methodology Section */}
        <MethodologySection />

        {/* Data Freshness Indicator */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Benchmarks last updated{' '}
            {(() => {
              const [y, m] = (benchmarks.metadata.lastUpdated as string).split('-');
              const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              return `${monthNames[parseInt(m, 10) - 1]} ${y}`;
            })()}
            {' '}&middot;{' '}350+ curated deals across 12 therapeutic areas{' '}&middot;{' '}Refreshed daily via SEC EDGAR
          </p>
        </div>

        {/* World-Class Disclaimer */}
        <ResultsDisclaimer />
      </div>
    </div>
  );
}
