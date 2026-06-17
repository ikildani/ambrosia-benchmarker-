'use client';

import { useEffect, useState } from 'react';
import { Shield, Download, Search } from 'lucide-react';

interface AuditEntry {
  id: string;
  user_email: string;
  action: string;
  resource: string;
  resource_id: string | null;
  ip_address: string | null;
  status: string;
  created_at: string;
  details: Record<string, unknown>;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ENTRIES_PER_PAGE = 50;

  useEffect(() => {
    fetch('/api/portfolio/dashboard')
      .then(res => res.json())
      .then(json => {
        if (json.success) setEntries(json.recentActivity || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatAction = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const filtered = entries.filter(e => {
    if (filterAction && !e.action.includes(filterAction)) return false;
    if (filterUser && !e.user_email?.toLowerCase().includes(filterUser.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ENTRIES_PER_PAGE);
  const paginatedEntries = filtered.slice((currentPage - 1) * ENTRIES_PER_PAGE, currentPage * ENTRIES_PER_PAGE);

  const exportCSV = () => {
    const header = 'Timestamp,User,Action,Resource,Resource ID,IP,Status\n';
    const rows = filtered.map(e =>
      `${e.created_at},${e.user_email},${e.action},${e.resource},${e.resource_id || ''},${e.ip_address || ''},${e.status}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-teal-400" />
            Audit Log
          </h1>
          <p className="text-sm text-slate-400 mt-1">Complete record of all team actions for compliance and security</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Filter by user..."
            value={filterUser}
            onChange={(e) => { setFilterUser(e.target.value); setCurrentPage(1); }}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <input
          type="text"
          placeholder="Filter by action..."
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setCurrentPage(1); }}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 w-48"
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-12">No audit events found.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">Timestamp</th>
                <th className="text-left px-5 py-3">User</th>
                <th className="text-left px-5 py-3">Action</th>
                <th className="text-left px-5 py-3">Resource</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paginatedEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-800/30 transition-colors text-sm">
                  <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3 text-white">{entry.user_email?.split('@')[0] || '—'}</td>
                  <td className="px-5 py-3 text-slate-300 text-xs">{formatAction(entry.action)}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs">{entry.resource}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs ${
                      entry.status === 'success' ? 'text-teal-400' :
                      entry.status === 'failure' ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > ENTRIES_PER_PAGE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Showing {((currentPage - 1) * ENTRIES_PER_PAGE) + 1}-{Math.min(currentPage * ENTRIES_PER_PAGE, filtered.length)} of {filtered.length} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 rounded-lg transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-slate-400">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {filtered.length > 0 && filtered.length <= ENTRIES_PER_PAGE && (
        <p className="text-sm text-slate-400">Showing {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</p>
      )}
    </div>
  );
}
