'use client';

import { useState, useEffect, useCallback } from 'react';

interface Mandate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  therapeutic_areas: string[];
  modalities: string[];
  phase_min: string | null;
  phase_max: string | null;
  partnership_statuses: string[];
  min_licensing_intent: number;
  min_confidence: number;
  notify_in_app: boolean;
  digest_frequency: string;
  match_count: number;
  unread_matches: number;
  created_at: string;
}

const TA_OPTIONS = [
  'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular',
  'rare_disease', 'infectious_disease', 'ophthalmology', 'respiratory',
  'dermatology', 'hematology', 'womens_health',
];

const MODALITY_OPTIONS = [
  'small_molecule', 'monoclonal_antibody', 'adc', 'bispecific', 'car_t',
  'cell_therapy', 'gene_therapy', 'mrna', 'peptide', 'oligonucleotide',
  'vaccine', 'radiopharmaceutical',
];

function formatLabel(raw: string): string {
  const MAP: Record<string, string> = {
    small_molecule: 'Small Molecule', monoclonal_antibody: 'mAb', adc: 'ADC',
    bispecific: 'Bispecific', car_t: 'CAR-T', cell_therapy: 'Cell',
    gene_therapy: 'Gene', mrna: 'mRNA', peptide: 'Peptide',
    oligonucleotide: 'Oligo', vaccine: 'Vaccine', radiopharmaceutical: 'Radiopharma',
    oncology: 'Oncology', neurology: 'Neurology', immunology: 'Immunology',
    metabolic: 'Metabolic', cardiovascular: 'Cardio', rare_disease: 'Rare Disease',
    infectious_disease: 'Infectious', ophthalmology: 'Ophtho', respiratory: 'Respiratory',
    dermatology: 'Derm', hematology: 'Hematology', womens_health: "Women's",
  };
  return MAP[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface Props {
  onBack: () => void;
}

export function MandatePanel({ onBack }: Props) {
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState('');
  const [selectedTAs, setSelectedTAs] = useState<string[]>([]);
  const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
  const [minIntent, setMinIntent] = useState(0);

  const fetchMandates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/radar/mandates');
      if (res.ok) {
        const data = await res.json();
        setMandates(data.mandates || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMandates(); }, [fetchMandates]);

  const createMandate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/radar/mandates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          therapeutic_areas: selectedTAs,
          modalities: selectedModalities,
          min_licensing_intent: minIntent,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setName('');
        setSelectedTAs([]);
        setSelectedModalities([]);
        setMinIntent(0);
        fetchMandates();
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const deleteMandate = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/radar/mandates/${id}`, { method: 'DELETE' });
      if (res.ok) setMandates(prev => prev.filter(m => m.id !== id));
    } catch { /* silent */ }
    finally { setDeleting(null); }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      await fetch(`/api/radar/mandates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      setMandates(prev => prev.map(m => m.id === id ? { ...m, is_active: !currentActive } : m));
    } catch { /* silent */ }
  };

  const togglePill = (value: string, selected: string[], setSelected: (v: string[]) => void) => {
    setSelected(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Search Mandates</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Define what you're looking for — get matched daily
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={mandates.length >= 10}
          className="text-xs font-semibold px-4 py-2 rounded-full bg-amber-500 text-white hover:bg-amber-400 shadow-sm shadow-amber-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + New Mandate
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-900/10 p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Phase 2 oncology ADCs"
              className="mt-1.5 w-full px-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Therapeutic Areas</label>
            <div className="flex flex-wrap gap-1.5">
              {TA_OPTIONS.map(ta => (
                <button
                  key={ta}
                  onClick={() => togglePill(ta, selectedTAs, setSelectedTAs)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                    selectedTAs.includes(ta)
                      ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {formatLabel(ta)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Modalities</label>
            <div className="flex flex-wrap gap-1.5">
              {MODALITY_OPTIONS.map(mod => (
                <button
                  key={mod}
                  onClick={() => togglePill(mod, selectedModalities, setSelectedModalities)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                    selectedModalities.includes(mod)
                      ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/20'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {formatLabel(mod)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Min Intent Score: <span className="text-amber-600 dark:text-amber-400">{minIntent}</span>
            </label>
            <input
              type="range"
              min={0} max={100} step={5}
              value={minIntent}
              onChange={e => setMinIntent(Number(e.target.value))}
              className="mt-1.5 w-full accent-amber-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={createMandate}
              disabled={saving || !name.trim()}
              className="text-xs font-semibold px-5 py-2 rounded-full bg-amber-500 text-white hover:bg-amber-400 shadow-sm shadow-amber-500/20 transition-all disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Create Mandate'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="text-xs font-semibold px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mandate list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/60 p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : mandates.length > 0 ? (
        <div className="space-y-3">
          {mandates.map(mandate => (
            <div
              key={mandate.id}
              className={`rounded-xl border bg-white dark:bg-slate-800/60 p-5 transition-all ${
                mandate.is_active
                  ? 'border-slate-200 dark:border-slate-700/60'
                  : 'border-slate-100 dark:border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{mandate.name}</h3>
                    {mandate.unread_matches > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                        {mandate.unread_matches} new
                      </span>
                    )}
                    {!mandate.is_active && (
                      <span className="text-[10px] font-medium text-slate-400 uppercase">Paused</span>
                    )}
                  </div>

                  {/* Criteria pills */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {mandate.therapeutic_areas.map(ta => (
                      <span key={ta} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                        {formatLabel(ta)}
                      </span>
                    ))}
                    {mandate.modalities.map(mod => (
                      <span key={mod} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400">
                        {formatLabel(mod)}
                      </span>
                    ))}
                    {mandate.min_licensing_intent > 0 && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                        Intent &ge; {mandate.min_licensing_intent}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 mt-2">
                    {mandate.match_count} total matches · Created {new Date(mandate.created_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleActive(mandate.id, mandate.is_active)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      mandate.is_active
                        ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                        : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title={mandate.is_active ? 'Pause' : 'Resume'}
                  >
                    {mandate.is_active ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => deleteMandate(mandate.id)}
                    disabled={deleting === mandate.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete"
                  >
                    {deleting === mandate.id ? (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-red-500 animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !showCreate ? (
        <div className="text-center py-20 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <svg className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="text-slate-500 dark:text-slate-400 font-medium">No search mandates yet</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 mb-4">
            Define your target criteria and we'll match new assets daily
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs font-semibold px-5 py-2 rounded-full bg-amber-500 text-white hover:bg-amber-400 shadow-sm shadow-amber-500/20 transition-all"
          >
            Create Your First Mandate
          </button>
        </div>
      ) : null}
    </div>
  );
}
