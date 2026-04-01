'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { PRICING } from '@/lib/config/constants';
import {
  phaseOptions,
  dealTypeOptions,
  modalityOptions,
  indicationOptions,
} from '@/lib/calculations';

const TA_OPTIONS = [
  { value: 'oncology', label: 'Oncology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'immunology', label: 'Immunology' },
  { value: 'rareDisease', label: 'Rare Disease' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'metabolic', label: 'Metabolic' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'infectiousDisease', label: 'Infectious Disease' },
  { value: 'gastroenterology', label: 'Gastroenterology' },
  { value: 'womensHealth', label: "Women's Health" },
];

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  grouped,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  grouped?: { group: string; options: { value: string; label: string }[] }[];
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-400 tracking-wide uppercase mb-2">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500/30 focus:ring-2 focus:ring-teal-500/10 transition-all cursor-pointer hover:border-white/[0.12] pr-10"
        >
          <option value="" className="bg-[#0c1220] text-slate-400">{placeholder}</option>
          {grouped ? (
            grouped.map((g) => (
              <optgroup key={g.group} label={g.group} className="bg-[#0c1220] text-white">
                {g.options.map((o) => (
                  <option key={o.value} value={o.value} className="bg-[#0c1220]">{o.label}</option>
                ))}
              </optgroup>
            ))
          ) : (
            options.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#0c1220]">{o.label}</option>
            ))
          )}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
      </div>
    </div>
  );
}

export default function ReportIntakeForm() {
  const router = useRouter();
  const [ta, setTA] = useState('');
  const [phase, setPhase] = useState('');
  const [dealType, setDealType] = useState('');
  const [modality, setModality] = useState('');
  const [indication, setIndication] = useState('');

  // TODO: in future, filter modality/indication by TA. For now use oncology defaults.
  const flatModalities = useMemo(
    () => modalityOptions.flatMap((g) => g.options),
    []
  );
  const flatIndications = useMemo(
    () => indicationOptions.flatMap((g) => g.options),
    []
  );

  const isReady = ta && phase && dealType && modality && indication;

  const handleSubmit = () => {
    if (!isReady) return;
    const params = new URLSearchParams({
      therapeuticArea: ta,
      phase,
      dealType,
      modality,
      indication,
    });
    router.push(`/calculator?${params.toString()}`);
  };

  return (
    <div className="relative bg-[#0c1220]/80 border border-white/[0.06] rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
      {/* Subtle glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/[0.03] via-transparent to-cyan-500/[0.03] rounded-2xl blur-xl pointer-events-none" />

      <div className="relative">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white mb-1">Configure your report</h3>
          <p className="text-xs text-slate-500">Select your asset parameters to generate a tailored analysis.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <SelectField
            label="Therapeutic Area"
            value={ta}
            onChange={setTA}
            options={TA_OPTIONS}
            placeholder="Select area..."
          />
          <SelectField
            label="Development Phase"
            value={phase}
            onChange={setPhase}
            options={phaseOptions}
            placeholder="Select phase..."
          />
          <SelectField
            label="Deal Type"
            value={dealType}
            onChange={setDealType}
            options={dealTypeOptions}
            placeholder="Select type..."
          />
          <SelectField
            label="Modality"
            value={modality}
            onChange={setModality}
            options={flatModalities}
            placeholder="Select modality..."
            grouped={modalityOptions}
          />
          <div className="sm:col-span-2">
            <SelectField
              label="Indication"
              value={indication}
              onChange={setIndication}
              options={flatIndications}
              placeholder="Select indication..."
              grouped={indicationOptions}
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isReady}
          className="group w-full inline-flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-[#080c16] font-bold rounded-xl transition-all shadow-[0_0_40px_rgba(20,184,166,0.15)] hover:shadow-[0_0_60px_rgba(20,184,166,0.25)] text-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none"
        >
          Generate Your Report
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <p className="text-center text-[10px] text-slate-600 mt-3">
          Free preview included &middot; Full report {PRICING.REPORT_PRICE} via Stripe
        </p>
      </div>
    </div>
  );
}
