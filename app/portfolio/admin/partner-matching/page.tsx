'use client';

import { useState, useEffect } from 'react';
import { Users, AlertTriangle, Handshake, Download } from 'lucide-react';
import { HelpTooltip } from '@/components/portfolio';

interface AssetProfile {
  userId: string;
  companyName: string | null;
  email: string;
  assets: Array<{ therapeuticArea: string; modality: string; count: number; latestDate: string }>;
}

interface Overlap {
  therapeuticArea: string;
  modality: string;
  companies: string[];
}

interface Synergy {
  therapeuticArea: string;
  modalityA: string;
  modalityB: string;
  companyA: string | null;
  companyB: string | null;
}

function formatLabel(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PartnerMatchingPage() {
  const [profiles, setProfiles] = useState<AssetProfile[]>([]);
  const [overlaps, setOverlaps] = useState<Overlap[]>([]);
  const [synergies, setSynergies] = useState<Synergy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/portfolio/partner-matching')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setProfiles(json.assetProfiles || []);
          setOverlaps(json.overlaps || []);
          setSynergies(json.synergies || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const isEmpty = profiles.length === 0 && overlaps.length === 0 && synergies.length === 0;

  const exportCSV = () => {
    const header = 'Company,TA,Modality,Calculation Count,Last Active\n';
    const rows = profiles.flatMap(p =>
      p.assets.map(a =>
        `"${(p.companyName || p.email).replace(/"/g, '""')}",${a.therapeuticArea},${a.modality},${a.count},${a.latestDate}`
      )
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partner-matching-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-teal-400" />
          Cross-Portfolio Partner Matching
        </h1>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
        </div>
      ) : isEmpty ? (
        <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-12 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-1">No calculation history found</h3>
          <p className="text-sm text-slate-400">
            Team members need to run benchmarks in the calculator to generate portfolio intelligence.
          </p>
        </div>
      ) : (
        <>
          {/* Section 1: Portfolio Asset Map */}
          {profiles.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-400" />
                  Portfolio Asset Map
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Each company&apos;s active therapeutic area and modality profile based on recent calculations
                </p>
              </div>
              <div className="grid gap-4">
                {profiles.map((profile) => (
                  <div
                    key={profile.userId}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
                  >
                    <h3 className="text-lg font-medium text-white mb-3">
                      {profile.companyName || profile.email}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.assets.map((asset, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
                            {formatLabel(asset.therapeuticArea)}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400">
                            {formatLabel(asset.modality)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {asset.count} calc{asset.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Competitive Overlaps */}
          {overlaps.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="inline-flex items-center gap-1.5">Competitive Overlaps <HelpTooltip text="Two or more portfolio companies exploring the same therapeutic area and modality combination, which could lead to competitive tension with potential partners." /></span>
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Multiple portfolio companies targeting the same therapeutic area and modality
                </p>
              </div>
              <div className="grid gap-4">
                {overlaps.map((overlap, i) => (
                  <div
                    key={i}
                    className="bg-slate-900 border border-red-500/30 rounded-xl p-5 hover:border-red-500/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
                        {formatLabel(overlap.therapeuticArea)}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400">
                        {formatLabel(overlap.modality)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {overlap.companies.map((company, j) => (
                        <div key={j} className="text-sm text-white">
                          {company}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Synergy Opportunities */}
          {synergies.length > 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Handshake className="w-5 h-5 text-emerald-400" />
                  <span className="inline-flex items-center gap-1.5">Synergy Opportunities <HelpTooltip text="Portfolio companies with complementary capabilities (e.g., one has an ADC platform, another has a validated target) that could benefit from coordinated partnering." /></span>
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Complementary modalities within the same therapeutic area
                </p>
              </div>
              <div className="grid gap-4">
                {synergies.map((synergy, i) => (
                  <div
                    key={i}
                    className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5 hover:border-emerald-500/50 transition-colors"
                  >
                    <div className="mb-3">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
                        {formatLabel(synergy.therapeuticArea)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white">{synergy.companyA || 'Unknown'}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400">
                          {formatLabel(synergy.modalityA)}
                        </span>
                      </div>
                      <span className="text-slate-500">+</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-white">{synergy.companyB || 'Unknown'}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400">
                          {formatLabel(synergy.modalityB)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
