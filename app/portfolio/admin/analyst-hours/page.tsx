'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Clock, Plus, TrendingDown, X, Loader2, AlertTriangle } from 'lucide-react';

interface HoursData {
  used: number;
  allocated: number;
  remaining: number;
}

interface HourEntry {
  id: string;
  description: string;
  hours: number;
  service_date: string;
  category: string;
  created_at: string;
}

const CATEGORIES = [
  { value: 'research', label: 'Research' },
  { value: 'report', label: 'Report' },
  { value: 'call', label: 'Call' },
  { value: 'custom', label: 'Custom' },
];

export default function AnalystHoursPage() {
  const [hoursData, setHoursData] = useState<HoursData | null>(null);
  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [hoursFieldError, setHoursFieldError] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Form state
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('research');

  // Escape key handler for modal
  useEffect(() => {
    if (!showModal) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowModal(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch('/api/portfolio/analyst-hours')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setEntries(json.entries || []);
          setHoursData({
            used: json.allocation.used,
            allocated: json.allocation.monthly,
            remaining: json.allocation.remaining,
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function resetForm() {
    setDescription('');
    setHours('');
    setServiceDate(new Date().toISOString().slice(0, 10));
    setCategory('research');
    setFormError('');
    setHoursFieldError('');
  }

  function handleHoursChange(value: string) {
    setHours(value);
    const parsed = parseFloat(value);
    if (value && (isNaN(parsed) || parsed <= 0)) {
      setHoursFieldError('Hours must be positive');
    } else {
      setHoursFieldError('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    const parsedHours = parseFloat(hours);
    if (!description.trim()) {
      setFormError('Description is required.');
      return;
    }
    if (isNaN(parsedHours) || parsedHours <= 0) {
      setFormError('Hours must be a positive number.');
      return;
    }
    if (!serviceDate) {
      setFormError('Service date is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/portfolio/analyst-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          hours: parsedHours,
          service_date: serviceDate,
          category,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Failed to log hours.');
        return;
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
      </div>
    );
  }

  const percentUsed = hoursData ? Math.round((hoursData.used / hoursData.allocated) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Clock className="w-6 h-6 text-teal-400" />
        Analyst Hours
      </h1>

      <p className="text-sm text-slate-400">
        Track and manage your dedicated analyst service hours
      </p>

      {hoursData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-white">{hoursData.remaining}h</p>
            <p className="text-xs text-slate-400 mt-1">Remaining This Month</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-amber-400">{hoursData.used}h</p>
            <p className="text-xs text-slate-400 mt-1">Used This Month</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-teal-400">{hoursData.allocated}h</p>
            <p className="text-xs text-slate-400 mt-1">Monthly Allocation</p>
          </div>
        </div>
      )}

      {hoursData && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-400">Monthly Usage</span>
            <span className="text-xs text-slate-500">{percentUsed}%</span>
          </div>
          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentUsed > 80 ? 'bg-amber-500' : 'bg-teal-500'
              }`}
              style={{ width: `${Math.min(100, percentUsed)}%` }}
            />
          </div>
          {percentUsed > 80 && (
            <div className="flex items-center gap-2 mt-3 p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-400">
                {percentUsed >= 100
                  ? 'Monthly analyst hours fully used. Contact your account manager to add additional hours.'
                  : `${percentUsed}% of your monthly allocation used. Consider prioritizing remaining hours for high-impact requests.`}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white">Service History</h2>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Hours
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-8">
            <TrendingDown className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No analyst hours logged yet this month.</p>
            <p className="text-xs text-slate-600 mt-1">
              Contact your Ambrosia analyst to request custom research, reports, or calls.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Description</th>
                <th className="text-left py-2">Category</th>
                <th className="text-right py-2">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="py-2 text-slate-400 text-xs">{new Date(entry.service_date).toLocaleDateString()}</td>
                  <td className="py-2 text-white">{entry.description}</td>
                  <td className="py-2 text-slate-400 text-xs capitalize">{entry.category}</td>
                  <td className="py-2 text-right text-teal-400 font-medium">{entry.hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Log Hours Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div ref={modalRef} className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Log Analyst Hours</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g., Market landscape research for OncoVista"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={hours}
                    onChange={e => handleHoursChange(e.target.value)}
                    placeholder="2.0"
                    className={`w-full bg-slate-800 border rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-colors ${
                      hoursFieldError
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                        : 'border-slate-700 focus:border-teal-500 focus:ring-teal-500'
                    }`}
                  />
                  {hoursFieldError && (
                    <p className="text-xs text-red-400 mt-1">{hoursFieldError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Service Date</label>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={e => setServiceDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-lg">
                  <p className="text-xs text-red-400">{formError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-400 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg hover:shadow-lg hover:shadow-teal-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Log Hours'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
