'use client';

import { useEffect, useState } from 'react';
import { Clock, Plus, TrendingDown } from 'lucide-react';

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

export default function AnalystHoursPage() {
  const [hoursData, setHoursData] = useState<HoursData | null>(null);
  const [entries] = useState<HourEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/portfolio/dashboard')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setHoursData(json.analystHours);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white">Service History</h2>
          <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition-colors">
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
    </div>
  );
}
