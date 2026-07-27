'use client';

import { useState } from 'react';

interface ReportCTAProps {
  modality?: string;
  phase?: string;
  dealCount?: number;
  className?: string;
}

const modalityLabels: Record<string, string> = {
  adc: 'ADC',
  car_t: 'CAR-T',
  bispecific: 'Bispecific Antibody',
  radiopharm: 'Radiopharmaceutical',
  gene_therapy: 'Gene Therapy',
  smallMolecule: 'Small Molecule',
  small_molecule: 'Small Molecule',
  mab: 'Monoclonal Antibody',
  peptide: 'Peptide',
  mrna: 'mRNA',
  rnai: 'RNAi/siRNA',
  cell_therapy: 'Cell Therapy',
  oligonucleotide: 'Oligonucleotide',
};

const phaseLabels: Record<string, string> = {
  preclinical: 'Preclinical',
  phase1: 'Phase 1',
  phase_1: 'Phase 1',
  phase2: 'Phase 2',
  phase_2: 'Phase 2',
  phase3: 'Phase 3',
  phase_3: 'Phase 3',
  approved: 'Approved',
};

export default function ReportCTA({ modality, phase, dealCount, className = '' }: ReportCTAProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const modalityLabel = modality ? modalityLabels[modality] || modality : '';
  const phaseLabel = phase ? phaseLabels[phase] || phase : '';
  const context = [modalityLabel, phaseLabel].filter(Boolean).join(' ');
  const dealText = dealCount ? `${dealCount} deals` : 'verified deals';

  const enterpriseMailto = `mailto:issa@ambrosiaventures.co?subject=${encodeURIComponent('Custom Analysis Inquiry')}&body=${encodeURIComponent(`Hi Issa,\n\nI'm interested in a custom deal analysis. Please share details on the $2,500 engagement.\n\nContext: ${context || '[please describe your deal/asset]'}\n\nThank you`)}`;

  async function handleCheckout() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseType: 'report',
          calculationData: {
            inputs: {
              modality: modality || '',
              development_phase: phase || '',
              source: 'pseo',
              context: context || 'Custom',
            },
            results: {},
          },
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        setError(data.error);
      } else {
        setError('Unable to start checkout. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again or contact us directly.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-teal-200 dark:border-teal-500/30 bg-gradient-to-br from-white via-teal-50/30 to-white dark:from-navy-800 dark:via-teal-900/10 dark:to-navy-800 ${className}`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl" />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-soft flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-neutral-900 dark:text-white text-base">
              {context ? `Full ${context} Comp Set` : 'Custom Deal Benchmarks Report'}
            </h4>
            <p className="text-sm text-neutral-600 dark:text-slate-300 mt-1">
              {context
                ? `Get the complete analysis -- ${dealText} with upfronts, milestones, royalties, and term structures.`
                : 'Get a tailored comp set for your specific deal with complete term-level benchmarks.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all shadow-soft hover:shadow-glow text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Purchase Report — $499
              </>
            )}
          </button>
          <a
            href={enterpriseMailto}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 border border-neutral-300 dark:border-slate-600 text-neutral-700 dark:text-slate-200 font-medium rounded-xl hover:bg-neutral-50 dark:hover:bg-slate-700 transition-all text-sm"
          >
            Contact Us for Enterprise Pricing
          </a>
        </div>

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-2 text-center">
            {error}
          </p>
        )}

        <p className="text-xs text-neutral-500 dark:text-slate-400 mt-3 text-center">
          Primary-source-verified from SEC EDGAR, FTC filings, and direct research
        </p>
      </div>
    </div>
  );
}
