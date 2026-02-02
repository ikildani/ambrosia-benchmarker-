'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { getHistory, deleteHistoryItem, clearHistory, formatDate, type CalculationHistoryItem } from '@/lib/history';
import HistoryDetailModal from './HistoryDetailModal';

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
  }, []);

  // Filtered history for search/filter
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchesSearch = searchQuery === '' ||
        item.labels.phase.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.labels.modality.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.labels.indication.toLowerCase().includes(searchQuery.toLowerCase());

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-lg border-b border-slate-200/80 sticky top-0 z-40 safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button onClick={onNavigateHome} className="flex items-center touch-feedback">
              <Image
                src="/logo.png"
                alt="Ambrosia Ventures"
                width={240}
                height={64}
                className="h-12 sm:h-14 w-auto object-contain"
                priority
              />
            </button>

            <nav className="hidden md:flex items-center gap-8">
              <button onClick={onNavigateHome} className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Home</button>
              <button onClick={onNavigateToCalculator} className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Calculator</button>
              <button onClick={() => { onNavigateHome(); setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Pricing</button>
              <button onClick={() => { onNavigateHome(); setTimeout(() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="text-slate-600 hover:text-slate-900 font-medium transition-colors">About</button>
            </nav>

            <div className="flex items-center gap-2 sm:gap-4">
              {tier === 'free' ? (
                <span className="hidden sm:inline-flex px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">Free Plan</span>
              ) : (
                <span className="hidden sm:inline-flex px-3 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-semibold rounded-full shadow-sm">Pro Plan</span>
              )}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm shadow-md shadow-teal-500/20">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-slate-900 leading-tight">{userName}</p>
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
        <div className="fixed inset-0 top-16 bg-white z-[9999] overflow-y-auto animate-fade-in">
          <nav className="flex flex-col p-4 gap-1">
            <button onClick={() => { setMobileMenuOpen(false); onNavigateHome(); }} className="flex items-center gap-4 px-4 py-4 text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-2xl font-medium transition-colors touch-feedback">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              </div>
              <span className="text-base">Home</span>
            </button>
            <button onClick={() => { setMobileMenuOpen(false); onNavigateToCalculator(); }} className="flex items-center gap-4 px-4 py-4 text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-2xl font-medium transition-colors touch-feedback">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <span className="text-base">Calculator</span>
            </button>
            <div className="my-4 border-t border-slate-200" />
            <div className="px-4 py-3 bg-slate-50 rounded-2xl mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-md">{userName.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{userName}</p>
                  <p className="text-sm text-slate-500 truncate">{userEmail}</p>
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
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1.5 sm:mb-2">Welcome back, {userName.split(' ')[0]}!</h1>
              <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto sm:mx-0">{getWelcomeSubtext()}</p>
            </div>
            <button onClick={onNavigateToCalculator} className="hidden sm:inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm sm:text-base font-semibold rounded-xl shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30 transition-all hover:-translate-y-0.5 touch-feedback">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span>New Calculation</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className={`mb-6 sm:mb-8 -mx-3 sm:mx-0 px-3 sm:px-0 ${mounted ? 'animate-fade-in stagger-1' : 'opacity-0'}`}>
          <div className="flex gap-1.5 sm:gap-1 bg-slate-100 p-1.5 sm:p-1 rounded-2xl sm:rounded-xl w-full sm:w-fit overflow-x-auto hide-scrollbar scroll-snap-x">
            {[
              { id: 'overview', label: 'Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
              { id: 'history', label: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center justify-center gap-2 px-4 sm:px-4 py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none min-w-[80px] sm:min-w-0 scroll-snap-center touch-feedback ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-md sm:shadow-sm' : 'text-slate-500 hover:text-slate-900 active:bg-white/50'}`}
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
            <div className={`bg-white rounded-2xl p-6 border border-slate-200 shadow-sm ${mounted ? 'animate-fade-in stagger-2' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Your Deal Insights</h3>
                  <p className="text-sm text-slate-500">Analytics from your deal calculations</p>
                </div>
              </div>

              {history.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {/* Total Analyses */}
                  <div className="metric-card p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-lg sm:rounded-xl border border-teal-200/50 relative overflow-hidden group">
                    <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-medium text-teal-700">Total Analyses</span>
                      </div>
                    </div>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-teal-700">{history.length}</p>
                    {history.length > 1 && <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity"><MiniSparkline data={getSparklineData()} /></div>}
                  </div>

                  {/* Total Value */}
                  <div className="metric-card p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-lg sm:rounded-xl border border-cyan-200/50 relative overflow-hidden group">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-medium text-cyan-700 truncate">Total Value</span>
                    </div>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-cyan-700">{formatCurrency(totalValueAnalyzed)}</p>
                  </div>

                  {/* Top Phase */}
                  <div className="metric-card p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg sm:rounded-xl border border-blue-200/50">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      <span className="text-xs font-medium text-blue-700 truncate">Top Phase</span>
                    </div>
                    <p className="text-sm sm:text-lg lg:text-xl font-bold text-blue-700 truncate">{topPhase}</p>
                  </div>

                  {/* Top Modality */}
                  <div className="metric-card p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-lg sm:rounded-xl border border-indigo-200/50">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      <span className="text-xs font-medium text-indigo-700 truncate">Top Modality</span>
                    </div>
                    <p className="text-sm sm:text-lg lg:text-xl font-bold text-indigo-700 truncate">{topModality}</p>
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
                  <h4 className="text-xl font-bold text-slate-900 mb-2">Start Your Deal Journey</h4>
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
              <div className={`bg-white rounded-2xl p-6 border border-slate-200 shadow-sm ${mounted ? 'animate-fade-in stagger-3' : 'opacity-0'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Personalized Insights</h3>
                    <p className="text-sm text-slate-500">Based on your analysis history</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {getPersonalizedInsights().map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${insight.iconBg}`}>
                        <svg className={`w-4 h-4 ${insight.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{insight.title}</p>
                        <p className="text-xs text-slate-500">{insight.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Subscription Card - Enhanced */}
              <div className={`lg:col-span-2 ${mounted ? 'animate-fade-in stagger-4' : 'opacity-0'}`}>
                <div className={`bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border shadow-sm overflow-hidden relative ${tier === 'pro' ? 'border-teal-200' : 'border-slate-200'}`}>
                  {tier === 'pro' && (
                    <>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-teal-400/10 to-cyan-400/10 rounded-full blur-2xl" />
                      <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-gradient-to-br from-cyan-400/10 to-teal-400/10 rounded-full blur-xl" />
                    </>
                  )}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900">Subscription</h3>
                      {tier === 'free' && <button onClick={onUpgrade} className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors">Upgrade to Pro</button>}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tier === 'pro' ? 'bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25' : 'bg-slate-100'}`}>
                        <svg className={`w-6 h-6 ${tier === 'pro' ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{tier === 'pro' ? 'Pro Plan' : 'Free Plan'}</p>
                        <p className="text-sm text-slate-500">{tier === 'pro' ? 'Full access to all features' : 'Limited to 2 calculations per month'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className={`bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm ${mounted ? 'animate-fade-in stagger-5' : 'opacity-0'}`}>
                <h3 className="font-semibold text-slate-900 mb-3 sm:mb-4 text-sm sm:text-base">Recent Activity</h3>
                {recentCalculations.length > 0 ? (
                  <div className="space-y-4">
                    {recentCalculations.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={() => handleHistoryClick(item)}
                        onKeyDown={(e) => e.key === 'Enter' && handleHistoryClick(item)}
                        role="button"
                        tabIndex={0}
                        className={`flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 group ${mounted ? `animate-fade-in stagger-${Math.min(idx + 1, 5)}` : 'opacity-0'}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                          <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{item.labels.phase} • {item.labels.modality}</p>
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
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500">No calculations yet</p>
                    <button onClick={onNavigateToCalculator} className="mt-3 text-sm font-medium text-teal-600 hover:text-teal-700">Start your first calculation</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${mounted ? 'animate-fade-in' : 'opacity-0'}`}>
            <div className="p-6 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Calculation History</h3>
              <p className="text-sm text-slate-500 mt-1">View and manage your past deal analyses</p>
            </div>

            {/* Search and Filters */}
            {history.length > 0 && (
              <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search calculations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select value={filterPhase} onChange={(e) => setFilterPhase(e.target.value)} className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all min-w-[120px]">
                      <option value="all">All Phases</option>
                      {uniquePhases.map(phase => <option key={phase} value={phase}>{phase}</option>)}
                    </select>
                    <select value={filterModality} onChange={(e) => setFilterModality(e.target.value)} className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all min-w-[130px]">
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
                      <div className="px-6 py-3 bg-slate-100 border-b border-slate-200 sticky top-16 z-10">
                        <h4 className="text-sm font-semibold text-slate-600">{group.label}</h4>
                      </div>
                      {group.items.map((item, idx) => (
                        <div key={item.id} className={`p-6 hover:bg-slate-50 transition-colors history-item-clickable group ${mounted ? `animate-fade-in stagger-${Math.min(idx + 1, 5)}` : 'opacity-0'}`}>
                          <div
                            onClick={() => handleHistoryClick(item)}
                            onKeyDown={(e) => e.key === 'Enter' && handleHistoryClick(item)}
                            role="button"
                            tabIndex={0}
                            className="flex items-start justify-between gap-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded-lg -m-2 p-2"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center flex-shrink-0 group-hover:from-teal-100 group-hover:to-cyan-100 transition-colors">
                                <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-slate-900">{item.labels.phase}</p>
                                  {item.hasPDF && <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs font-medium rounded-full">PDF</span>}
                                </div>
                                <p className="text-sm text-slate-600">{item.labels.modality} • {item.labels.indication}</p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs font-medium rounded">{formatCurrency(item.results.upfrontMedian)} upfront</span>
                                  <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 text-xs font-medium rounded">{formatCurrency(item.results.totalValueMedian)} total</span>
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
                          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteHistory(item.id); }} className="text-sm text-slate-500 hover:text-red-600 transition-colors">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">No matching calculations</h3>
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
                <h3 className="font-semibold text-slate-900 mb-2">No calculations yet</h3>
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
                    <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-5xl font-bold text-white shadow-xl shadow-teal-500/40 ring-4 ring-white/20">
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

                  <div className="text-center sm:text-left flex-1 text-white">
                    <h2 className="text-2xl sm:text-3xl font-bold">{editName}</h2>
                    <p className="text-slate-400 mt-1">{userEmail}</p>
                    {editTitle && editCompany && <p className="text-teal-400 mt-1 font-medium">{editTitle} at {editCompany}</p>}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-4">
                      <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${tier === 'pro' ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/30' : 'bg-slate-700 text-slate-300 border border-slate-600'}`}>
                        {tier === 'pro' ? 'Pro Member' : 'Free Plan'}
                      </span>
                      {memberSince && (
                        <span className="text-slate-500 text-sm flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Member since {new Date(memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className={`bg-white rounded-2xl p-6 border border-slate-200 shadow-sm ${mounted ? 'animate-fade-in stagger-1' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <h3 className="font-semibold text-slate-900">Personal Information</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value); setFormErrors(prev => ({ ...prev, name: '' })); }}
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all ${formErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  />
                  {formErrors.name && <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{formErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email <span className="text-slate-400 font-normal">(read only)</span></label>
                  <input type="email" value={userEmail} disabled className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => { setEditPhone(e.target.value); setFormErrors(prev => ({ ...prev, phone: '' })); }}
                    placeholder="+1 (555) 000-0000"
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all ${formErrors.phone ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  />
                  {formErrors.phone && <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{formErrors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">LinkedIn Profile</label>
                  <input
                    type="url"
                    value={editLinkedIn}
                    onChange={(e) => { setEditLinkedIn(e.target.value); setFormErrors(prev => ({ ...prev, linkedIn: '' })); }}
                    placeholder="linkedin.com/in/yourprofile"
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all ${formErrors.linkedIn ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                  />
                  {formErrors.linkedIn && <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{formErrors.linkedIn}</p>}
                </div>
              </div>
            </div>

            {/* Professional Details */}
            <div className={`bg-white rounded-2xl p-6 border border-slate-200 shadow-sm ${mounted ? 'animate-fade-in stagger-2' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="font-semibold text-slate-900">Professional Details</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Job Title</label>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="e.g., VP Business Development" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
                  <input type="text" value={editCompany} onChange={(e) => setEditCompany(e.target.value)} placeholder="e.g., Biotech Inc." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Role in Deal Process</label>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all">
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
            <div className={`bg-white rounded-2xl p-6 border border-slate-200 shadow-sm ${mounted ? 'animate-fade-in stagger-3' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                </div>
                <h3 className="font-semibold text-slate-900">Subscription</h3>
              </div>

              <div className={`p-5 rounded-xl mb-6 ${tier === 'pro' ? 'bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200' : 'bg-slate-50 border border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${tier === 'pro' ? 'bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25' : 'bg-slate-200'}`}>
                      <svg className={`w-7 h-7 ${tier === 'pro' ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900">{tier === 'pro' ? 'Pro Plan' : 'Free Plan'}</p>
                      <p className="text-sm text-slate-500">{tier === 'pro' ? '$99/month • Billed monthly' : 'Free forever'}</p>
                    </div>
                  </div>
                  {tier === 'free' && <button onClick={onUpgrade} className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-500 hover:to-cyan-400 transition-all shadow-lg shadow-teal-500/20">Upgrade Now</button>}
                </div>
              </div>

              {/* Feature Comparison */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-3 bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <span className="text-sm font-semibold text-slate-700">Feature</span>
                  <span className="text-sm font-semibold text-slate-700 text-center">Free</span>
                  <span className="text-sm font-semibold text-teal-700 text-center">Pro</span>
                </div>
                {[
                  { feature: 'Monthly calculations', free: '2', pro: 'Unlimited' },
                  { feature: 'PDF reports', free: false, pro: true },
                  { feature: 'Detailed breakdowns', free: false, pro: true },
                  { feature: 'History retention', free: '30 days', pro: 'Forever' },
                  { feature: 'Priority support', free: false, pro: true },
                ].map((row, idx) => (
                  <div key={idx} className="grid grid-cols-3 px-4 py-3 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-600">{row.feature}</span>
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
            <div className={`bg-white rounded-2xl p-6 border border-slate-200 shadow-sm ${mounted ? 'animate-fade-in stagger-4' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                </div>
                <h3 className="font-semibold text-slate-900">Data & Privacy</h3>
              </div>
              <button onClick={handleExportData} disabled={isExporting} className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group disabled:opacity-70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors relative overflow-hidden">
                    {isExporting ? (
                      <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-slate-900">{isExporting ? 'Exporting...' : 'Export All My Data'}</p>
                    <p className="text-sm text-slate-500">{isExporting ? `${exportProgress}% complete` : 'Download your profile and calculation history'}</p>
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
            <div className={`bg-white rounded-2xl p-6 border border-red-200 shadow-sm ${mounted ? 'animate-fade-in stagger-5' : 'opacity-0'}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="font-semibold text-red-600">Account Actions</h3>
              </div>
              <div className="space-y-3">
                <button onClick={onSignOut} className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center group-hover:bg-slate-300 transition-colors">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-slate-900">Sign Out</p>
                      <p className="text-sm text-slate-500">Sign out of your account on this device</p>
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
  );
}
