'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Clock, Bell, BarChart3, Activity, TrendingUp, CheckSquare, Circle } from 'lucide-react';

interface DashboardData {
  team: {
    name: string;
    portfolio_tier: string;
    max_seats: number;
    analyst_hours_monthly: number;
    contract_start_date: string;
    contract_end_date: string | null;
  };
  seats: { active: number; pending: number; max: number; utilization: number };
  analystHours: { used: number; allocated: number; remaining: number };
  activeAlerts: number;
  recentActivity: Array<{
    id: string;
    user_email: string;
    action: string;
    resource: string;
    created_at: string;
    details: Record<string, unknown>;
  }>;
  onboarding: {
    hasLogo: boolean;
    hasMembers: boolean;
    hasAlerts: boolean;
    hasCalculations: boolean;
    hasSlack: boolean;
    tier: string;
  };
}

function StatCard({ icon: Icon, label, value, subtext, color }: {
  icon: typeof Users;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:bg-slate-800/80 transition-colors cursor-default">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  );
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

interface ChecklistItem {
  key: string;
  label: string;
  completed: boolean;
  href: string;
  scaleOnly?: boolean;
}

function OnboardingChecklist({ onboarding, onDismiss }: {
  onboarding: DashboardData['onboarding'];
  onDismiss: () => void;
}) {
  const items: ChecklistItem[] = [
    {
      key: 'logo',
      label: 'Upload your fund logo',
      completed: onboarding.hasLogo,
      href: '/portfolio/admin/settings',
    },
    {
      key: 'members',
      label: 'Invite your first team member',
      completed: onboarding.hasMembers,
      href: '/portfolio/admin/team',
    },
    {
      key: 'alerts',
      label: 'Configure deal alerts',
      completed: onboarding.hasAlerts,
      href: '/portfolio/admin/alerts',
    },
    {
      key: 'calculations',
      label: 'Run your first calculation',
      completed: onboarding.hasCalculations,
      href: '/calculator',
    },
    {
      key: 'slack',
      label: 'Set up Slack notifications',
      completed: onboarding.hasSlack,
      href: '/portfolio/admin/settings',
      scaleOnly: true,
    },
  ];

  const visibleItems = items.filter(item => !item.scaleOnly || onboarding.tier === 'scale');
  const completedCount = visibleItems.filter(i => i.completed).length;
  const totalCount = visibleItems.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="bg-slate-800/50 border border-indigo-500/30 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Getting Started</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {completedCount} of {totalCount} complete
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-700/50"
        >
          Dismiss
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="space-y-2">
        {visibleItems.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-700/40 transition-colors group"
          >
            {item.completed ? (
              <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-slate-600 shrink-0 group-hover:text-indigo-400 transition-colors" />
            )}
            <span className={item.completed ? 'text-slate-500 line-through' : 'text-slate-200'}>
              {item.label}
            </span>
            {item.scaleOnly && (
              <span className="text-[10px] uppercase tracking-wider text-indigo-400/60 bg-indigo-500/10 px-1.5 py-0.5 rounded ml-auto">
                Scale+
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioAdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('portfolio-onboarding-dismissed');
    if (dismissed === 'true') setOnboardingDismissed(true);
  }, []);

  useEffect(() => {
    fetch('/api/portfolio/dashboard')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetch('/api/portfolio/dashboard')
        .then(res => res.json())
        .then(json => { if (json.success) setData(json); })
        .catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        <p className="text-sm text-slate-400">Loading your dashboard...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-slate-400 py-20">
        <p>Failed to load dashboard data.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{data.team.name}</h1>
          <p className="text-sm text-slate-400 mt-1">
            Portfolio License — {data.team.portfolio_tier.charAt(0).toUpperCase() + data.team.portfolio_tier.slice(1)} Tier
          </p>
          <p className="text-sm text-slate-400 mt-0.5">Overview of your portfolio&apos;s benchmarking activity</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>Contract: {new Date(data.team.contract_start_date).toLocaleDateString()}</p>
          {data.team.contract_end_date && (
            <p>Renews: {new Date(data.team.contract_end_date).toLocaleDateString()}</p>
          )}
        </div>
      </div>

      {data.onboarding && !onboardingDismissed && (() => {
        const items = [
          data.onboarding.hasLogo,
          data.onboarding.hasMembers,
          data.onboarding.hasAlerts,
          data.onboarding.hasCalculations,
          ...(data.onboarding.tier === 'scale' ? [data.onboarding.hasSlack] : []),
        ];
        const allComplete = items.every(Boolean);
        if (allComplete) return null;
        return (
          <OnboardingChecklist
            onboarding={data.onboarding}
            onDismiss={() => {
              setOnboardingDismissed(true);
              localStorage.setItem('portfolio-onboarding-dismissed', 'true');
            }}
          />
        );
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Active Seats"
          value={`${data.seats.active} / ${data.seats.max}`}
          subtext={data.seats.pending > 0 ? `${data.seats.pending} pending` : `${data.seats.utilization}% utilized`}
          color="bg-teal-500/10 text-teal-400"
        />
        <StatCard
          icon={Clock}
          label="Analyst Hours"
          value={`${data.analystHours.remaining}h`}
          subtext={`${data.analystHours.used}h used of ${data.analystHours.allocated}h/mo`}
          color="bg-amber-500/10 text-amber-400"
        />
        <StatCard
          icon={Bell}
          label="Active Alerts"
          value={data.activeAlerts}
          subtext="Deal alert configurations"
          color="bg-blue-500/10 text-blue-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Tier"
          value={data.team.portfolio_tier.charAt(0).toUpperCase() + data.team.portfolio_tier.slice(1)}
          subtext={`${data.team.max_seats} seats, ${data.team.analyst_hours_monthly}h analyst/mo`}
          color="bg-purple-500/10 text-purple-400"
        />
      </div>

      {/* Seat utilization bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-300 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-400" />
            Seat Utilization
          </h2>
          <span className="text-xs text-slate-400">{data.seats.utilization}%</span>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, data.seats.utilization)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>{data.seats.active} active</span>
          <span>{data.seats.max - data.seats.active} available</span>
        </div>
        {data.seats.utilization >= 80 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <Bell className="w-3.5 h-3.5 shrink-0" />
            <span>Approaching seat limit — contact support to add seats</span>
          </div>
        )}
      </div>

      {/* Recent activity feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-slate-300 flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-teal-400" />
          Recent Activity
        </h2>
        {data.recentActivity.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500">
              Activity appears here as team members run benchmarks.
            </p>
            <Link
              href="/portfolio/admin/members"
              className="text-sm text-teal-400 hover:text-teal-300 mt-2 inline-block transition-colors"
            >
              Invite your first member to get started &rarr;
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {data.recentActivity.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 text-sm border-b border-slate-800/50 pb-3 last:border-0"
                >
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-teal-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300">
                      <span className="text-white font-medium">{event.user_email?.split('@')[0] || 'System'}</span>
                      {' '}
                      {formatAction(event.action)}
                      {event.resource && (
                        <span className="text-slate-500"> · {event.resource}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/50">
              <Link
                href="/portfolio/admin/audit"
                className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
              >
                View Full Audit Log &rarr;
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
