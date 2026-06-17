'use client';

import { useEffect, useState } from 'react';
import { Library, Plus, Pin, Trash2, MessageSquare, Lock, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { isScalePlus } from '@/lib/portfolio/feature-gates';

interface CompSet {
  id: string;
  name: string;
  description: string | null;
  filters: Record<string, unknown>;
  deal_ids: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

function ScaleGate() {
  return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-500/10 mb-6">
        <Lock className="w-8 h-8 text-teal-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-3">Shared Comp Library</h1>
      <p className="text-slate-400 mb-6">
        The shared comp library is available on the Scale and Enterprise tiers. Upgrade to save and share comparable deal sets across your fund.
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

export default function CompLibraryPage() {
  const { portfolioSubTier } = useAuth();
  const [compSets, setCompSets] = useState<CompSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const hasAccess = isScalePlus(portfolioSubTier);

  const fetchCompSets = () => {
    setLoading(true);
    fetch('/api/portfolio/comp-sets')
      .then(res => res.json())
      .then(json => {
        if (json.success) setCompSets(json.compSets || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!hasAccess) return;
    fetchCompSets();
  }, [hasAccess]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/portfolio/comp-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDescription, dealIds: [], filters: {} }),
      });
      const json = await res.json();
      if (json.success) {
        setNewName('');
        setNewDescription('');
        setShowCreateForm(false);
        fetchCompSets();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this comp set?')) return;
    try {
      const res = await fetch(`/api/portfolio/comp-sets?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) fetchCompSets();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePin = async (id: string, currentPinned: boolean) => {
    try {
      const res = await fetch('/api/portfolio/comp-sets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isPinned: !currentPinned }),
      });
      const json = await res.json();
      if (json.success) fetchCompSets();
    } catch (err) {
      console.error(err);
    }
  };

  if (!hasAccess) return <ScaleGate />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Library className="w-6 h-6 text-teal-400" />
          Shared Comp Library
        </h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Comp Set
        </button>
      </div>

      <p className="text-sm text-slate-400">
        Shared comparable deal sets accessible to all team members
      </p>

      {showCreateForm && (
        <div className="bg-slate-900 border border-teal-500/30 rounded-xl p-6 space-y-4">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="comp-set-name" className="block text-sm font-medium text-slate-300 mb-1">
                Name
              </label>
              <input
                id="comp-set-name"
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Oncology Licensing 2024"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label htmlFor="comp-set-description" className="block text-sm font-medium text-slate-300 mb-1">
                Description (optional)
              </label>
              <textarea
                id="comp-set-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Brief description of this comp set..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setNewName(''); setNewDescription(''); }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500" />
        </div>
      ) : compSets.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 border-dashed rounded-xl p-12 text-center">
          <Library className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-1">No comp sets yet</h3>
          <p className="text-sm text-slate-400 mb-4">
            Build your fund&apos;s shared comparable deals library. Comp sets you create are accessible to all team members.
          </p>
          <p className="text-xs text-slate-500 mb-4">
            Comps are created from calculation results — run a benchmark first, then save the comparable deals here.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Open Calculator
          </a>
        </div>
      ) : (
        <div className="grid gap-4">
          {compSets.map((set) => (
            <div key={set.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium text-white">{set.name}</h3>
                    {set.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  {set.description && (
                    <p className="text-sm text-slate-400 mt-1">{set.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span>{set.deal_ids?.length || 0} deals</span>
                    <span>Updated {new Date(set.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-slate-500 hover:text-slate-300 p-1 cursor-default relative group"
                    title="Annotations — Coming Soon"
                    aria-label="Annotations — Coming Soon"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-slate-300 bg-slate-800 border border-slate-700 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      Coming Soon
                    </span>
                  </button>
                  <button
                    onClick={() => handlePin(set.id, set.is_pinned)}
                    className={`${set.is_pinned ? 'text-amber-400' : 'text-slate-500'} hover:text-amber-400 p-1`}
                    title={set.is_pinned ? 'Unpin' : 'Pin'}
                    aria-label={set.is_pinned ? 'Unpin comp set' : 'Pin comp set'}
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(set.id)}
                    className="text-slate-500 hover:text-red-400 p-1"
                    title="Delete"
                    aria-label="Delete comp set"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
