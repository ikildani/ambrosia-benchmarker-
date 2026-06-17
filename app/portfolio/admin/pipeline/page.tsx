'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  GitBranch, Plus, X, AlertTriangle, Trash2,
  ChevronDown, Search, Filter,
} from 'lucide-react';

interface PipelineDeal {
  id: string;
  company_name: string;
  partner_name: string | null;
  stage: string;
  deal_type: string | null;
  therapeutic_area: string | null;
  modality: string | null;
  indication: string | null;
  estimated_value_m: number | null;
  notes: string | null;
  priority: 'high' | 'medium' | 'low';
  updated_at: string;
}

interface Conflict {
  partner_name: string;
  companies: string[];
}

const STAGES = [
  { key: 'evaluating', label: 'Evaluating' },
  { key: 'due_diligence', label: 'Due Diligence' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'term_sheet', label: 'Term Sheet' },
  { key: 'closed', label: 'Closed' },
  { key: 'passed', label: 'Passed' },
] as const;

const STAGE_COLORS: Record<string, string> = {
  evaluating: 'border-slate-600',
  due_diligence: 'border-amber-500/50',
  negotiation: 'border-blue-500/50',
  term_sheet: 'border-purple-500/50',
  closed: 'border-emerald-500/50',
  passed: 'border-slate-700',
};

const PRIORITY_DOTS: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-500',
};

const TA_OPTIONS = [
  'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular',
  'infectiousDisease', 'ophthalmology', 'hematology', 'rareDisease',
  'dermatology', 'gastroenterology', 'womensHealth',
];

export default function PipelinePage() {
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingDeal, setEditingDeal] = useState<PipelineDeal | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterTA, setFilterTA] = useState('');

  // Form fields
  const [companyName, setCompanyName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [stage, setStage] = useState('evaluating');
  const [dealType, setDealType] = useState('');
  const [therapeuticArea, setTherapeuticArea] = useState('');
  const [modality, setModality] = useState('');
  const [indication, setIndication] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('medium');

  async function fetchPipeline() {
    try {
      const res = await fetch('/api/portfolio/pipeline');
      const json = await res.json();
      if (json.success) {
        setDeals(json.deals || []);
        setConflicts(json.conflicts || []);
      }
    } catch {
      // silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPipeline();
  }, []);

  useEffect(() => {
    if (!editingDeal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingDeal(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [editingDeal]);

  function resetForm() {
    setCompanyName('');
    setPartnerName('');
    setStage('evaluating');
    setDealType('');
    setTherapeuticArea('');
    setModality('');
    setIndication('');
    setEstimatedValue('');
    setNotes('');
    setPriority('medium');
  }

  async function handleCreate() {
    if (!companyName) return;
    setCreating(true);
    try {
      const res = await fetch('/api/portfolio/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          partner_name: partnerName || undefined,
          stage,
          deal_type: dealType || undefined,
          therapeutic_area: therapeuticArea || undefined,
          modality: modality || undefined,
          indication: indication || undefined,
          estimated_value_m: estimatedValue ? Number(estimatedValue) : undefined,
          notes: notes || undefined,
          priority,
        }),
      });
      const json = await res.json();
      if (json.success) {
        resetForm();
        setShowCreate(false);
        fetchPipeline();
      }
    } catch {
      // silently handle errors
    } finally {
      setCreating(false);
    }
  }

  async function handleStageChange(dealId: string, newStage: string) {
    try {
      const res = await fetch('/api/portfolio/pipeline', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dealId, stage: newStage }),
      });
      const json = await res.json();
      if (json.success) {
        fetchPipeline();
      }
    } catch {
      // silently handle errors
    }
  }

  async function handleUpdate() {
    if (!editingDeal) return;
    try {
      const res = await fetch('/api/portfolio/pipeline', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingDeal.id,
          stage: editingDeal.stage,
          notes: editingDeal.notes,
          priority: editingDeal.priority,
          estimated_value_m: editingDeal.estimated_value_m,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingDeal(null);
        fetchPipeline();
      }
    } catch {
      // silently handle errors
    }
  }

  async function handleDelete(dealId: string) {
    if (!window.confirm('Delete this pipeline deal?')) return;
    try {
      const res = await fetch(`/api/portfolio/pipeline?id=${dealId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        fetchPipeline();
      }
    } catch {
      // silently handle errors
    }
  }

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (filterStage && d.stage !== filterStage) return false;
      if (filterTA && d.therapeutic_area !== filterTA) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          d.company_name.toLowerCase().includes(q) ||
          (d.partner_name?.toLowerCase().includes(q) ?? false) ||
          (d.therapeutic_area?.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }
      return true;
    });
  }, [deals, filterStage, filterTA, searchQuery]);

  const dealsByStage = useMemo(() => {
    const grouped: Record<string, PipelineDeal[]> = {};
    for (const s of STAGES) {
      grouped[s.key] = filteredDeals.filter((d) => d.stage === s.key);
    }
    return grouped;
  }, [filteredDeals]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-teal-400" />
          Deal Pipeline
        </h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Close' : 'Add Deal'}
        </button>
      </div>

      {/* Conflict alerts */}
      {conflicts.length > 0 && (
        <div className="space-y-2">
          {conflicts.map((c) => (
            <div
              key={c.partner_name}
              className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">
                <span className="font-semibold">{c.companies.length} portfolio companies</span>{' '}
                targeting{' '}
                <span className="font-semibold">{c.partner_name}</span>:{' '}
                {c.companies.join(', ')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-slate-900 border border-teal-500/30 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-white">Add Pipeline Deal</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Company Name *</label>
              <input
                type="text"
                placeholder="Portfolio company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Partner Name</label>
              <input
                type="text"
                placeholder="Target partner / acquirer"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {STAGES.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Deal Type</label>
              <select
                value={dealType}
                onChange={(e) => setDealType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">Select...</option>
                <option value="licensing">Licensing</option>
                <option value="acquisition">Acquisition</option>
                <option value="co-dev">Co-development</option>
                <option value="option">Option</option>
                <option value="collaboration">Collaboration</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Therapeutic Area</label>
              <select
                value={therapeuticArea}
                onChange={(e) => setTherapeuticArea(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">Select...</option>
                {TA_OPTIONS.map((ta) => (
                  <option key={ta} value={ta}>{ta.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Modality</label>
              <input
                type="text"
                placeholder="e.g., Small molecule"
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Indication</label>
              <input
                type="text"
                placeholder="e.g., NSCLC"
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Estimated Value ($M)</label>
              <input
                type="number"
                placeholder="e.g., 250"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Notes</label>
              <input
                type="text"
                placeholder="Key context"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowCreate(false); resetForm(); }}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !companyName}
              className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Adding...' : 'Add Deal'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      {!loading && deals.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search company or partner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">All Stages</option>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <select
              value={filterTA}
              onChange={(e) => setFilterTA(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">All TAs</option>
              {TA_OPTIONS.map((ta) => (
                <option key={ta} value={ta}>{ta.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingDeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditingDeal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Edit Deal</h2>
              <button onClick={() => setEditingDeal(null)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400">{editingDeal.company_name} &mdash; {editingDeal.partner_name || 'No partner'}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Stage</label>
                <select
                  value={editingDeal.stage}
                  onChange={(e) => setEditingDeal({ ...editingDeal, stage: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {STAGES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Priority</label>
                <select
                  value={editingDeal.priority}
                  onChange={(e) => setEditingDeal({ ...editingDeal, priority: e.target.value as 'high' | 'medium' | 'low' })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Estimated Value ($M)</label>
                <input
                  type="number"
                  value={editingDeal.estimated_value_m ?? ''}
                  onChange={(e) => setEditingDeal({ ...editingDeal, estimated_value_m: e.target.value ? Number(e.target.value) : null })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Notes</label>
                <textarea
                  value={editingDeal.notes ?? ''}
                  onChange={(e) => setEditingDeal({ ...editingDeal, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditingDeal(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban board */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
        </div>
      ) : deals.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-12 text-center">
          <GitBranch className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-1">No deals in your pipeline yet</h3>
          <p className="text-sm text-slate-400">
            Track active deal conversations across your portfolio. Click &lsquo;Add Deal&rsquo; to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-3 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {STAGES.map((s) => (
            <div key={s.key} className="min-w-[200px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {s.label}
                </h3>
                <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">
                  {dealsByStage[s.key]?.length || 0}
                </span>
              </div>
              <div className="space-y-2">
                {(dealsByStage[s.key] || []).map((deal) => (
                  <div
                    key={deal.id}
                    className={`bg-slate-900 border-l-2 ${STAGE_COLORS[deal.stage]} border border-slate-800 rounded-lg p-3 cursor-pointer hover:border-slate-700 transition-colors group`}
                    onClick={() => setEditingDeal(deal)}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-sm font-medium text-white truncate flex-1">
                        {deal.company_name}
                      </h4>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ml-2 ${PRIORITY_DOTS[deal.priority]}`} title={deal.priority} />
                    </div>
                    {deal.partner_name && (
                      <p className="text-xs text-slate-500 truncate mb-1">
                        &rarr; {deal.partner_name}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {deal.therapeutic_area && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400">
                          {deal.therapeutic_area.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}
                        </span>
                      )}
                      {deal.estimated_value_m != null && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          ${deal.estimated_value_m}M
                        </span>
                      )}
                    </div>
                    {/* Stage dropdown + delete (visible on hover) */}
                    <div className="mt-2 flex items-center gap-1">
                      <div className="relative flex-1">
                        <select
                          value={deal.stage}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStageChange(deal.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-300 focus:outline-none appearance-none cursor-pointer"
                        >
                          {STAGES.map((stg) => (
                            <option key={stg.key} value={stg.key}>{stg.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(deal.id);
                        }}
                        className="text-slate-600 hover:text-red-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
