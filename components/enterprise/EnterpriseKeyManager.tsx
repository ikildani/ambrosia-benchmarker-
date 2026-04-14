'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface ApiKey {
  id: string;
  organizationName: string;
  keyPrefix: string;
  tier: 'pilot' | 'growth' | 'enterprise';
  monthlyQuota: number;
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
  lastUsedAt: string | null;
  usageThisMonth: number;
}

export function EnterpriseKeyManager() {
  const { isAuthenticated, isLoading } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    refresh();
  }, [isAuthenticated]);

  async function refresh() {
    try {
      const res = await fetch('/api/enterprise/keys');
      if (!res.ok) return;
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch {
      // silent
    }
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName) {
      setError('Organization name required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/enterprise/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationName: orgName, tier: 'pilot' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Failed to create key');
        return;
      }
      setNewKey(data.key);
      setOrgName('');
      refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this key? This action cannot be undone.')) return;
    await fetch(`/api/enterprise/keys?id=${id}`, { method: 'DELETE' });
    refresh();
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-6">
        <h3 className="text-base font-semibold text-slate-200">Sign in to manage API keys</h3>
        <p className="mt-2 text-sm text-slate-400">
          Enterprise API access requires a Pro account. Start a pilot with 1,000 calls/month free.
        </p>
        <Link
          href="/calculator"
          className="mt-4 inline-block rounded-md bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* New key disclosure */}
      {newKey && (
        <div className="rounded-lg border border-teal-500/40 bg-teal-500/5 p-5">
          <h3 className="text-sm font-semibold text-teal-300">Key created — copy it now</h3>
          <p className="mt-1 text-xs text-slate-300">
            This is the only time we&rsquo;ll show the full key. Store it in your secret manager.
          </p>
          <pre className="mt-3 overflow-x-auto rounded border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-teal-200">
            {newKey}
          </pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(newKey);
            }}
            className="mt-3 text-xs font-semibold text-teal-400 hover:text-teal-300"
          >
            Copy to clipboard
          </button>
          <button
            onClick={() => setNewKey(null)}
            className="ml-3 text-xs text-slate-400 hover:text-slate-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-5">
        <h3 className="text-sm font-semibold text-slate-200">Create pilot key</h3>
        <p className="mt-1 text-xs text-slate-400">
          Free pilot tier: 1,000 calls/month. For higher tiers, email enterprise@ambrosiaventures.co.
        </p>
        <form onSubmit={createKey} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="Organization name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-teal-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create key'}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-amber-400">{error}</p>}
      </div>

      {/* Key list */}
      {keys.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-5">
          <h3 className="text-sm font-semibold text-slate-200">Your keys</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-800">
                  <th className="pb-2 pr-3 text-left font-normal">Prefix</th>
                  <th className="pb-2 pr-3 text-left font-normal">Organization</th>
                  <th className="pb-2 pr-3 text-left font-normal">Tier</th>
                  <th className="pb-2 pr-3 text-right font-normal">Usage (this mo.)</th>
                  <th className="pb-2 pr-3 text-left font-normal">Status</th>
                  <th className="pb-2 text-right font-normal">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {keys.map(k => {
                  const pct = k.monthlyQuota > 0 ? (k.usageThisMonth / k.monthlyQuota) : 0;
                  const pctColor = pct >= 0.9 ? 'text-amber-400' : pct >= 0.5 ? 'text-cyan-400' : 'text-slate-300';
                  return (
                    <tr key={k.id}>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-300">{k.keyPrefix}…</td>
                      <td className="py-2 pr-3 text-slate-300">{k.organizationName}</td>
                      <td className="py-2 pr-3 capitalize text-slate-400">{k.tier}</td>
                      <td className={`py-2 pr-3 text-right font-mono ${pctColor}`}>
                        {k.usageThisMonth.toLocaleString()} / {k.monthlyQuota.toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        <span
                          className={[
                            'rounded-full px-2 py-0.5 text-[10px] uppercase',
                            k.status === 'active' ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-700/50 text-slate-400',
                          ].join(' ')}
                        >
                          {k.status}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {k.status === 'active' && (
                          <button
                            onClick={() => revokeKey(k.id)}
                            className="text-xs text-slate-500 hover:text-amber-400"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
