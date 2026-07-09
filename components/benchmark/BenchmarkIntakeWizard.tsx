'use client';

import { useState, useCallback, type FormEvent, type JSX } from 'react';
import { CheckCircle2, ChevronRight, Loader2, ArrowLeft } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface ModalityOption {
  abbr: string;
  label: string;
}

interface AnalysisOption {
  id: string;
  label: string;
}

/* ─── Static data ────────────────────────────────────────────────────── */

const THERAPEUTIC_AREAS = [
  'Oncology',
  'Neurology',
  'Immunology',
  'Rare Disease',
  'Cardiovascular',
  'Metabolic',
  'Hematology',
  'Ophthalmology',
  'Dermatology',
  'Infectious Disease',
  'Gastroenterology',
  "Women's Health",
] as const;

const PHASES = ['Preclinical', 'Phase 1', 'Phase 2', 'Phase 3'] as const;

const MODALITIES: ModalityOption[] = [
  { abbr: 'SM', label: 'Small Molecule' },
  { abbr: 'mAb', label: 'Monoclonal Antibody' },
  { abbr: 'ADC', label: 'Antibody-Drug Conjugate' },
  { abbr: 'BSAB', label: 'Bispecific' },
  { abbr: 'TSAB', label: 'Trispecific' },
  { abbr: 'GT', label: 'Gene Therapy' },
  { abbr: 'RNAi', label: 'RNA Interference' },
  { abbr: 'PEP', label: 'Peptide' },
  { abbr: 'ASO', label: 'Antisense Oligonucleotide' },
  { abbr: 'BBB', label: 'BBB Platform' },
  { abbr: 'mRNA', label: 'mRNA' },
  { abbr: 'TAU', label: 'Tau-Targeting' },
  { abbr: 'SC', label: 'Stem Cell' },
];

const DEAL_TYPES = ['Licensing', 'Option', 'Co-Development', 'M&A / Acquisition'] as const;

const ANALYSES: AnalysisOption[] = [
  { id: 'trispecific', label: 'Trispecific antibody deep-dive' },
  { id: 'delivery', label: 'Delivery route & device strategy' },
  { id: 'stage-split', label: 'Preclinical vs IND-stage split' },
  { id: 'cvr', label: 'CVR & earnout valuation' },
  { id: 'royalty', label: 'Royalty stacking analysis' },
  { id: 'patent', label: 'Patent & LOE dynamics' },
];

/* ─── Step indicator ─────────────────────────────────────────────────── */

const STEP_LABELS = ['Define Scope', 'Configure', 'Schedule'] as const;

function StepIndicator({ currentStep }: { currentStep: number }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={label} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  isCompleted
                    ? 'bg-teal-600 text-white'
                    : isActive
                      ? 'bg-teal-600 text-white ring-4 ring-teal-600/20'
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium whitespace-nowrap ${
                  isActive || isCompleted
                    ? 'text-teal-700 dark:text-teal-400'
                    : 'text-gray-400 dark:text-slate-500'
                }`}
              >
                {label}
              </span>
            </div>
            {/* Connector line */}
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`w-16 sm:w-24 h-0.5 mx-2 mb-6 transition-colors duration-300 ${
                  stepNum < currentStep
                    ? 'bg-teal-600'
                    : 'bg-gray-200 dark:bg-slate-700'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main wizard ────────────────────────────────────────────────────── */

export default function BenchmarkIntakeWizard(): JSX.Element {
  /* Step state */
  const [step, setStep] = useState(1);

  /* Step 1 */
  const [therapeuticArea, setTherapeuticArea] = useState('');
  const [indication, setIndication] = useState('');
  const [phase, setPhase] = useState('');

  /* Step 2 */
  const [modalities, setModalities] = useState<string[]>(
    MODALITIES.map((m) => m.abbr),
  );
  const [dealTypes, setDealTypes] = useState<string[]>([...DEAL_TYPES]);
  const [analyses, setAnalyses] = useState<string[]>(
    ANALYSES.map((a) => a.id),
  );
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  /* Step 3 */
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');

  /* Submission */
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  /* ─── Helpers ──────────────────────────────────────────────────────── */

  const toggleArrayItem = useCallback(
    (arr: string[], item: string, setter: (v: string[]) => void) => {
      setter(
        arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item],
      );
    },
    [],
  );

  const calculationCount = modalities.length * dealTypes.length;
  const sectionCount =
    modalities.length + dealTypes.length + analyses.length + (whiteLabel ? 1 : 0);
  const estimatedPages = Math.max(
    20,
    Math.round(calculationCount * 0.6 + analyses.length * 4 + (whiteLabel ? 2 : 0)),
  );

  const step1Valid = therapeuticArea !== '' && indication.trim() !== '' && phase !== '';
  const step2Valid = modalities.length > 0 && dealTypes.length > 0;
  const step3Valid = name.trim() !== '' && email.trim() !== '';

  /* ─── Submit ──────────────────────────────────────────────────────── */

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!step3Valid) return;

      setSubmitting(true);
      setError('');

      try {
        const res = await fetch('/api/benchmark/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            company: company || undefined,
            title: title || undefined,
            therapeuticArea,
            indication,
            phase,
            modalities,
            dealTypes,
            analyses,
            whiteLabel,
            brandName: whiteLabel ? brandName : undefined,
            customNotes: customNotes || undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || 'Something went wrong. Please try again.');
          return;
        }

        setSubmitted(true);
      } catch {
        setError('Network error. Please check your connection and try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [
      step3Valid, name, email, company, title,
      therapeuticArea, indication, phase,
      modalities, dealTypes, analyses,
      whiteLabel, brandName, customNotes,
    ],
  );

  /* ─── Confirmed state ─────────────────────────────────────────────── */

  if (submitted) {
    return (
      <div id="wizard" className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-10">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-teal-600 dark:text-teal-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            Request Received
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-md mx-auto">
            We&apos;ll reach out within 24 hours to schedule your 15-minute intake call.
            Your Brief for <strong>{indication}</strong> ({phase}) will be customized
            based on our conversation.
          </p>
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-5 text-left text-sm text-slate-600 dark:text-slate-300 space-y-1">
            <p><span className="text-slate-400">To:</span> {email}</p>
            <p><span className="text-slate-400">Subject:</span> Your Deal Intelligence Brief &mdash; {indication} ({phase})</p>
            <p className="pt-2 text-xs text-slate-400">
              Check your inbox for a confirmation email with next steps.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Render ───────────────────────────────────────────────────────── */

  return (
    <div id="wizard" className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 sm:p-10">
        <StepIndicator currentStep={step} />

        {/* ── Step 1: Define Scope ──────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Define Your Scope
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tell us what indication you want benchmarked.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Inputs */}
              <div className="lg:col-span-3 space-y-5">
                {/* Therapeutic Area */}
                <div>
                  <label
                    htmlFor="ta"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Therapeutic Area
                  </label>
                  <select
                    id="ta"
                    value={therapeuticArea}
                    onChange={(e) => setTherapeuticArea(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  >
                    <option value="">Select therapeutic area...</option>
                    {THERAPEUTIC_AREAS.map((ta) => (
                      <option key={ta} value={ta}>
                        {ta}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phase */}
                <div>
                  <label
                    htmlFor="phase"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Development Phase
                  </label>
                  <select
                    id="phase"
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  >
                    <option value="">Select phase...</option>
                    {PHASES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Indication */}
                <div>
                  <label
                    htmlFor="indication"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Indication
                  </label>
                  <input
                    id="indication"
                    type="text"
                    value={indication}
                    onChange={(e) => setIndication(e.target.value)}
                    placeholder="e.g. Non-Small Cell Lung Cancer, Alzheimer's Disease..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>

              {/* Preview card */}
              <div className="lg:col-span-2">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-5 h-full">
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
                    Brief Preview
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">Area:</span>{' '}
                      <span className="text-slate-900 dark:text-white font-medium">
                        {therapeuticArea || '---'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">Phase:</span>{' '}
                      <span className="text-slate-900 dark:text-white font-medium">
                        {phase || '---'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">Indication:</span>{' '}
                      <span className="text-slate-900 dark:text-white font-medium">
                        {indication || '---'}
                      </span>
                    </div>
                    <hr className="border-slate-200 dark:border-slate-600" />
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      {step1Valid ? (
                        <span className="text-teal-600 dark:text-teal-400 font-medium">
                          Ready to configure
                        </span>
                      ) : (
                        'Fill all fields to continue'
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Configure ─────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Configure Your Brief
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select modalities, deal types, and special analyses. All are included by default.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main config */}
              <div className="lg:col-span-2 space-y-8">
                {/* Modalities */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Modalities{' '}
                    <span className="text-slate-400 font-normal">
                      ({modalities.length} of {MODALITIES.length})
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {MODALITIES.map((m) => {
                      const selected = modalities.includes(m.abbr);
                      return (
                        <button
                          key={m.abbr}
                          type="button"
                          onClick={() =>
                            toggleArrayItem(modalities, m.abbr, setModalities)
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                            selected
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-teal-400'
                          }`}
                        >
                          <span className="font-bold">{m.abbr}</span>
                          <span className="hidden sm:inline">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Deal Types */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Deal Types{' '}
                    <span className="text-slate-400 font-normal">
                      ({dealTypes.length} of {DEAL_TYPES.length})
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {DEAL_TYPES.map((dt) => {
                      const selected = dealTypes.includes(dt);
                      return (
                        <button
                          key={dt}
                          type="button"
                          onClick={() =>
                            toggleArrayItem(dealTypes, dt, setDealTypes)
                          }
                          className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                            selected
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-teal-400'
                          }`}
                        >
                          {dt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Special Analyses */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Special Analyses
                  </h3>
                  <div className="space-y-3">
                    {ANALYSES.map((a) => {
                      const enabled = analyses.includes(a.id);
                      return (
                        <label
                          key={a.id}
                          className="flex items-center justify-between cursor-pointer group"
                        >
                          <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                            {a.label}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            onClick={() =>
                              toggleArrayItem(analyses, a.id, setAnalyses)
                            }
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
                              enabled
                                ? 'bg-teal-600'
                                : 'bg-gray-200 dark:bg-slate-600'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition-transform duration-200 ${
                                enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* White-Label */}
                <div>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        White-Label Branding
                      </span>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Your logo, colors, and fund name on every page
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={whiteLabel}
                      onClick={() => setWhiteLabel(!whiteLabel)}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
                        whiteLabel
                          ? 'bg-teal-600'
                          : 'bg-gray-200 dark:bg-slate-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition-transform duration-200 ${
                          whiteLabel ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </label>
                  {whiteLabel && (
                    <input
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="Brand or fund name"
                      className="mt-3 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                    />
                  )}
                </div>

                {/* Custom Notes */}
                <div>
                  <label
                    htmlFor="notes"
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Custom Notes
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Anything specific you'd like us to emphasize?"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Sidebar summary */}
              <div className="lg:col-span-1">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-5 sticky top-24">
                  <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">
                    Brief Estimate
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {calculationCount}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        deal calculations
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        {sectionCount}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        report sections
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white">
                        ~{estimatedPages}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        estimated pages
                      </div>
                    </div>
                    <hr className="border-slate-200 dark:border-slate-600" />
                    <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
                      <p>{modalities.length} modalities selected</p>
                      <p>{dealTypes.length} deal types selected</p>
                      <p>{analyses.length} special analyses</p>
                      {whiteLabel && (
                        <p className="text-teal-600 dark:text-teal-400">
                          + White-label branding
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="button"
                disabled={!step2Valid}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Schedule & Confirm ────────────────────────────── */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                Schedule &amp; Confirm
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Review your selections and submit your request.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Summary */}
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Your Brief Summary
                </h3>
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      Area
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {therapeuticArea}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      Indication
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {indication}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      Phase
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {phase}
                    </span>
                  </div>
                  <hr className="border-slate-200 dark:border-slate-600" />
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      Modalities
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {modalities.length} selected
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      Deal Types
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {dealTypes.length} selected
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      Special Analyses
                    </span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {analyses.length} selected
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">
                      Calculations
                    </span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">
                      {calculationCount}
                    </span>
                  </div>
                  {whiteLabel && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">
                        White-Label
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {brandName || 'Yes'}
                      </span>
                    </div>
                  )}
                </div>

                {/* What happens next */}
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 pt-2">
                  What happens next
                </h3>
                <div className="space-y-4">
                  {[
                    {
                      num: '1',
                      title: 'Intake call scheduled',
                      desc: 'We schedule a 15-min intake call within 24 hours',
                    },
                    {
                      num: '2',
                      title: 'Customization',
                      desc: 'We customize your Brief based on your specific angle',
                    },
                    {
                      num: '3',
                      title: 'Delivery',
                      desc: 'Brief delivered within 24 hours of your call',
                    },
                    {
                      num: '4',
                      title: 'Walkthrough',
                      desc: 'Complimentary 30-minute walkthrough of findings',
                    },
                  ].map((item) => (
                    <div key={item.num} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                          {item.num}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact form */}
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Contact Information
                </h3>

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="work@company.com"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="company"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Company
                  </label>
                  <input
                    id="company"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company or fund name"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  />
                </div>

                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Title <span className="text-slate-400 text-xs">(optional)</span>
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Partner, VP BD"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!step3Valid || submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>

                <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                  No payment required now. Payment is handled on the intake call.
                </p>
              </div>
            </div>

            <div className="flex justify-start pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
