'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Plus, ChevronDown, ChevronRight, Lock, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isScalePlus } from '@/lib/portfolio/feature-gates';

interface KeyTerm {
  term: string;
  benchmark_range: string;
  notes: string;
}

interface CounterFramework {
  scenario: string;
  response: string;
}

interface Playbook {
  id: string;
  deal_type: string;
  therapeutic_area: string | null;
  phase: string | null;
  title: string;
  description: string | null;
  template_content: {
    key_terms: KeyTerm[];
    negotiation_tips: string[];
    counter_frameworks: CounterFramework[];
  };
  is_system: boolean;
  team_id: string | null;
  created_at: string;
}

const DEAL_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'licensing', label: 'Licensing' },
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'codevelopment', label: 'Co-Development' },
  { value: 'option', label: 'Option' },
  { value: 'collaboration', label: 'Collaboration' },
];

const TA_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'oncology', label: 'Oncology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'immunology', label: 'Immunology' },
  { value: 'metabolic', label: 'Metabolic' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'infectious_disease', label: 'Infectious Disease' },
];

const DEAL_TYPE_COLORS: Record<string, string> = {
  licensing: 'bg-teal-500/10 text-teal-400',
  acquisition: 'bg-purple-500/10 text-purple-400',
  codevelopment: 'bg-blue-500/10 text-blue-400',
  option: 'bg-amber-500/10 text-amber-400',
  collaboration: 'bg-emerald-500/10 text-emerald-400',
};

function formatDealType(dealType: string): string {
  const map: Record<string, string> = {
    licensing: 'Licensing',
    acquisition: 'Acquisition',
    codevelopment: 'Co-Development',
    option: 'Option',
    collaboration: 'Collaboration',
  };
  return map[dealType] || dealType.charAt(0).toUpperCase() + dealType.slice(1);
}

function ScaleGate() {
  return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-500/10 mb-6">
        <Lock className="w-8 h-8 text-teal-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-3">Negotiation Playbook Library</h1>
      <p className="text-slate-400 mb-6">
        The playbook library is available on the Scale and Enterprise tiers. Upgrade to access curated negotiation frameworks and term sheet templates.
      </p>
      <a
        href="mailto:issa@ambrosiaventures.co?subject=Portfolio%20License%20Upgrade%20%E2%80%94%20Scale%20Tier"
        className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
      >
        Upgrade to Scale <ArrowUpRight className="w-4 h-4" />
      </a>
    </div>
  );
}

export default function PlaybooksPage() {
  const { portfolioSubTier } = useAuth();
  const hasAccess = isScalePlus(portfolioSubTier);

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [expandedCounters, setExpandedCounters] = useState<Set<string>>(new Set());

  // Filters
  const [filterDealType, setFilterDealType] = useState('');
  const [filterTA, setFilterTA] = useState('');

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDealType, setNewDealType] = useState('licensing');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchPlaybooks = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDealType) params.set('deal_type', filterDealType);
    if (filterTA) params.set('therapeutic_area', filterTA);
    const qs = params.toString();
    fetch(`/api/portfolio/playbooks${qs ? `?${qs}` : ''}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) setPlaybooks(json.playbooks || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!hasAccess) return;
    fetchPlaybooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, filterDealType, filterTA]);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCounter = (key: string) => {
    setExpandedCounters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/portfolio/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_type: newDealType,
          title: newTitle,
          description: newDescription || null,
          template_content: {},
        }),
      });
      const json = await res.json();
      if (json.success) {
        setNewTitle('');
        setNewDealType('licensing');
        setNewDescription('');
        setShowCreateForm(false);
        fetchPlaybooks();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  if (!hasAccess) return <ScaleGate />;

  // Group playbooks by deal_type
  const grouped: Record<string, Playbook[]> = {};
  for (const pb of playbooks) {
    const key = pb.deal_type;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(pb);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-teal-400" />
          Negotiation Playbooks
        </h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Save Custom Playbook
        </button>
      </div>

      <p className="text-sm text-slate-400">
        Negotiation frameworks and term benchmarks from 1,900+ biopharma deals
      </p>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={filterDealType}
          onChange={(e) => setFilterDealType(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
        >
          {DEAL_TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={filterTA}
          onChange={(e) => setFilterTA(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
        >
          {TA_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-slate-900 border border-teal-500/30 rounded-xl p-6 space-y-4">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="playbook-title" className="block text-sm font-medium text-slate-300 mb-1">
                Title
              </label>
              <input
                id="playbook-title"
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Phase 2 Licensing Playbook"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor="playbook-deal-type" className="block text-sm font-medium text-slate-300 mb-1">
                Deal Type
              </label>
              <select
                id="playbook-deal-type"
                value={newDealType}
                onChange={(e) => setNewDealType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              >
                {DEAL_TYPE_OPTIONS.filter(o => o.value !== '').map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="playbook-description" className="block text-sm font-medium text-slate-300 mb-1">
                Description (optional)
              </label>
              <textarea
                id="playbook-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Brief description of this playbook..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setNewTitle(''); setNewDescription(''); }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newTitle.trim()}
                className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent" />
        </div>
      ) : playbooks.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-1">No matching playbooks</h3>
          <p className="text-sm text-slate-400 mb-4">
            Access negotiation frameworks built from 1,900+ real deals. System playbooks are loaded automatically — check your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([dealType, items]) => (
            <div key={dealType} className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                {formatDealType(dealType)}
              </h2>
              <div className="grid gap-4">
                {items.map((pb) => {
                  const isExpanded = expandedCards.has(pb.id);
                  const content = pb.template_content;
                  const hasContent =
                    content &&
                    ((content.key_terms && content.key_terms.length > 0) ||
                      (content.negotiation_tips && content.negotiation_tips.length > 0) ||
                      (content.counter_frameworks && content.counter_frameworks.length > 0));

                  return (
                    <div
                      key={pb.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
                    >
                      {/* Card header */}
                      <button
                        onClick={() => toggleCard(pb.id)}
                        className="w-full text-left p-5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-medium text-white">{pb.title}</h3>
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${DEAL_TYPE_COLORS[pb.deal_type] || 'bg-slate-700 text-slate-300'}`}>
                                {formatDealType(pb.deal_type)}
                              </span>
                              {pb.is_system && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                                  System
                                </span>
                              )}
                            </div>
                            {pb.description && (
                              <p className="text-sm text-slate-400 mt-1">{pb.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                              {pb.therapeutic_area && <span>{pb.therapeutic_area}</span>}
                              {pb.phase && <span>{pb.phase}</span>}
                              <span>Created {new Date(pb.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="ml-3 mt-1 text-slate-500">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Expanded content */}
                      <div
                        className={`overflow-hidden transition-all duration-200 ${
                          isExpanded && hasContent ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                      {hasContent && (
                        <div className="border-t border-slate-800 p-5 space-y-6">
                          {/* Key Terms */}
                          {content.key_terms && content.key_terms.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-white mb-3">Key Terms</h4>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr>
                                    <th className="text-left text-xs text-slate-500 pb-2 font-medium">Term</th>
                                    <th className="text-left text-xs text-slate-500 pb-2 font-medium">Benchmark Range</th>
                                    <th className="text-left text-xs text-slate-500 pb-2 font-medium">Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {content.key_terms.map((kt, i) => (
                                    <tr key={i}>
                                      <td className="py-1.5 text-slate-300 border-t border-slate-800 font-medium">{kt.term}</td>
                                      <td className="py-1.5 text-slate-300 border-t border-slate-800">{kt.benchmark_range}</td>
                                      <td className="py-1.5 text-slate-400 border-t border-slate-800">{kt.notes}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Negotiation Tips */}
                          {content.negotiation_tips && content.negotiation_tips.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-white mb-3">Negotiation Tips</h4>
                              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
                                {content.negotiation_tips.map((tip, i) => (
                                  <li key={i}>{tip}</li>
                                ))}
                              </ol>
                            </div>
                          )}

                          {/* Counter-Proposal Frameworks */}
                          {content.counter_frameworks && content.counter_frameworks.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-white mb-3">Counter-Proposal Frameworks</h4>
                              <div className="space-y-1">
                                {content.counter_frameworks.map((cf, i) => {
                                  const counterKey = `${pb.id}-counter-${i}`;
                                  const isOpen = expandedCounters.has(counterKey);
                                  return (
                                    <div key={i} className="border border-slate-800 rounded-lg">
                                      <button
                                        onClick={() => toggleCounter(counterKey)}
                                        className="w-full text-left flex items-center justify-between py-2 px-3 text-sm text-slate-300 hover:text-white transition-colors"
                                      >
                                        <span>{cf.scenario}</span>
                                        <ChevronDown
                                          className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                                        />
                                      </button>
                                      {isOpen && (
                                        <div className="text-sm text-slate-400 pl-4 pb-2 pr-3">
                                          {cf.response}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      </div>

                      <div
                        className={`overflow-hidden transition-all duration-200 ${
                          isExpanded && !hasContent ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="border-t border-slate-800 p-5">
                          <p className="text-sm text-slate-500 italic">No template content defined for this playbook.</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
