'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { getHistory, deleteHistoryItem, clearHistory, formatDate, type CalculationHistoryItem } from '@/lib/history';
import HistoryDetailModal from './HistoryDetailModal';
import { useTheme } from '@/contexts/ThemeContext';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

// Avatar color options
const AVATAR_COLORS = [
  { id: 'teal', name: 'Teal', from: 'from-teal-400', to: 'to-cyan-500', shadow: 'shadow-teal-500/40', ring: 'ring-teal-500/20' },
  { id: 'violet', name: 'Violet', from: 'from-violet-500', to: 'to-purple-600', shadow: 'shadow-violet-500/40', ring: 'ring-violet-500/20' },
  { id: 'rose', name: 'Rose', from: 'from-rose-400', to: 'to-pink-600', shadow: 'shadow-rose-500/40', ring: 'ring-rose-500/20' },
  { id: 'amber', name: 'Amber', from: 'from-amber-400', to: 'to-orange-500', shadow: 'shadow-amber-500/40', ring: 'ring-amber-500/20' },
  { id: 'emerald', name: 'Emerald', from: 'from-emerald-400', to: 'to-green-600', shadow: 'shadow-emerald-500/40', ring: 'ring-emerald-500/20' },
  { id: 'blue', name: 'Blue', from: 'from-blue-400', to: 'to-indigo-600', shadow: 'shadow-blue-500/40', ring: 'ring-blue-500/20' },
  { id: 'slate', name: 'Slate', from: 'from-slate-500', to: 'to-slate-700', shadow: 'shadow-slate-500/40', ring: 'ring-slate-500/20' },
  { id: 'fuchsia', name: 'Fuchsia', from: 'from-fuchsia-400', to: 'to-pink-600', shadow: 'shadow-fuchsia-500/40', ring: 'ring-fuchsia-500/20' },
];

interface DashboardProps {
  userName: string;
  userEmail: string;
  tier: 'free' | 'pro';
  onNavigateHome: () => void;
  onNavigateToCalculator: () => void;
  onUpgrade: () => void;
  onSignOut: () => void;
}

// Mini Sparkline Component
function MiniSparkline({ data, color = 'text-teal-500' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 24;
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
  ).join(' ');

  return (
    <svg width={width} height={height} className={`${color} opacity-60`}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Dashboard({
  userName,
  userEmail,
  tier,
  onNavigateHome,
  onNavigateToCalculator,
  onUpgrade,
  onSignOut,
}: DashboardProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [history, setHistory] = useState<CalculationHistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'settings'>('overview');
  const [editName, setEditName] = useState(userName);
  const [editCompany, setEditCompany] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLinkedIn, setEditLinkedIn] = useState('');
  const [editRole, setEditRole] = useState('');
  const [memberSince, setMemberSince] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<CalculationHistoryItem | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // New state for world-class features
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPhase, setFilterPhase] = useState('all');
  const [filterModality, setFilterModality] = useState('all');
  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [avatarColor, setAvatarColor] = useState('teal');

  // Password update state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    setMounted(true);
    setHistory(getHistory());
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
      } catch {
        // ignore
      }
    }
    // Load avatar color preference
    const savedAvatarColor = localStorage.getItem('avatar_color');
    if (savedAvatarColor && AVATAR_COLORS.some(c => c.id === savedAvatarColor)) {
      setAvatarColor(savedAvatarColor);
    }
  }, []);

  // Filtered history for search/filter
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim() && filterPhase === 'all' && filterModality === 'all') {
      return history;
    }

    return history.filter(item => {
      const query = searchQuery.toLowerCase().trim();

      // If no search query, match all for search
      if (!query) {
        const matchesPhase = filterPhase === 'all' || item.labels.phase === filterPhase;
        const matchesModality = filterModality === 'all' || item.labels.modality === filterModality;
        return matchesPhase && matchesModality;
      }

      // Search across all relevant fields
      const searchableText = [
        item.labels.phase,
        item.labels.modality,
        item.labels.indication,
        item.inputs.territory,
        item.inputs.phase,
        item.inputs.modality,
        item.inputs.indication,
        item.timestamp,
        formatDate(item.timestamp)
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = searchableText.includes(query);
      const matchesPhase = filterPhase === 'all' || item.labels.phase === filterPhase;
      const matchesModality = filterModality === 'all' || item.labels.modality === filterModality;

      return matchesSearch && matchesPhase && matchesModality;
    });
  }, [history, searchQuery, filterPhase, filterModality]);

  // Get unique phases and modalities for filters
  const uniquePhases = useMemo(() => [...new Set(history.map(h => h.labels.phase))], [history]);
  const uniqueModalities = useMemo(() => [...new Set(history.map(h => h.labels.modality))], [history]);

  // Group history by date
  const groupedHistory = useMemo(() => {
    const groups: { label: string; items: CalculationHistoryItem[] }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const todayItems: CalculationHistoryItem[] = [];
    const yesterdayItems: CalculationHistoryItem[] = [];
    const thisWeekItems: CalculationHistoryItem[] = [];
    const thisMonthItems: CalculationHistoryItem[] = [];
    const olderItems: CalculationHistoryItem[] = [];

    filteredHistory.forEach(item => {
      const itemDate = new Date(item.timestamp);
      itemDate.setHours(0, 0, 0, 0);

      if (itemDate >= today) todayItems.push(item);
      else if (itemDate >= yesterday) yesterdayItems.push(item);
      else if (itemDate >= weekAgo) thisWeekItems.push(item);
      else if (itemDate >= monthAgo) thisMonthItems.push(item);
      else olderItems.push(item);
    });

    if (todayItems.length) groups.push({ label: 'Today', items: todayItems });
    if (yesterdayItems.length) groups.push({ label: 'Yesterday', items: yesterdayItems });
    if (thisWeekItems.length) groups.push({ label: 'This Week', items: thisWeekItems });
    if (thisMonthItems.length) groups.push({ label: 'This Month', items: thisMonthItems });
    if (olderItems.length) groups.push({ label: 'Older', items: olderItems });

    return groups;
  }, [filteredHistory]);

  const handleDeleteHistory = (id: string) => {
    deleteHistoryItem(id);
    setHistory(getHistory());
  };

  const handleHistoryClick = (item: CalculationHistoryItem) => {
    setSelectedHistoryItem(item);
    setShowHistoryModal(true);
  };

  const handleReuseInputs = (item: CalculationHistoryItem) => {
    sessionStorage.setItem('prefill_calculation', JSON.stringify(item.inputs));
    setShowHistoryModal(false);
    onNavigateToCalculator();
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!editName.trim()) errors.name = 'Name is required';
    if (editPhone && !/^[\d\s\-\+\(\)]*$/.test(editPhone)) errors.phone = 'Invalid phone format';
    if (editLinkedIn && editLinkedIn.trim() && !editLinkedIn.includes('linkedin.com')) {
      errors.linkedIn = 'Please enter a valid LinkedIn URL';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveSettings = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    setSaveMessage('');
    try {
      const userData = localStorage.getItem('user_data');
      if (userData) {
        const parsed = JSON.parse(userData);
        parsed.name = editName;
        parsed.company = editCompany;
        parsed.title = editTitle;
        parsed.phone = editPhone;
        parsed.linkedIn = editLinkedIn;
        parsed.role = editRole;
        localStorage.setItem('user_data', JSON.stringify(parsed));
      }
      await new Promise(resolve => setTimeout(resolve, 300));
      setSaveMessage('Settings saved successfully');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch {
      setSaveMessage('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setExportProgress(0);

    const progressInterval = setInterval(() => {
      setExportProgress(prev => Math.min(prev + 10, 90));
    }, 100);

    try {
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

      await new Promise(resolve => setTimeout(resolve, 500));

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deal-calculator-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setExportProgress(100);
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally {
      clearInterval(progressInterval);
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleDeleteAccount = () => {
    clearHistory();
    localStorage.removeItem('user_data');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('user_tier');
    onSignOut();
  };

  const recentCalculations = history.slice(0, 5);

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}B`;
    return `$${value.toFixed(2)}M`;
  };

  // Get current avatar color
  const currentAvatarColor = AVATAR_COLORS.find(c => c.id === avatarColor) || AVATAR_COLORS[0];

  const handleAvatarColorChange = (colorId: string) => {
    setAvatarColor(colorId);
    localStorage.setItem('avatar_color', colorId);
  };

  const handlePasswordUpdate = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (!newPassword || !confirmNewPassword) {
      setPasswordError('Please fill in all password fields');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (!isSupabaseConfigured()) {
      setPasswordError('Password update requires authentication to be configured');
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setPasswordError('Authentication service unavailable');
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message);
        return;
      }

      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordSuccess(''), 5000);
    } catch (err) {
      console.error('Password update error:', err);
      setPasswordError('An unexpected error occurred. Please try again.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Compute deal insights
  const totalValueAnalyzed = history.reduce((sum, h) => sum + h.results.totalValueMedian, 0);

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

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Get personalized welcome subtext
  const getWelcomeSubtext = () => {
    if (history.length === 0) return 'Ready to analyze your first deal? Let\'s get started.';
    if (history.length < 5) return `You've analyzed ${history.length} deal${history.length > 1 ? 's' : ''}. Keep building your portfolio!`;
    return `${history.length} analyses completed. Your insights dashboard is ready.`;
  };

  // Get sparkline data from history
  const getSparklineData = () => {
    return history.slice(0, 10).reverse().map(h => h.results.totalValueMedian);
  };

  // Get personalized insights
  const getPersonalizedInsights = () => {
    const insights: { title: string; description: string; iconBg: string; iconColor: string }[] = [];

    if (topPhase !== '-') {
      insights.push({
        title: `Focus on ${topPhase}`,
        description: `Most of your analyses are in ${topPhase}. Consider exploring adjacent phases for comparison.`,
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600'
      });
    }

    const avgValue = history.length > 0 ? totalValueAnalyzed / history.length : 0;
    if (history.length > 0) {
      insights.push({
        title: avgValue > 500 ? 'High-Value Focus' : 'Diverse Portfolio',
        description: avgValue > 500
          ? `Your average deal value is ${formatCurrency(avgValue)} - premium territory.`
          : `Analyzing deals across various value ranges builds comprehensive expertise.`,
        iconBg: 'bg-teal-100',
        iconColor: 'text-teal-600'
      });
    }

    if (tier === 'free' && history.length >= 1) {
      insights.push({
        title: 'Unlock Full Potential',
        description: 'Pro users get unlimited analyses, PDF exports, and detailed breakdowns.',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600'
      });
    }

    return insights.slice(0, 3);
  };

  // Determine background based on resolved theme - this bypasses CSS dark: variants
  const bgStyle = resolvedTheme === 'dark'
    ? { background: 'linear-gradient(to bottom right, #0f172a, #0f172a, #1e293b)' }
    : { background: 'linear-gradient(to bottom right, #f8fafc, #ffffff, rgba(240, 253, 250, 0.2))' };

  // Dynamic styles that override dark: variants based on resolved theme
  const dynamicStyles = resolvedTheme === 'light' ? `
    .dark\\:bg-slate-800 { background-color: #ffffff !important; }
    .dark\\:bg-slate-900 { background-color: #ffffff !important; }
    .dark\\:bg-slate-700 { background-color: #f1f5f9 !important; }
    .dark\\:bg-slate-900\\/95 { background-color: rgba(255,255,255,0.95) !important; }
    .dark\\:border-slate-700 { border-color: #e2e8f0 !important; }
    .dark\\:border-slate-600 { border-color: #cbd5e1 !important; }
    .dark\\:text-slate-200 { color: #1e293b !important; }
    .dark\\:text-slate-300 { color: #334155 !important; }
    .dark\\:text-slate-400 { color: #64748b !important; }
    .dark\\:text-white { color: #0f172a !important; }
    .dark\\:hover\\:bg-slate-800:hover { background-color: #f1f5f9 !important; }
    .dark\\:hover\\:bg-slate-700:hover { background-color: #e2e8f0 !important; }
    .dark\\:active\\:bg-slate-700:active { background-color: #cbd5e1 !important; }
  ` : '';

  return (
    <>
      {/* Dynamic theme override styles */}
      {dynamicStyles && <style dangerouslySetInnerHTML={{ __html: dynamicStyles }} />}

      {/* DEBUG: Theme indicator - remove after debugging */}
      <div className="fixed bottom-20 left-4 z-[99999] px-3 py-2 rounded-lg text-xs font-mono shadow-lg"
           style={{
             backgroundColor: '#ffffff',
             color: '#000000',
             border: '3px solid #f97316'
           }}>
        <div><strong>theme:</strong> {theme}</div>
        <div><strong>resolved:</strong> {resolvedTheme}</div>
        <div><strong>localStorage:</strong> {typeof window !== 'undefined' ? localStorage.getItem('theme') || 'null' : 'ssr'}</div>
        <button
          onClick={() => { setTheme('light'); alert('Set to light! theme=' + theme); }}
          style={{ marginTop: '4px', padding: '4px 8px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '4px' }}
        >
          Force Light
        </button>
      </div>

      <div className="min-h-screen" style={bgStyle}>
      {/* Header */}
      <header
        className="backdrop-blur-lg border-b sticky top-0 z-40 safe-top"
        style={{
          backgroundColor: resolvedTheme === 'dark' ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: resolvedTheme === 'dark' ? 'rgba(51, 65, 85, 0.8)' : 'rgba(226, 232, 240, 0.8)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button onClick={onNavigateHome} className="flex items-center touch-feedback">
              <Image
                src="/logo.png"
                alt="Ambrosia Ventures"
                width={320}
                height={90}
                className="h-14 sm:h-16 lg:h-20 w-auto object-contain"
                priority
              />
            </button>

            <nav className="hidden md:flex items-center gap-8">
              <button onClick={onNavigateHome} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors">Home</button>
              <button onClick={onNavigateToCalculator} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors">Calculator</button>
              <button onClick={() => { onNavigateHome(); setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors">Pricing</button>
              <button onClick={() => { onNavigateHome(); setTimeout(() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors">About</button>
            </nav>

            <div className="flex items-center gap-2 sm:gap-4">
              {tier === 'free' ? (
                <span className="hidden sm:inline-flex px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">Free Plan</span>
              ) : (
                <span className="hidden sm:inline-flex px-3 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-semibold rounded-full shadow-sm">Pro Plan</span>
              )}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br ${currentAvatarColor.from} ${currentAvatarColor.to} flex items-center justify-center text-white font-semibold text-sm shadow-md ${currentAvatarColor.shadow}`}>
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight">{userName}</p>
                  <p className="text-xs text-slate-500">{userEmail}</p>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-3 -mr-2 text-slate-600 hover:text-slate-900 touch-feedback rounded-xl" aria-label="Toggle menu">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 top-16 z-[9999] overflow-y-auto animate-fade-in"
          style={{ backgroundColor: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff' }}
        >
          <nav className="flex flex-col p-4 gap-1">
            <button onClick={() => { setMobileMenuOpen(false); onNavigateHome(); }} className="flex items-center gap-4 px-4 py-4 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 rounded-2xl font-medium transition-colors touch-feedback">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              </div>
              <span className="text-base">Home</span>
            </button>
            <button onClick={() => { setMobileMenuOpen(false); onNavigateToCalculator(); }} className="flex items-center gap-4 px-4 py-4 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 rounded-2xl font-medium transition-colors touch-feedback">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <span className="text-base">Calculator</span>
            </button>
            <div className="my-4 border-t border-slate-200 dark:border-slate-700" />
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700 rounded-2xl mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${currentAvatarColor.from} ${currentAvatarColor.to} flex items-center justify-center text-white font-bold text-lg shadow-md`}>{userName.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{userName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{userEmail}</p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${tier === 'pro' ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{tier === 'pro' ? 'Pro' : 'Free'}</span>
              </div>
            </div>
            <button onClick={() => { setMobileMenuOpen(false); onSignOut(); }} className="flex items-center gap-4 px-4 py-4 text-red-600 hover:bg-red-50 active:bg-red-100 rounded-2xl font-medium transition-colors touch-feedback">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              </div>
              <span className="text-base">Sign Out</span>
            </button>
          </nav>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Welcome Banner - Enhanced */}
        <div className={`mb-6 sm:mb-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 text-white relative overflow-hidden ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`, backgroundSize: '24px 24px' }} />
          </div>
          <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-teal-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                <span className="text-teal-400 text-sm font-medium">{getGreeting()}</span>
                {tier === 'pro' && (
                  <span className="px-2 py-0.5 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold rounded-full">Pro Member</span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1.5 sm:mb-2 truncate">Welcome back, {userName.split(' ')[0]}!</h1>
              <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto sm:mx-0 line-clamp-2">{getWelcomeSubtext()}</p>
            </div>
            <button onClick={onNavigateToCalculator} className="hidden sm:inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm sm:text-base font-semibold rounded-xl shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 transition-all hover:-translate-y-0.5 touch-feedback">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span>New Calculation</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className={`mb-6 sm:mb-8 -mx-3 sm:mx-0 px-3 sm:px-0 ${mounted ? 'animate-fade-in stagger-1' : 'opacity-0'}`}>
          <div
            className="flex gap-1.5 sm:gap-1 p-1.5 sm:p-1 rounded-2xl sm:rounded-xl w-full sm:w-fit overflow-x-auto hide-scrollbar scroll-snap-x"
            style={{ backgroundColor: resolvedTheme === 'dark' ? '#1e293b' : '#f1f5f9' }}
          >
            {[
              { id: 'overview', label: 'Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
              { id: 'history', label: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center justify-center gap-2 px-4 sm:px-4 py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none min-w-[80px] sm:min-w-0 scroll-snap-center touch-feedback ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md sm:shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white active:bg-white/50 dark:active:bg-slate-600/50'}`}
              >
                <svg className={`w-4 h-4 flex-shrink-0 transition-colors ${activeTab === tab.id ? 'text-teal-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Deal Insights */}
            <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm ${mounted ? 'animate-fade-in stagger-2' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Your Deal Insights</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Analytics from your deal calculations</p>
                </div>
              </div>

              {history.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                  {/* Total Analyses */}
                  <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                    <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 truncate">Total Analyses</p>
                    <p className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{history.length}</p>
                  </div>

                  {/* Total Value */}
                  <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                    <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 truncate">Total Value</p>
                    <p className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">{formatCurrency(totalValueAnalyzed)}</p>
                  </div>

                  {/* Top Phase */}
                  <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                    <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 truncate">Top Phase</p>
                    <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{topPhase}</p>
                  </div>

                  {/* Top Modality */}
                  <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                    <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 truncate">Top Modality</p>
                    <p className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{topModality}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-400/20 to-cyan-400/20 rounded-full animate-pulse" />
                    <div className="absolute inset-2 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Start Your Deal Journey</h4>
                  <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">Run your first analysis to unlock powerful insights, track your portfolio, and benchmark against industry standards.</p>
                  <button onClick={onNavigateToCalculator} className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-500 hover:to-cyan-400 transition-all shadow-lg shadow-teal-500/20 hover:-translate-y-0.5">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Run Your First Analysis
                  </button>
                  <div className="mt-8 flex items-center justify-center gap-6 text-sm text-slate-400">
                    <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Secure</span>
                    <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Instant Results</span>
                  </div>
                </div>
              )}
            </div>

            {/* Insights Section */}
            {history.length > 0 && getPersonalizedInsights().length > 0 && (
              <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm ${mounted ? 'animate-fade-in stagger-3' : 'opacity-0'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Personalized Insights</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Based on your analysis history</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {getPersonalizedInsights().map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors overflow-hidden">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${insight.iconBg} dark:opacity-90`}>
                        <svg className={`w-4 h-4 ${insight.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{insight.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{insight.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Subscription Card - Enhanced */}
              <div className={`lg:col-span-2 ${mounted ? 'animate-fade-in stagger-4' : 'opacity-0'}`}>
                <div className={`bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 border shadow-sm overflow-hidden relative ${tier === 'pro' ? 'border-teal-200 dark:border-teal-700' : 'border-slate-200 dark:border-slate-700'}`}>
                  {tier === 'pro' && (
                    <>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-teal-400/10 to-cyan-400/10 rounded-full blur-2xl" />
                      <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-gradient-to-br from-cyan-400/10 to-teal-400/10 rounded-full blur-xl" />
                    </>
                  )}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900 dark:text-white">Subscription</h3>
                      {tier === 'free' && <button onClick={onUpgrade} className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors">Upgrade to Pro</button>}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tier === 'pro' ? 'bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25' : 'bg-slate-100'}`}>
                        <svg className={`w-6 h-6 ${tier === 'pro' ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{tier === 'pro' ? 'Pro Plan' : 'Free Plan'}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{tier === 'pro' ? 'Full access to all features' : 'Limited to 2 calculations per month'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className={`bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-sm ${mounted ? 'animate-fade-in stagger-5' : 'opacity-0'}`}>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">Recent Activity</h3>
                {recentCalculations.length > 0 ? (
                  <div className="space-y-4">
                    {recentCalculations.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={() => handleHistoryClick(item)}
                        onKeyDown={(e) => e.key === 'Enter' && handleHistoryClick(item)}
                        role="button"
                        tabIndex={0}
                        className={`flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-700 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 -mx-2 px-2 py-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 group ${mounted ? `animate-fade-in stagger-${Math.min(idx + 1, 5)}` : 'opacity-0'}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/50 transition-colors">
                          <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.labels.phase} • {item.labels.modality}</p>
                          <p className="text-xs text-slate-500">{formatDate(item.timestamp)}</p>
                        </div>
                        <svg className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">No calculations yet</p>
                    <button onClick={onNavigateToCalculator} className="mt-3 text-sm font-medium text-teal-600 hover:text-teal-700">Start your first calculation</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-slate-900 dark:text-white">Calculation History</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">View and manage your past deal analyses</p>
            </div>

            {/* Search and Filters */}
            {history.length > 0 && (
              <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search calculations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-base"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
                    <select value={filterPhase} onChange={(e) => setFilterPhase(e.target.value)} className="flex-1 min-w-0 px-3 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all">
                      <option value="all">All Phases</option>
                      {uniquePhases.map(phase => <option key={phase} value={phase}>{phase}</option>)}
                    </select>
                    <select value={filterModality} onChange={(e) => setFilterModality(e.target.value)} className="flex-1 min-w-0 px-3 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all">
                      <option value="all">All Modalities</option>
                      {uniqueModalities.map(mod => <option key={mod} value={mod}>{mod}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {history.length > 0 ? (
              filteredHistory.length > 0 ? (
                <div>
                  {groupedHistory.map((group) => (
                    <div key={group.label}>
                      <div className="px-4 sm:px-6 py-2 sm:py-3 bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 sticky top-[64px] z-10">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">{group.label}</h4>
                      </div>
                      {group.items.map((item, idx) => (
                        <div key={item.id} className={`p-4 sm:p-6 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors history-item-clickable group ${mounted ? `animate-fade-in stagger-${Math.min(idx + 1, 5)}` : 'opacity-0'}`}>
                          <div
                            onClick={() => handleHistoryClick(item)}
                            onKeyDown={(e) => e.key === 'Enter' && handleHistoryClick(item)}
                            role="button"
                            tabIndex={0}
                            className="flex items-start justify-between gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded-lg -m-2 p-2"
                          >
                            <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/30 flex items-center justify-center flex-shrink-0 group-hover:from-teal-100 group-hover:to-cyan-100 dark:group-hover:from-teal-900/50 dark:group-hover:to-cyan-900/50 transition-colors">
                                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-slate-900 dark:text-white truncate">{item.labels.phase}</p>
                                  {item.hasPDF && <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-medium rounded-full flex-shrink-0">PDF</span>}
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{item.labels.modality} • {item.labels.indication}</p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-medium rounded whitespace-nowrap">{formatCurrency(item.results.upfrontMedian)} upfront</span>
                                  <span className="px-2 py-0.5 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-medium rounded whitespace-nowrap">{formatCurrency(item.results.totalValueMedian)} total</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right hidden sm:block">
                                <p className="text-xs text-slate-500">{formatDate(item.timestamp)}</p>
                              </div>
                              <svg className="w-5 h-5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteHistory(item.id); }} className="text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 transition-colors">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">No matching calculations</h3>
                  <p className="text-slate-500 mb-4">Try adjusting your search or filters</p>
                  <button onClick={() => { setSearchQuery(''); setFilterPhase('all'); setFilterModality('all'); }} className="text-teal-600 font-medium hover:text-teal-700">Clear all filters</button>
                </div>
              )
            ) : (
              <div className="p-12 text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-400/20 to-cyan-400/20 rounded-full animate-pulse" />
                  <div className="absolute inset-2 bg-gradient-to-br from-slate-50 to-slate-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">No calculations yet</h3>
                <p className="text-slate-500 mb-4">Your calculation history will appear here</p>
                <button onClick={onNavigateToCalculator} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  New Calculation
                </button>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-6">
            {/* Profile Header Card - Enhanced */}
            <div className={`bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl overflow-hidden relative ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
              <div className="absolute inset-0">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`, backgroundSize: '24px 24px' }} />
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl" />
              </div>

              <div className="relative p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative">
                    <div className={`w-28 h-28 rounded-2xl bg-gradient-to-br ${currentAvatarColor.from} ${currentAvatarColor.to} flex items-center justify-center text-5xl font-bold text-white shadow-xl ${currentAvatarColor.shadow} ring-4 ring-white/20`}>
                      {editName.charAt(0).toUpperCase()}
                    </div>
                    {tier === 'pro' && (
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="text-center sm:text-left flex-1 min-w-0 text-white overflow-hidden">
                    <h2 className="text-2xl sm:text-3xl font-bold truncate">{editName}</h2>
                    <p className="text-slate-400 mt-1 truncate">{userEmail}</p>
                    {editTitle && editCompany && <p className="text-teal-400 mt-1 font-medium truncate">{editTitle} at {editCompany}</p>}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 mt-4">
                      <span className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap ${tier === 'pro' ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/30' : 'bg-slate-700 text-slate-300 border border-slate-600'}`}>
                        {tier === 'pro' ? 'Pro Member' : 'Free Plan'}
                      </span>
                      {memberSince && (
                        <span className="text-slate-500 text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span className="hidden xs:inline">Member since</span><span className="xs:hidden">Since</span> {new Date(memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm ${mounted ? 'animate-fade-in stagger-1' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Personal Information</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value); setFormErrors(prev => ({ ...prev, name: '' })); }}
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all ${formErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  />
                  {formErrors.name && <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{formErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email <span className="text-slate-400 font-normal">(read only)</span></label>
                  <input type="email" value={userEmail} disabled className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => { setEditPhone(e.target.value); setFormErrors(prev => ({ ...prev, phone: '' })); }}
                    placeholder="+1 (555) 000-0000"
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all ${formErrors.phone ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  />
                  {formErrors.phone && <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{formErrors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">LinkedIn Profile</label>
                  <input
                    type="url"
                    value={editLinkedIn}
                    onChange={(e) => { setEditLinkedIn(e.target.value); setFormErrors(prev => ({ ...prev, linkedIn: '' })); }}
                    placeholder="linkedin.com/in/yourprofile"
                    className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all ${formErrors.linkedIn ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  />
                  {formErrors.linkedIn && <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{formErrors.linkedIn}</p>}
                </div>
              </div>
            </div>

            {/* Avatar Color */}
            <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm ${mounted ? 'animate-fade-in stagger-2' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Avatar Color</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => handleAvatarColorChange(color.id)}
                    className={`group relative w-12 h-12 rounded-xl bg-gradient-to-br ${color.from} ${color.to} flex items-center justify-center text-white font-bold text-lg shadow-lg ${color.shadow} transition-all hover:scale-110 ${avatarColor === color.id ? 'ring-4 ring-offset-2 ' + color.ring : ''}`}
                    title={color.name}
                  >
                    {editName.charAt(0).toUpperCase()}
                    {avatarColor === color.id && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                        <svg className="w-3 h-3 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Choose a color for your avatar across the dashboard</p>
            </div>

            {/* Appearance */}
            <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm ${mounted ? 'animate-fade-in stagger-2' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Appearance</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {/* Light Mode */}
                <button
                  onClick={() => setTheme('light')}
                  className={`relative p-4 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'}`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                      <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className={`text-sm font-medium ${theme === 'light' ? 'text-teal-700 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400'}`}>Light</span>
                  </div>
                  {theme === 'light' && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* Dark Mode */}
                <button
                  onClick={() => setTheme('dark')}
                  className={`relative p-4 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'}`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center shadow-sm">
                      <svg className="w-5 h-5 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                      </svg>
                    </div>
                    <span className={`text-sm font-medium ${theme === 'dark' ? 'text-teal-700 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400'}`}>Dark</span>
                  </div>
                  {theme === 'dark' && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* System Mode */}
                <button
                  onClick={() => setTheme('system')}
                  className={`relative p-4 rounded-xl border-2 transition-all ${theme === 'system' ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'}`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white to-slate-800 border border-slate-300 flex items-center justify-center shadow-sm overflow-hidden">
                      <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.321A1 1 0 0113.5 17H6.5a1 1 0 01-.195-1.19l.804-.32.122-.49H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className={`text-sm font-medium ${theme === 'system' ? 'text-teal-700 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400'}`}>System</span>
                  </div>
                  {theme === 'system' && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              </div>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                {theme === 'system' ? `Currently using ${resolvedTheme} mode based on your system preference` : `Using ${theme} mode`}
              </p>
            </div>

            {/* Security - Password Update */}
            <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm ${mounted ? 'animate-fade-in stagger-2' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Security</h3>
              </div>

              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700 dark:text-red-400">{passwordError}</p>
                </div>
              )}

              {passwordSuccess && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm text-green-700 dark:text-green-400">{passwordSuccess}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                      placeholder="Min. 8 characters"
                      className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors touch-feedback"
                    >
                      {showNewPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => { setConfirmNewPassword(e.target.value); setPasswordError(''); }}
                    placeholder="Re-enter new password"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>

                <button
                  onClick={handlePasswordUpdate}
                  disabled={isUpdatingPassword || !newPassword || !confirmNewPassword}
                  className="w-full mt-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-feedback"
                >
                  {isUpdatingPassword ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>

              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Password must be at least 8 characters. We recommend using a unique password you don&apos;t use elsewhere.
              </p>
            </div>

            {/* Professional Details */}
            <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm ${mounted ? 'animate-fade-in stagger-3' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Professional Details</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Job Title</label>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="e.g., VP Business Development" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Company</label>
                  <input type="text" value={editCompany} onChange={(e) => setEditCompany(e.target.value)} placeholder="e.g., Biotech Inc." className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Your Role in Deal Process</label>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all">
                    <option value="">Select your role...</option>
                    <option value="bd_executive">Business Development Executive</option>
                    <option value="corporate_dev">Corporate Development</option>
                    <option value="founder_ceo">Founder / CEO</option>
                    <option value="cfo_finance">CFO / Finance</option>
                    <option value="investor_vc">Investor / VC</option>
                    <option value="consultant_advisor">Consultant / Advisor</option>
                    <option value="legal">Legal / Contracts</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <button onClick={handleSaveSettings} disabled={isSaving} className="w-full mt-6 px-4 py-3.5 bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-teal-500/20 hover:shadow-xl hover:from-teal-500 hover:to-cyan-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isSaving ? (
                  <><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><span>Saving...</span></>
                ) : (
                  <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span>Save All Changes</span></>
                )}
              </button>
            </div>

            {/* Subscription with Feature Comparison */}
            <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm ${mounted ? 'animate-fade-in stagger-3' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Subscription</h3>
              </div>

              <div className={`p-5 rounded-xl mb-6 ${tier === 'pro' ? 'bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/30 border border-teal-200 dark:border-teal-700' : 'bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${tier === 'pro' ? 'bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25' : 'bg-slate-200'}`}>
                      <svg className={`w-7 h-7 ${tier === 'pro' ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{tier === 'pro' ? 'Pro Plan' : 'Free Plan'}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{tier === 'pro' ? '$99/month • Billed monthly' : 'Free forever'}</p>
                    </div>
                  </div>
                  {tier === 'free' && <button onClick={onUpgrade} className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-500 hover:to-cyan-400 transition-all shadow-lg shadow-teal-500/20">Upgrade Now</button>}
                </div>
              </div>

              {/* Feature Comparison */}
              <div className="border border-slate-200 dark:border-slate-600 rounded-xl overflow-hidden">
                <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-700 px-4 py-3 border-b border-slate-200 dark:border-slate-600">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Feature</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center">Free</span>
                  <span className="text-sm font-semibold text-teal-700 dark:text-teal-400 text-center">Pro</span>
                </div>
                {[
                  { feature: 'Monthly calculations', free: '2', pro: 'Unlimited' },
                  { feature: 'PDF reports', free: false, pro: true },
                  { feature: 'Detailed breakdowns', free: false, pro: true },
                  { feature: 'History retention', free: '30 days', pro: 'Forever' },
                  { feature: 'Priority support', free: false, pro: true },
                ].map((row, idx) => (
                  <div key={idx} className="grid grid-cols-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0 bg-white dark:bg-slate-800">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{row.feature}</span>
                    <span className="text-sm text-center">
                      {typeof row.free === 'boolean'
                        ? row.free
                          ? <svg className="w-5 h-5 text-teal-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          : <svg className="w-5 h-5 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        : <span className="text-slate-500">{row.free}</span>
                      }
                    </span>
                    <span className="text-sm text-center">
                      {typeof row.pro === 'boolean'
                        ? row.pro
                          ? <svg className="w-5 h-5 text-teal-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          : <svg className="w-5 h-5 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        : <span className="font-medium text-teal-600">{row.pro}</span>
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Data & Privacy */}
            <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm ${mounted ? 'animate-fade-in stagger-4' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Data & Privacy</h3>
              </div>
              <button onClick={handleExportData} disabled={isExporting} className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl transition-colors group disabled:opacity-70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/60 transition-colors relative overflow-hidden">
                    {isExporting ? (
                      <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-slate-900 dark:text-white">{isExporting ? 'Exporting...' : 'Export All My Data'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{isExporting ? `${exportProgress}% complete` : 'Download your profile and calculation history'}</p>
                  </div>
                </div>
                {!isExporting && <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
              </button>
              {isExporting && (
                <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-300" style={{ width: `${exportProgress}%` }} />
                </div>
              )}
            </div>

            {/* Account Actions */}
            <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-red-200 dark:border-red-900/50 shadow-sm ${mounted ? 'animate-fade-in stagger-5' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="font-semibold text-red-600 dark:text-red-400">Account Actions</h3>
              </div>
              <div className="space-y-3">
                <button onClick={onSignOut} className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center group-hover:bg-slate-300 dark:group-hover:bg-slate-500 transition-colors">
                      <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-slate-900 dark:text-white">Sign Out</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Sign out of your account on this device</p>
                    </div>
                  </div>
                </button>

                {/* Multi-step delete flow */}
                {deleteStep === 0 && (
                  <button onClick={() => setDeleteStep(1)} className="w-full flex items-center justify-between px-4 py-3.5 bg-red-50 hover:bg-red-100 rounded-xl transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-200 flex items-center justify-center group-hover:bg-red-300 transition-colors">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-red-700">Delete Account</p>
                        <p className="text-sm text-red-500">Permanently delete your account and all data</p>
                      </div>
                    </div>
                  </button>
                )}

                {deleteStep === 1 && (
                  <div className="p-5 bg-red-50 rounded-xl border border-red-200 space-y-4 animate-fade-in">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </div>
                      <div>
                        <p className="font-semibold text-red-700">This action is irreversible</p>
                        <p className="text-sm text-red-600 mt-1">All your data will be permanently deleted:</p>
                        <ul className="mt-2 space-y-1 text-sm text-red-600">
                          <li className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>{history.length} calculation{history.length !== 1 ? 's' : ''} and results</li>
                          <li className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>Your profile and preferences</li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setDeleteStep(0)} className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50">Cancel</button>
                      <button onClick={() => setDeleteStep(2)} className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700">Continue</button>
                    </div>
                  </div>
                )}

                {deleteStep === 2 && (
                  <div className="p-5 bg-red-50 rounded-xl border border-red-200 space-y-4 animate-fade-in">
                    <p className="text-sm text-red-700">To confirm deletion, type <strong>delete my account</strong> below:</p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Type here to confirm..."
                      className="w-full px-4 py-3 bg-white border border-red-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                    <div className="flex gap-3">
                      <button onClick={() => { setDeleteStep(0); setDeleteConfirmText(''); }} className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50">Cancel</button>
                      <button onClick={handleDeleteAccount} disabled={deleteConfirmText.toLowerCase() !== 'delete my account'} className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">Delete Forever</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {saveMessage && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 z-50 animate-fade-in ${saveMessage.includes('success') ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {saveMessage.includes('success') ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          )}
          {saveMessage}
        </div>
      )}

      {/* History Detail Modal */}
      <HistoryDetailModal
        isOpen={showHistoryModal}
        onClose={() => { setShowHistoryModal(false); setTimeout(() => setSelectedHistoryItem(null), 350); }}
        item={selectedHistoryItem}
        tier={tier}
        onReuse={handleReuseInputs}
        onUpgrade={onUpgrade}
      />

      {/* Floating Action Button - Mobile Only */}
      <button
        onClick={onNavigateToCalculator}
        className="sm:hidden fixed bottom-6 right-4 w-14 h-14 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-2xl shadow-lg shadow-teal-500/40 flex items-center justify-center z-50 fab-pulse touch-feedback safe-bottom"
        aria-label="New Calculation"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
      </button>
    </div>
    </>
  );
}
