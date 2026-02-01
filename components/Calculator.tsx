'use client';

import { useState, useEffect } from 'react';
import {
  Phase,
  Modality,
  Indication,
  Territory,
  BiomarkerStatus,
  LineOfTherapy,
  CombinationPotential,
  CompetitivePosition,
  DataQuality,
  RegulatoryDesignations,
  CalculationInput,
  CalculationResult,
  calculateDealTerms,
  phaseOptions,
  modalityOptions,
  indicationOptions,
  territoryOptions,
  biomarkerOptions,
  lineOfTherapyOptions,
  combinationPotentialOptions,
  competitivePositionOptions,
  dataQualityOptions,
  regulatoryDesignationOptions,
} from '@/lib/calculations';
import Results from './Results';

interface CalculatorProps {
  tier?: 'free' | 'pro';
  onUpgrade?: () => void;
}

export default function Calculator({ tier = 'free', onUpgrade }: CalculatorProps) {
  const [phase, setPhase] = useState<Phase>('phase2');
  const [modality, setModality] = useState<Modality>('smallMolecule');
  const [indication, setIndication] = useState<Indication>('lung_nsclc');
  const [territory, setTerritory] = useState<Territory>('global');
  const [biomarker, setBiomarker] = useState<BiomarkerStatus>('unselected');
  const [lineOfTherapy, setLineOfTherapy] = useState<LineOfTherapy>('2L');
  const [combinationPotential, setCombinationPotential] = useState<CombinationPotential>('some');
  const [competitivePosition, setCompetitivePosition] = useState<CompetitivePosition>('racing');
  const [dataQuality, setDataQuality] = useState<DataQuality>('promising');
  const [regulatoryDesignations, setRegulatoryDesignations] = useState<RegulatoryDesignations>({
    breakthrough: false,
    fastTrack: false,
    orphan: false,
    prime: false,
  });

  const [result, setResult] = useState<CalculationResult | null>(null);

  useEffect(() => {
    const input: CalculationInput = {
      phase,
      modality,
      indication,
      territory,
      biomarker,
      lineOfTherapy,
      combinationPotential,
      competitivePosition,
      dataQuality,
      regulatoryDesignations,
    };
    const calculatedResult = calculateDealTerms(input);
    setResult(calculatedResult);
  }, [phase, modality, indication, territory, biomarker, lineOfTherapy, combinationPotential, competitivePosition, dataQuality, regulatoryDesignations]);

  const handleRegulatoryChange = (designation: keyof RegulatoryDesignations) => {
    setRegulatoryDesignations((prev) => ({
      ...prev,
      [designation]: !prev[designation],
    }));
  };

  return (
    <div id="calculator" className="w-full max-w-6xl mx-auto scroll-mt-24">
      <div className="card-elevated overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-8 py-8 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-glow">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Oncology Deal Terms Calculator</h2>
                <p className="text-neutral-400 text-sm mt-0.5">
                  2025 Market Benchmarks
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-8 bg-gradient-subtle">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Asset Details Section */}
              <div>
                <h3 className="text-lg font-semibold text-navy-800 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center">1</span>
                  Asset Details
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">Development Phase</label>
                    <select
                      value={phase}
                      onChange={(e) => setPhase(e.target.value as Phase)}
                      className="select-field"
                    >
                      {phaseOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">Modality</label>
                    <select
                      value={modality}
                      onChange={(e) => setModality(e.target.value as Modality)}
                      className="select-field"
                    >
                      {modalityOptions.map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.options.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">Primary Indication</label>
                    <select
                      value={indication}
                      onChange={(e) => setIndication(e.target.value as Indication)}
                      className="select-field"
                    >
                      {indicationOptions.map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.options.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">Biomarker Status</label>
                    <select
                      value={biomarker}
                      onChange={(e) => setBiomarker(e.target.value as BiomarkerStatus)}
                      className="select-field"
                    >
                      {biomarkerOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Target Profile Section */}
              <div>
                <h3 className="text-lg font-semibold text-navy-800 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-500/70 text-white text-xs flex items-center justify-center">2</span>
                  Target Profile
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">Line of Therapy</label>
                    <select
                      value={lineOfTherapy}
                      onChange={(e) => setLineOfTherapy(e.target.value as LineOfTherapy)}
                      className="select-field"
                    >
                      {lineOfTherapyOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">Combination Potential</label>
                    <select
                      value={combinationPotential}
                      onChange={(e) => setCombinationPotential(e.target.value as CombinationPotential)}
                      className="select-field"
                    >
                      {combinationPotentialOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
              {/* Competitive Landscape Section */}
              <div>
                <h3 className="text-lg font-semibold text-navy-800 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-500/50 text-white text-xs flex items-center justify-center">3</span>
                  Competitive Landscape
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">Competitive Position</label>
                    <select
                      value={competitivePosition}
                      onChange={(e) => setCompetitivePosition(e.target.value as CompetitivePosition)}
                      className="select-field"
                    >
                      {competitivePositionOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">Data Quality</label>
                    <select
                      value={dataQuality}
                      onChange={(e) => setDataQuality(e.target.value as DataQuality)}
                      className="select-field"
                    >
                      {dataQualityOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Deal Scope Section */}
              <div>
                <h3 className="text-lg font-semibold text-navy-800 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-500/30 text-teal-700 text-xs flex items-center justify-center">4</span>
                  Deal Scope
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">Territory</label>
                    <select
                      value={territory}
                      onChange={(e) => setTerritory(e.target.value as Territory)}
                      className="select-field"
                    >
                      {territoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-neutral-700">Regulatory Designations</label>
                    <div className="grid grid-cols-2 gap-3">
                      {regulatoryDesignationOptions.map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                            regulatoryDesignations[option.value as keyof RegulatoryDesignations]
                              ? 'border-teal-500 bg-teal-50'
                              : 'border-neutral-200 bg-white hover:border-teal-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={regulatoryDesignations[option.value as keyof RegulatoryDesignations]}
                            onChange={() => handleRegulatoryChange(option.value as keyof RegulatoryDesignations)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${
                            regulatoryDesignations[option.value as keyof RegulatoryDesignations]
                              ? 'bg-teal-500 border-teal-500'
                              : 'border-neutral-300'
                          }`}>
                            {regulatoryDesignations[option.value as keyof RegulatoryDesignations] && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm font-medium ${
                            regulatoryDesignations[option.value as keyof RegulatoryDesignations]
                              ? 'text-teal-700'
                              : 'text-neutral-700'
                          }`}>
                            {option.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="mt-8 animate-fade-in results-container">
          <Results result={result} tier={tier} onUpgrade={onUpgrade} />
        </div>
      )}
    </div>
  );
}
