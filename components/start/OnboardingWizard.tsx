'use client';

/**
 * Guided onboarding wizard — translates plain-English questions into the
 * calculator's technical inputs. Six steps, progress bar, optional skip.
 *
 * State is held in component memory + serialized to URL search params on
 * the final step so the answers survive a redirect to /calculator and can
 * be shared as a deep link.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Choice {
  value: string;
  label: string;
  description?: string;
}

type StepId = 'stage' | 'kind' | 'area' | 'positioning' | 'commercial' | 'review';

interface OnboardingState {
  phase: string;
  modality: string;
  therapeuticArea: string;
  competitivePosition: string;
  dataQuality: string;
  peakSalesM: number;
}

const INITIAL: OnboardingState = {
  phase: '',
  modality: '',
  therapeuticArea: '',
  competitivePosition: '',
  dataQuality: '',
  peakSalesM: 1500,
};

const STAGE_CHOICES: Choice[] = [
  { value: 'preclinical', label: 'Still in lab', description: 'Preclinical / IND-enabling work' },
  { value: 'phase1', label: 'In humans, safety stage', description: 'Phase 1 — testing in healthy volunteers or first patients' },
  { value: 'phase2', label: 'In humans, signal stage', description: 'Phase 2 — proof of concept, early efficacy' },
  { value: 'phase3', label: 'Pivotal trial', description: 'Phase 3 — registration-enabling, large efficacy study' },
  { value: 'nda_filed', label: 'Filed for approval', description: 'NDA / BLA submitted to FDA' },
  { value: 'approved', label: 'On the market', description: 'Approved and being sold' },
];

const KIND_CHOICES: Choice[] = [
  { value: 'smallMolecule', label: 'Small molecule pill', description: 'Oral chemistry — chemicals taken by mouth' },
  { value: 'mab', label: 'Antibody (monoclonal)', description: 'Injectable mAb' },
  { value: 'bispecific', label: 'Bispecific antibody', description: 'Two-target antibody' },
  { value: 'adc', label: 'Antibody-drug conjugate', description: 'Antibody + cytotoxic payload' },
  { value: 'peptide', label: 'Peptide / hormone analog', description: 'Like GLP-1 agonists' },
  { value: 'rnai', label: 'RNA interference (siRNA)', description: 'Like Alnylam-class' },
  { value: 'mrna', label: 'mRNA therapeutic', description: 'Like Moderna / BioNTech vaccines' },
  { value: 'geneTherapy', label: 'Gene therapy', description: 'AAV / lentiviral one-time treatment' },
  { value: 'cellTherapy', label: 'Cell therapy', description: 'CAR-T or TIL approach' },
  { value: 'protac', label: 'PROTAC / molecular glue', description: 'Targeted protein degrader' },
];

const TA_CHOICES: Choice[] = [
  { value: 'oncology', label: 'Cancer', description: 'Oncology — solid tumors, hematology malignancies' },
  { value: 'neurology', label: 'Brain & nervous system', description: 'Neurology — Alzheimer\'s, MS, ALS, Parkinson\'s' },
  { value: 'immunology', label: 'Autoimmune & inflammation', description: 'IBD, RA, atopic dermatitis, psoriasis' },
  { value: 'metabolic', label: 'Metabolic / endocrine', description: 'Diabetes, obesity, NASH, cardiometabolic' },
  { value: 'cardiovascular', label: 'Heart & vasculature', description: 'CV risk, heart failure, lipid disorders' },
  { value: 'rareDisease', label: 'Rare / orphan disease', description: 'Cystic fibrosis, DMD, lysosomal disorders' },
  { value: 'infectiousDisease', label: 'Infections', description: 'Antivirals, antibacterials, antifungals' },
  { value: 'ophthalmology', label: 'Eye disease', description: 'AMD, glaucoma, dry eye, diabetic retinopathy' },
  { value: 'hematology', label: 'Blood disorders', description: 'Anemia, hemophilia, sickle cell, ITP' },
  { value: 'dermatology', label: 'Skin', description: 'Atopic dermatitis, vitiligo, alopecia, acne' },
  { value: 'gastroenterology', label: 'Gut', description: 'IBD, Crohn\'s, UC, eosinophilic esophagitis' },
  { value: 'womensHealth', label: 'Women\'s health', description: 'Endometriosis, fibroids, contraception, menopause' },
];

const POSITIONING_CHOICES: Choice[] = [
  { value: 'firstInClass', label: 'First-in-class', description: 'Novel mechanism, no approved competition' },
  { value: 'bestInClass', label: 'Best-in-class', description: 'Approved class exists; we beat the leader on efficacy or safety' },
  { value: 'racing', label: 'Racing', description: 'Multiple programs in development, competitive pivotal trials' },
  { value: 'follower', label: 'Follower', description: 'Late entrant into an established class' },
  { value: 'crowded', label: 'Crowded', description: '5+ approved drugs in the class' },
];

const COMMERCIAL_CHOICES: Choice[] = [
  { value: 'pivotalReady', label: 'Pivotal-ready data', description: 'Phase 3 / pivotal data supports filing' },
  { value: 'strongPhase2', label: 'Strong Phase 2', description: 'Significant efficacy + manageable safety' },
  { value: 'promising', label: 'Promising early signal', description: 'Encouraging Phase 1/early Phase 2 data' },
  { value: 'mixed', label: 'Mixed data', description: 'Some efficacy with safety questions or trial design issues' },
];

interface ReviewItemProps {
  label: string;
  value: string;
}

function ReviewItem({ label, value }: ReviewItemProps) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-800/60 py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

function ChoiceGrid({
  choices,
  selected,
  onSelect,
}: {
  choices: Choice[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {choices.map((c) => {
        const active = selected === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onSelect(c.value)}
            className={[
              'rounded-lg border p-4 text-left transition-colors',
              active
                ? 'border-teal-500/50 bg-teal-500/10 text-slate-100'
                : 'border-slate-700/50 bg-slate-900/30 text-slate-300 hover:border-slate-600 hover:bg-slate-900/50',
            ].join(' ')}
          >
            <div className="font-medium">{c.label}</div>
            {c.description && (
              <div className="mt-1 text-xs text-slate-500">{c.description}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  initial?: Partial<OnboardingState>;
  skipToReview?: boolean;
}

export function OnboardingWizard({ initial = {}, skipToReview = false }: Props) {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>({ ...INITIAL, ...initial });
  const [step, setStep] = useState<StepId>(skipToReview ? 'review' : 'stage');

  const stepOrder: StepId[] = ['stage', 'kind', 'area', 'positioning', 'commercial', 'review'];
  const currentIdx = stepOrder.indexOf(step);
  const progress = ((currentIdx) / (stepOrder.length - 1)) * 100;

  const set = (patch: Partial<OnboardingState>) =>
    setState((s) => ({ ...s, ...patch }));

  const canAdvance = useMemo(() => {
    switch (step) {
      case 'stage': return !!state.phase;
      case 'kind': return !!state.modality;
      case 'area': return !!state.therapeuticArea;
      case 'positioning': return !!state.competitivePosition;
      case 'commercial': return !!state.dataQuality;
      case 'review': return true;
      default: return false;
    }
  }, [step, state]);

  const advance = (next: StepId) => {
    if (!canAdvance) return;
    setStep(next);
  };

  const submit = () => {
    const params = new URLSearchParams({
      phase: state.phase,
      modality: state.modality,
      therapeuticArea: state.therapeuticArea,
      competitivePosition: state.competitivePosition,
      dataQuality: state.dataQuality,
      peakSales: String(state.peakSalesM),
      from: 'onboarding',
    });
    router.push(`/calculator?${params.toString()}`);
  };

  const headlineFor = (id: StepId): string => {
    switch (id) {
      case 'stage': return 'How far along is the program?';
      case 'kind': return 'What kind of drug is it?';
      case 'area': return 'What disease area is it for?';
      case 'positioning': return 'How does it stack up vs. competition?';
      case 'commercial': return 'How strong is the data so far?';
      case 'review': return 'Review and run the model';
    }
  };

  const subhedFor = (id: StepId): string => {
    switch (id) {
      case 'stage': return 'Pick the closest match — we use this to set risk-adjusted PoS.';
      case 'kind': return 'This drives manufacturing complexity, peak sales potential, and regulatory pathway.';
      case 'area': return 'We pull indication-specific market caps, competitive density, and patent timing from this.';
      case 'positioning': return 'First-in-class commands premium; crowded markets get peak-sales penalties.';
      case 'commercial': return 'Stronger data → higher conviction multiplier on peak sales.';
      case 'review': return 'These answers map to ~25 calculator fields. You can refine in the full calculator.';
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Progress */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>Step {currentIdx + 1} of {stepOrder.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Headline */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-100 sm:text-3xl">{headlineFor(step)}</h2>
        <p className="mt-2 text-sm text-slate-500">{subhedFor(step)}</p>
      </div>

      {/* Step body */}
      <div className="mb-8">
        {step === 'stage' && (
          <ChoiceGrid choices={STAGE_CHOICES} selected={state.phase} onSelect={(v) => set({ phase: v })} />
        )}
        {step === 'kind' && (
          <ChoiceGrid choices={KIND_CHOICES} selected={state.modality} onSelect={(v) => set({ modality: v })} />
        )}
        {step === 'area' && (
          <ChoiceGrid choices={TA_CHOICES} selected={state.therapeuticArea} onSelect={(v) => set({ therapeuticArea: v })} />
        )}
        {step === 'positioning' && (
          <ChoiceGrid choices={POSITIONING_CHOICES} selected={state.competitivePosition} onSelect={(v) => set({ competitivePosition: v })} />
        )}
        {step === 'commercial' && (
          <>
            <ChoiceGrid choices={COMMERCIAL_CHOICES} selected={state.dataQuality} onSelect={(v) => set({ dataQuality: v })} />
            <div className="mt-6 rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
              <label className="text-xs uppercase tracking-wider text-slate-500">
                Peak sales estimate (optional)
              </label>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-mono text-sm text-slate-500">$</span>
                <input
                  type="number"
                  value={state.peakSalesM}
                  onChange={(e) => set({ peakSalesM: Number(e.target.value) || 0 })}
                  className="w-32 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm text-slate-200 focus:border-teal-500 focus:outline-none"
                />
                <span className="font-mono text-sm text-slate-500">M / year at peak</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Leave at default ($1,500M) and we&rsquo;ll use the indication-specific anchor.
                Override if you have specific consensus.
              </p>
            </div>
          </>
        )}
        {step === 'review' && (
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-5">
            <ReviewItem label="Stage" value={STAGE_CHOICES.find(c => c.value === state.phase)?.label || state.phase} />
            <ReviewItem label="Drug type" value={KIND_CHOICES.find(c => c.value === state.modality)?.label || state.modality} />
            <ReviewItem label="Disease area" value={TA_CHOICES.find(c => c.value === state.therapeuticArea)?.label || state.therapeuticArea} />
            <ReviewItem label="Positioning" value={POSITIONING_CHOICES.find(c => c.value === state.competitivePosition)?.label || state.competitivePosition} />
            <ReviewItem label="Data strength" value={COMMERCIAL_CHOICES.find(c => c.value === state.dataQuality)?.label || state.dataQuality} />
            <ReviewItem label="Peak sales" value={`$${state.peakSalesM.toLocaleString()}M / year`} />
            <p className="mt-4 text-xs text-slate-500">
              You can refine indication, biomarker, regulatory designations, and other inputs in
              the full calculator after this. The wizard pre-fills the headline values.
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {currentIdx > 0 ? (
          <button
            type="button"
            onClick={() => setStep(stepOrder[currentIdx - 1])}
            className="text-sm text-slate-500 hover:text-slate-300"
          >
            ← Back
          </button>
        ) : (
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
            ← Cancel
          </Link>
        )}

        {step === 'review' ? (
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-400"
          >
            Run the model →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => advance(stepOrder[currentIdx + 1])}
            disabled={!canAdvance}
            className={[
              'rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors',
              canAdvance
                ? 'bg-teal-500 text-slate-950 hover:bg-teal-400'
                : 'cursor-not-allowed bg-slate-800 text-slate-500',
            ].join(' ')}
          >
            Continue →
          </button>
        )}
      </div>
    </div>
  );
}
