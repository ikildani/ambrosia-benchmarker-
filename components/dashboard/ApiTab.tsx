'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface ApiKey {
  id: string;
  organizationName: string;
  keyPrefix: string;
  tier: 'pilot' | 'growth' | 'enterprise';
  monthlyQuota: number;
  status: 'active' | 'revoked';
  createdAt: string;
  lastUsedAt: string | null;
  usageThisMonth: number;
}

interface ApiTabProps {
  tier: string;
  userId: string;
}

const TIER_OPTIONS = [
  { value: 'pilot', label: 'Pilot', quota: '1K/mo' },
  { value: 'growth', label: 'Growth', quota: '10K/mo' },
  { value: 'enterprise', label: 'Enterprise', quota: '100K/mo' },
] as const;

const MCP_ENDPOINT = 'https://solidus.ambrosiaventures.co/api/mcp';

const CURL_EXAMPLE = `curl -X POST ${MCP_ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    pilot: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    growth: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${colors[tier] || colors.pilot}`}>
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Active
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
      Revoked
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(label ? `${label} copied` : 'Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [text, label]);

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

export default function ApiTab({ tier, userId }: ApiTabProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [orgName, setOrgName] = useState('');
  const [selectedTier, setSelectedTier] = useState<'pilot' | 'growth' | 'enterprise'>('pilot');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const hasAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  const fetchKeys = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/enterprise/keys');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load keys (${res.status})`);
      }
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchKeys();
    } else {
      setLoading(false);
    }
  }, [hasAccess, fetchKeys]);

  const handleCreate = async () => {
    if (!orgName.trim()) {
      toast.error('Organization name is required');
      return;
    }
    setCreating(true);
    setNewKey(null);
    try {
      const res = await fetch('/api/enterprise/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationName: orgName.trim(), tier: selectedTier }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create key (${res.status})`);
      }
      const data = await res.json();
      setNewKey(data.key);
      setOrgName('');
      toast.success('API key created');
      // Refresh the list
      await fetchKeys();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      const res = await fetch(`/api/enterprise/keys?id=${keyId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to revoke key (${res.status})`);
      }
      toast.success('API key revoked');
      await fetchKeys();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke key');
    } finally {
      setRevokingId(null);
    }
  };

  // Locked state for non-qualifying tiers
  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">API Access Requires Pro or Portfolio Tier</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Connect your AI agents, internal tools, and workflows to Ambrosia&apos;s 21 deal intelligence engines via the Model Context Protocol.
          </p>
          <button
            onClick={() => {
              // Dispatch upgrade event that parent handles
              window.dispatchEvent(new CustomEvent('ambrosia:upgrade'));
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* MCP Server Info */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">MCP Server &amp; Enterprise API</h3>
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 ml-12">
          Connect your AI agents, internal tools, and workflows to Ambrosia&apos;s 21 deal intelligence engines via the Model Context Protocol.
        </p>

        {/* Endpoint */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">MCP Endpoint</label>
          <div className="flex items-center gap-2 bg-slate-900 dark:bg-slate-950 rounded-lg px-4 py-3">
            <code className="text-sm text-emerald-400 font-mono flex-1 break-all">{MCP_ENDPOINT}</code>
            <CopyButton text={MCP_ENDPOINT} label="Endpoint" />
          </div>
        </div>

        {/* Quick Start */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Quick Start</label>
          <div className="relative bg-slate-900 dark:bg-slate-950 rounded-lg px-4 py-3 overflow-x-auto">
            <pre className="text-sm text-slate-300 font-mono whitespace-pre">{CURL_EXAMPLE}</pre>
            <div className="absolute top-2 right-2">
              <CopyButton text={CURL_EXAMPLE} label="Example" />
            </div>
          </div>
        </div>
      </div>

      {/* Your API Keys */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Your API Keys</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-blue-600 rounded-full animate-spin" />
            <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">Loading keys...</span>
          </div>
        ) : error ? (
          <div className="py-6 text-center">
            <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>
            <button
              onClick={() => { setLoading(true); fetchKeys(); }}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : keys.length === 0 ? (
          <div className="py-8 text-center">
            <svg className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-400">No API keys yet. Create one below to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((k) => (
              <div
                key={k.id}
                className={`p-4 rounded-xl border transition-colors ${
                  k.status === 'active'
                    ? 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                    : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/50 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <code className="text-sm font-mono font-semibold text-slate-900 dark:text-white">{k.keyPrefix}...</code>
                      <TierBadge tier={k.tier} />
                      <StatusBadge status={k.status} />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">{k.organizationName}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
                      <span>Created {formatDate(k.createdAt)}</span>
                      <span>Last used {formatDate(k.lastUsedAt)}</span>
                      <span>Quota: {k.usageThisMonth.toLocaleString()} / {k.monthlyQuota.toLocaleString()}</span>
                    </div>
                  </div>
                  {k.status === 'active' && (
                    <button
                      onClick={() => handleRevoke(k.id)}
                      disabled={revokingId === k.id}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {revokingId === k.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Newly Created Key Display */}
      {newKey && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Save this key -- it cannot be retrieved again</h4>
              <div className="flex items-center gap-2 bg-slate-900 dark:bg-slate-950 rounded-lg px-4 py-3 mt-2">
                <code className="text-sm text-emerald-400 font-mono flex-1 break-all select-all">{newKey}</code>
                <CopyButton text={newKey} label="API key" />
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Key */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Create New Key</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Acme Therapeutics"
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {TIER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedTier(opt.value)}
                  className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                    selectedTier === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500'
                      : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                  }`}
                >
                  <span className="block">{opt.label}</span>
                  <span className="block text-xs mt-0.5 opacity-70">{opt.quota}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating || !orgName.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-slate-800 dark:bg-slate-600 text-white hover:bg-slate-700 dark:hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Generate API Key
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
