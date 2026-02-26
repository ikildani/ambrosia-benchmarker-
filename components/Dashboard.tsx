'use client';

import { useState, useEffect, useMemo, startTransition } from 'react';
import { toast } from 'sonner';
import { clearHistory, getHistoryItemWithDefaults, type CalculationHistoryItem } from '@/lib/history';
import { useCalculationHistory } from '@/lib/hooks/useCalculationHistory';
import HistoryDetailModal from './HistoryDetailModal';
import WatchlistPanel from './watchlist/WatchlistPanel';
import DashboardNav from './dashboard/DashboardNav';
import OverviewTab from './dashboard/OverviewTab';
import HistoryTab from './dashboard/HistoryTab';
import SettingsTab from './dashboard/SettingsTab';

// Avatar gradient options - premium color combinations
const AVATAR_GRADIENTS = [
  { id: 'ocean', from: 'from-cyan-500', to: 'to-blue-600', label: 'Ocean' },
  { id: 'aurora', from: 'from-violet-500', to: 'to-fuchsia-500', label: 'Aurora' },
  { id: 'sunset', from: 'from-orange-400', to: 'to-rose-500', label: 'Sunset' },
  { id: 'forest', from: 'from-emerald-500', to: 'to-teal-600', label: 'Forest' },
  { id: 'midnight', from: 'from-indigo-600', to: 'to-purple-700', label: 'Midnight' },
  { id: 'slate', from: 'from-slate-500', to: 'to-zinc-600', label: 'Slate' },
];

function getAvatarGradient(id: string | null) {
  return AVATAR_GRADIENTS.find(g => g.id === id) || AVATAR_GRADIENTS[0];
}

interface DashboardProps {
  userName: string;
  userEmail: string;
  tier: 'free' | 'pro' | 'report';
  onNavigateToCalculator: () => void;
  onUpgrade: () => void;
  onSignOut: () => void;
}

export default function Dashboard({
  userName,
  userEmail,
  tier,
  onNavigateToCalculator,
  onUpgrade,
  onSignOut,
}: DashboardProps) {
  const { history, loading: historyLoading, deleteItem: deleteHistoryItem } = useCalculationHistory();
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'watchlist' | 'settings'>(() => {
    // Support deep links: /dashboard?tab=settings from email unsubscribe
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'settings' || tab === 'watchlist' || tab === 'history') return tab;
    }
    return 'overview';
  });
  const [editName, setEditName] = useState(userName);
  const [editCompany, setEditCompany] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLinkedIn, setEditLinkedIn] = useState('');
  const [editRole, setEditRole] = useState('');
  const [memberSince, setMemberSince] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<CalculationHistoryItem | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('ocean');
  const [historySearch, setHistorySearch] = useState('');
  const [historyAreaFilter, setHistoryAreaFilter] = useState<'all' | 'oncology' | 'neurology' | 'immunology'>('all');
  const [historySort, setHistorySort] = useState<'newest' | 'oldest' | 'highest_value' | 'highest_upfront'>('newest');
  const [watchlistNewCount, setWatchlistNewCount] = useState(0);

  // Filtered and sorted history
  const filteredHistory = useMemo(() => {
    let filtered = [...history];

    // Area filter
    if (historyAreaFilter !== 'all') {
      filtered = filtered.filter(item => item.inputs.therapeuticArea === historyAreaFilter);
    }

    // Search filter
    if (historySearch.trim()) {
      const query = historySearch.toLowerCase();
      filtered = filtered.filter(item =>
        item.labels.phase.toLowerCase().includes(query) ||
        item.labels.modality.toLowerCase().includes(query) ||
        item.labels.indication.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (historySort) {
      case 'oldest':
        filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        break;
      case 'highest_value':
        filtered.sort((a, b) => b.results.totalValueMedian - a.results.totalValueMedian);
        break;
      case 'highest_upfront':
        filtered.sort((a, b) => b.results.upfrontMedian - a.results.upfrontMedian);
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        break;
    }

    return filtered;
  }, [history, historySearch, historyAreaFilter, historySort]);

  useEffect(() => {
    // Load user data from localStorage first (instant)
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        setEditCompany(parsed.company || '');
        setEditTitle(parsed.title || '');
        setEditPhone(parsed.phone || '');
        setEditLinkedIn(parsed.linkedIn || '');
        setEditRole(parsed.role || '');
        setMemberSince(parsed.createdAt || new Date().toISOString());
        setSelectedAvatar(parsed.avatarGradient || 'ocean');
      } catch {
        // ignore
      }
    }

    // Then hydrate from Supabase DB (authoritative source)
    (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        if (!supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name, company_name, job_title, phone_number, linkedin_url, deal_role, avatar_gradient, created_at')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          // Only override if DB has non-null values (DB is authoritative)
          if (profile.full_name) setEditName(profile.full_name);
          if (profile.company_name) setEditCompany(profile.company_name);
          if (profile.job_title) setEditTitle(profile.job_title);
          if (profile.phone_number) setEditPhone(profile.phone_number);
          if (profile.linkedin_url) setEditLinkedIn(profile.linkedin_url);
          if (profile.deal_role) setEditRole(profile.deal_role);
          if (profile.avatar_gradient) setSelectedAvatar(profile.avatar_gradient);
          if (profile.created_at) setMemberSince(profile.created_at);

          // Sync DB values back to localStorage
          const existing = localStorage.getItem('user_data');
          if (existing) {
            try {
              const parsed = JSON.parse(existing);
              if (profile.full_name) parsed.name = profile.full_name;
              if (profile.company_name) parsed.company = profile.company_name;
              if (profile.job_title) parsed.title = profile.job_title;
              if (profile.phone_number) parsed.phone = profile.phone_number;
              if (profile.linkedin_url) parsed.linkedIn = profile.linkedin_url;
              if (profile.deal_role) parsed.role = profile.deal_role;
              if (profile.avatar_gradient) parsed.avatarGradient = profile.avatar_gradient;
              localStorage.setItem('user_data', JSON.stringify(parsed));
            } catch { /* ignore */ }
          }
        }
      } catch {
        // Non-blocking: localStorage data is still available
      }
    })();
  }, []);

  // Fetch watchlist activity count for notification dot
  useEffect(() => {
    if (tier !== 'pro') return;
    const userData = localStorage.getItem('user_data');
    if (!userData) return;
    try {
      const parsed = JSON.parse(userData);
      if (!parsed.id) return;
      const lastViewed = localStorage.getItem('last_viewed_watchlist');
      fetch(`/api/watchlist/activity?user_id=${parsed.id}&days=7`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.activity) {
            if (lastViewed) {
              const cutoff = new Date(lastViewed);
              const newItems = data.activity.filter((a: any) => new Date(a.date || a.announced_date) > cutoff);
              setWatchlistNewCount(newItems.length);
            } else {
              setWatchlistNewCount(data.activity.length);
            }
          }
        })
        .catch(() => {});
    } catch {}
  }, [tier]);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      await deleteHistoryItem(id);
      toast.success('Analysis deleted');
    } catch (error) {
      console.error('Failed to delete history item:', error);
      toast.error('Failed to delete. Please try again.');
    }
  };

  const handleHistoryClick = (item: CalculationHistoryItem) => {
    setSelectedHistoryItem(item);
    setShowHistoryModal(true);
  };

  const handleReuseInputs = (item: CalculationHistoryItem) => {
    // Store inputs in sessionStorage for calculator to pick up
    sessionStorage.setItem('prefill_calculation', JSON.stringify(item.inputs));
    setShowHistoryModal(false);
    onNavigateToCalculator();
  };

  const handleRecalculate = (item: CalculationHistoryItem) => {
    const itemWithDefaults = getHistoryItemWithDefaults(item);
    sessionStorage.setItem('prefill_calculation', JSON.stringify(itemWithDefaults.inputs));
    onNavigateToCalculator();
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // 1. Update localStorage immediately for instant UI sync
      const userData = localStorage.getItem('user_data');
      if (userData) {
        const parsed = JSON.parse(userData);
        parsed.name = editName;
        parsed.company = editCompany;
        parsed.title = editTitle;
        parsed.phone = editPhone;
        parsed.linkedIn = editLinkedIn;
        parsed.role = editRole;
        parsed.avatarGradient = selectedAvatar;
        localStorage.setItem('user_data', JSON.stringify(parsed));

        // Also update profile cache for re-login
        if (parsed.email) {
          const emailKey = `profile_cache_${parsed.email.toLowerCase().trim()}`;
          localStorage.setItem(emailKey, JSON.stringify({
            name: editName,
            company: editCompany,
            title: editTitle,
            phone: editPhone,
            linkedIn: editLinkedIn,
            role: editRole,
          }));
        }
      }

      // 2. Persist to Supabase database
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const res = await fetch('/api/user/profile', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                full_name: editName,
                company_name: editCompany,
                job_title: editTitle,
                phone_number: editPhone,
                linkedin_url: editLinkedIn,
                deal_role: editRole,
                avatar_gradient: selectedAvatar,
              }),
            });
            if (!res.ok) {
              console.warn('Profile API save failed:', res.status);
            }
          }
        }
      } catch (apiErr) {
        // Non-blocking: localStorage save succeeded, DB sync failed silently
        console.warn('Profile DB sync failed:', apiErr);
      }

      toast.success('Settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = () => {
    const exportData = {
      user: {
        name: editName,
        email: userEmail,
        company: editCompany,
        title: editTitle,
        phone: editPhone,
        linkedIn: editLinkedIn,
        role: editRole,
        memberSince: memberSince,
      },
      history: history,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deal-calculator-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = () => {
    clearHistory();
    localStorage.removeItem('user_data');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('user_tier');
    onSignOut();
  };

  const handleTabChange = (tab: 'overview' | 'history' | 'watchlist' | 'settings') => {
    startTransition(() => {
      setActiveTab(tab);
    });
    if (tab === 'watchlist') {
      setWatchlistNewCount(0);
      localStorage.setItem('last_viewed_watchlist', new Date().toISOString());
    }
  };

  const recentCalculations = history.slice(0, 5);

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
    return `$${value}M`;
  };

  const getTopPhase = () => {
    if (history.length === 0) return '-';
    const counts: Record<string, number> = {};
    history.forEach(h => {
      const phase = h.labels.phase;
      counts[phase] = (counts[phase] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || '-';
  };
  const topPhase = getTopPhase();

  const getTopModality = () => {
    if (history.length === 0) return '-';
    const counts: Record<string, number> = {};
    history.forEach(h => {
      const mod = h.labels.modality;
      counts[mod] = (counts[mod] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || '-';
  };
  const topModality = getTopModality();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 transition-colors duration-300 pt-16 sm:pt-20 lg:pt-24">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Welcome Banner - Mobile optimized */}
        <div className="mb-6 sm:mb-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
          </div>
          <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-teal-500/20 rounded-full blur-3xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
            <div className="text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                <span className="text-teal-400 text-sm font-medium">{getGreeting()}</span>
                {(tier === 'pro' || tier === 'report') && (
                  <span className="px-2 py-0.5 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold rounded-full">{tier === 'report' ? 'Report' : 'Pro'} Member</span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1.5 sm:mb-2">Welcome back, {userName.split(' ')[0]}!</h1>
              <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto sm:mx-0">
                Access your deal analysis tools, review past calculations, and download reports.
              </p>
            </div>
            {/* Hide CTA on mobile - FAB handles this */}
            <button
              onClick={onNavigateToCalculator}
              className="hidden sm:inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm sm:text-base font-semibold rounded-xl
                       shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 transition-all hover:-translate-y-0.5 touch-feedback"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>New Calculation</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <DashboardNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          watchlistNewCount={watchlistNewCount}
        />

        {/* Content - all tabs stay mounted, visibility toggled via CSS for instant switching */}
        <div>
          <div
            style={{ display: activeTab === 'overview' ? 'block' : 'none' }}
            role="tabpanel"
            id="tabpanel-overview"
            aria-labelledby="tab-overview"
          >
            <OverviewTab
              history={history}
              recentCalculations={recentCalculations}
              topPhase={topPhase}
              topModality={topModality}
              tier={tier}
              onNavigateToCalculator={onNavigateToCalculator}
              onUpgrade={onUpgrade}
              onHistoryClick={handleHistoryClick}
              formatCurrency={formatCurrency}
            />
          </div>

          <div
            style={{ display: activeTab === 'history' ? 'block' : 'none' }}
            role="tabpanel"
            id="tabpanel-history"
            aria-labelledby="tab-history"
          >
            <HistoryTab
              history={history}
              filteredHistory={filteredHistory}
              historyLoading={historyLoading}
              historySearch={historySearch}
              historyAreaFilter={historyAreaFilter}
              historySort={historySort}
              onSearchChange={setHistorySearch}
              onAreaFilterChange={setHistoryAreaFilter}
              onSortChange={setHistorySort}
              onHistoryClick={handleHistoryClick}
              onDeleteHistory={handleDeleteHistory}
              onRecalculate={handleRecalculate}
              onNavigateToCalculator={onNavigateToCalculator}
              formatCurrency={formatCurrency}
            />
          </div>

          <div
            style={{ display: activeTab === 'watchlist' ? 'block' : 'none' }}
            role="tabpanel"
            id="tabpanel-watchlist"
            aria-labelledby="tab-watchlist"
          >
            <WatchlistPanel tier={tier} onUpgrade={onUpgrade} />
          </div>

          <div
            style={{ display: activeTab === 'settings' ? 'block' : 'none' }}
            role="tabpanel"
            id="tabpanel-settings"
            aria-labelledby="tab-settings"
          >
            <SettingsTab
              editName={editName}
              userEmail={userEmail}
              editCompany={editCompany}
              editTitle={editTitle}
              editPhone={editPhone}
              editLinkedIn={editLinkedIn}
              editRole={editRole}
              memberSince={memberSince}
              selectedAvatar={selectedAvatar}
              isSaving={isSaving}
              saveMessage={saveMessage}
              showDeleteConfirm={showDeleteConfirm}
              tier={tier}
              history={history}
              avatarGradients={AVATAR_GRADIENTS}
              getAvatarGradient={getAvatarGradient}
              onEditName={setEditName}
              onEditCompany={setEditCompany}
              onEditTitle={setEditTitle}
              onEditPhone={setEditPhone}
              onEditLinkedIn={setEditLinkedIn}
              onEditRole={setEditRole}
              onSelectAvatar={setSelectedAvatar}
              onSaveSettings={handleSaveSettings}
              onExportData={handleExportData}
              onSignOut={onSignOut}
              onShowDeleteConfirm={setShowDeleteConfirm}
              onDeleteAccount={handleDeleteAccount}
              onUpgrade={onUpgrade}
            />
          </div>
        </div>
      </div>

      {/* History Detail Modal */}
      <HistoryDetailModal
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false);
          // Clear selected item after a delay to allow close animation to complete
          setTimeout(() => setSelectedHistoryItem(null), 350);
        }}
        item={selectedHistoryItem}
        tier={tier}
        onReuse={handleReuseInputs}
        onUpgrade={onUpgrade}
        userEmail={userEmail}
      />

      {/* Floating Action Button - Mobile Only */}
      <button
        onClick={onNavigateToCalculator}
        className="sm:hidden fixed bottom-6 right-4 w-14 h-14 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-2xl shadow-lg shadow-teal-500/40 flex items-center justify-center z-50 fab-pulse touch-feedback safe-bottom"
        aria-label="New Calculation"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
