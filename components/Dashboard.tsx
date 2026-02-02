'use client';

import { useState, useEffect } from 'react';
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<CalculationHistoryItem | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    setHistory(getHistory());
    // Load user data from localStorage
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

  const handleDeleteHistory = (id: string) => {
    deleteHistoryItem(id);
    setHistory(getHistory());
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

  const handleSaveSettings = async () => {
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

  const recentCalculations = history.slice(0, 5);
  const pdfReports = history.filter(item => item.hasPDF);

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
    return `$${value}M`;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20">
      {/* Header with Full Navigation */}
      <header className="bg-white/95 backdrop-blur-lg border-b border-slate-200/80 sticky top-0 z-40 safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button onClick={onNavigateHome} className="flex items-center touch-feedback">
              <Image
                src="/logo.png"
                alt="Ambrosia Ventures"
                width={180}
                height={48}
                className="h-9 sm:h-10 w-auto object-contain"
                priority
              />
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <button
                onClick={onNavigateHome}
                className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                Home
              </button>
              <button
                onClick={onNavigateToCalculator}
                className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                Calculator
              </button>
              <button
                onClick={() => { onNavigateHome(); setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                Pricing
              </button>
              <button
                onClick={() => { onNavigateHome(); setTimeout(() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
                className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                About
              </button>
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-2 sm:gap-4">
              {tier === 'free' ? (
                <span className="hidden sm:inline-flex px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
                  Free Plan
                </span>
              ) : (
                <span className="hidden sm:inline-flex px-3 py-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-semibold rounded-full shadow-sm">
                  Pro Plan
                </span>
              )}

              {/* User Avatar/Dropdown */}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm shadow-md shadow-teal-500/20">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-slate-900 leading-tight">{userName}</p>
                  <p className="text-xs text-slate-500">{userEmail}</p>
                </div>
              </div>

              {/* Mobile Menu Button - Larger touch target */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-3 -mr-2 text-slate-600 hover:text-slate-900 touch-feedback rounded-xl"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Mobile Navigation - Full-screen overlay - OUTSIDE header to avoid stacking context issues */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 bottom-0 bg-white z-[9999] overflow-y-auto safe-bottom">
          <nav className="flex flex-col p-4 gap-1">
            {/* Navigation Links */}
            <button
              onClick={() => { setMobileMenuOpen(false); onNavigateHome(); }}
              className="flex items-center gap-4 px-4 py-4 text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-2xl font-medium transition-colors touch-feedback"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <span className="text-base">Home</span>
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onNavigateToCalculator(); }}
              className="flex items-center gap-4 px-4 py-4 text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-2xl font-medium transition-colors touch-feedback"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-base">Calculator</span>
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onNavigateHome(); setTimeout(() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
              className="flex items-center gap-4 px-4 py-4 text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-2xl font-medium transition-colors touch-feedback"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-base">Pricing</span>
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onNavigateHome(); setTimeout(() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }), 100); }}
              className="flex items-center gap-4 px-4 py-4 text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-2xl font-medium transition-colors touch-feedback"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-base">About</span>
            </button>

            {/* Divider */}
            <div className="my-4 border-t border-slate-200" />

            {/* User Section */}
            <div className="px-4 py-3 bg-slate-50 rounded-2xl mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{userName}</p>
                  <p className="text-sm text-slate-500 truncate">{userEmail}</p>
                </div>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                  tier === 'pro'
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {tier === 'pro' ? 'Pro' : 'Free'}
                </span>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={() => { setMobileMenuOpen(false); onSignOut(); }}
              className="flex items-center gap-4 px-4 py-4 text-red-600 hover:bg-red-50 active:bg-red-100 rounded-2xl font-medium transition-colors touch-feedback"
            >
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <span className="text-base">Sign Out</span>
            </button>
          </nav>
        </div>
      )}

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

        {/* Navigation Tabs - Mobile optimized with horizontal scroll */}
        <div className="mb-6 sm:mb-8 -mx-3 sm:mx-0 px-3 sm:px-0">
          <div className="flex gap-1.5 sm:gap-1 bg-slate-100 p-1.5 sm:p-1 rounded-2xl sm:rounded-xl w-full sm:w-fit overflow-x-auto hide-scrollbar scroll-snap-x">
            {[
              { id: 'overview', label: 'Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
              { id: 'history', label: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
              { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center justify-center gap-2 px-4 sm:px-4 py-3 sm:py-2.5 rounded-xl sm:rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none min-w-[80px] sm:min-w-0 scroll-snap-center touch-feedback ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-md sm:shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 active:bg-white/50'
                }`}
              >
                <svg className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  activeTab === tab.id ? 'text-teal-600' : ''
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Deal Insights - Full Width */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
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
                  <div className="p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-lg sm:rounded-xl border border-teal-200/50">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-medium text-teal-700">Total Analyses</span>
                    </div>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-teal-700">{history.length}</p>
                  </div>

                  <div className="p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-lg sm:rounded-xl border border-cyan-200/50">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-medium text-cyan-700 truncate">Total Value</span>
                    </div>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-cyan-700">
                      {formatCurrency(history.reduce((sum, h) => sum + h.results.totalValueMedian, 0))}
                    </p>
                  </div>

                  <div className="p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg sm:rounded-xl border border-blue-200/50">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      <span className="text-xs font-medium text-blue-700 truncate">Top Phase</span>
                    </div>
                    <p className="text-sm sm:text-lg lg:text-xl font-bold text-blue-700 truncate">
                      {topPhase}
                    </p>
                  </div>

                  <div className="p-3 sm:p-4 lg:p-5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-lg sm:rounded-xl border border-indigo-200/50">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                      <span className="text-xs font-medium text-indigo-700 truncate">Top Modality</span>
                    </div>
                    <p className="text-sm sm:text-lg lg:text-xl font-bold text-indigo-700 truncate">
                      {topModality}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 px-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-slate-900 mb-2">No deal insights yet</h4>
                  <p className="text-slate-500 text-sm mb-4">Run your first calculation to see analytics here</p>
                  <button
                    onClick={onNavigateToCalculator}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-medium rounded-xl hover:from-teal-500 hover:to-cyan-400 transition-all shadow-lg shadow-teal-500/20"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Run Your First Analysis
                  </button>
                </div>
              )}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
            {/* Stats Cards */}
            <div className="lg:col-span-2 grid sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm sm:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">Subscription</h3>
                  {tier === 'free' && (
                    <button
                      onClick={onUpgrade}
                      className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
                    >
                      Upgrade to Pro
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    tier === 'pro'
                      ? 'bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25'
                      : 'bg-slate-100'
                  }`}>
                    <svg className={`w-6 h-6 ${tier === 'pro' ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{tier === 'pro' ? 'Pro Plan' : 'Free Plan'}</p>
                    <p className="text-sm text-slate-500">
                      {tier === 'pro'
                        ? 'Full access to all features'
                        : 'Limited to 2 calculations per month'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-3 sm:mb-4 text-sm sm:text-base">Recent Activity</h3>
              {recentCalculations.length > 0 ? (
                <div className="space-y-4">
                  {recentCalculations.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleHistoryClick(item)}
                      onKeyDown={(e) => e.key === 'Enter' && handleHistoryClick(item)}
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${item.labels.phase} ${item.labels.modality} calculation from ${formatDate(item.timestamp)}`}
                      className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0
                                 cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-2 rounded-lg transition-all duration-200
                                 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                        <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {item.labels.phase} • {item.labels.modality}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(item.timestamp)}
                        </p>
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
                  <button
                    onClick={onNavigateToCalculator}
                    className="mt-3 text-sm font-medium text-teal-600 hover:text-teal-700"
                  >
                    Start your first calculation
                  </button>
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Calculation History</h3>
              <p className="text-sm text-slate-500 mt-1">View and manage your past deal analyses</p>
            </div>

            {history.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {history.map((item) => (
                  <div key={item.id} className="p-6 hover:bg-slate-50 transition-colors history-item-clickable group">
                    <div
                      onClick={() => handleHistoryClick(item)}
                      onKeyDown={(e) => e.key === 'Enter' && handleHistoryClick(item)}
                      role="button"
                      tabIndex={0}
                      aria-label={`View calculation details for ${item.labels.phase} ${item.labels.modality}`}
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
                            {item.hasPDF && (
                              <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs font-medium rounded-full">
                                PDF
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">
                            {item.labels.modality} • {item.labels.indication}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatDate(item.timestamp)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-slate-500">Upfront</p>
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(item.results.upfrontMedian)}
                          </p>
                          <p className="text-xs text-slate-500 mt-2">Total Value</p>
                          <p className="font-semibold text-teal-600">
                            {formatCurrency(item.results.totalValueMedian)}
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteHistory(item.id); }}
                        className="text-sm text-slate-500 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">No calculations yet</h3>
                <p className="text-slate-500 mb-4">Your calculation history will appear here</p>
                <button
                  onClick={onNavigateToCalculator}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Calculation
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-6">
            {/* Profile Header Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 199, 199, 0.5) 1px, transparent 0)`,
                  backgroundSize: '24px 24px'
                }} />
              </div>
              <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl" />

              <div className="relative flex flex-col sm:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-4xl font-bold shadow-xl shadow-teal-500/30">
                  {editName.charAt(0).toUpperCase()}
                </div>
                <div className="text-center sm:text-left flex-1">
                  <h2 className="text-2xl font-bold">{editName}</h2>
                  <p className="text-slate-400">{userEmail}</p>
                  {editCompany && <p className="text-teal-400 mt-1">{editCompany}</p>}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      tier === 'pro'
                        ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {tier === 'pro' ? 'Pro Member' : 'Free Plan'}
                    </span>
                    {memberSince && (
                      <span className="text-slate-500 text-xs">
                        Member since {new Date(memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                {saveMessage && (
                  <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-lg text-sm font-medium ${
                    saveMessage.includes('success') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {saveMessage}
                  </div>
                )}
              </div>
            </div>

            {/* Personal Information */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900">Personal Information</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900
                             focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email <span className="text-slate-400 font-normal">(read only)</span>
                  </label>
                  <input
                    type="email"
                    value={userEmail}
                    disabled
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">LinkedIn Profile</label>
                  <input
                    type="url"
                    value={editLinkedIn}
                    onChange={(e) => setEditLinkedIn(e.target.value)}
                    placeholder="linkedin.com/in/yourprofile"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Professional Details */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900">Professional Details</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Job Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g., VP Business Development"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
                  <input
                    type="text"
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    placeholder="e.g., Biotech Inc."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Your Role in Deal Process</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900
                             focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  >
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

              {/* Save Button */}
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full mt-6 px-4 py-3.5 bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold rounded-xl
                         shadow-lg shadow-teal-500/20 hover:shadow-xl hover:from-teal-500 hover:to-cyan-400
                         transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Save All Changes</span>
                  </>
                )}
              </button>
            </div>

            {/* Subscription */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900">Subscription</h3>
              </div>
              <div className={`p-5 rounded-xl mb-4 ${tier === 'pro' ? 'bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200' : 'bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                      tier === 'pro'
                        ? 'bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25'
                        : 'bg-slate-200'
                    }`}>
                      <svg className={`w-7 h-7 ${tier === 'pro' ? 'text-white' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900">{tier === 'pro' ? 'Pro Plan' : 'Free Plan'}</p>
                      <p className="text-sm text-slate-500">{tier === 'pro' ? '$99/month • Billed monthly' : 'Free forever'}</p>
                    </div>
                  </div>
                  {tier === 'free' && (
                    <button
                      onClick={onUpgrade}
                      className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-500 hover:to-cyan-400 transition-all shadow-lg shadow-teal-500/20"
                    >
                      Upgrade Now
                    </button>
                  )}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {(tier === 'pro'
                  ? ['Unlimited calculations', 'PDF report generation', 'Full history access', 'Priority support', 'Advanced analytics', 'API access coming soon']
                  : ['2 calculations per month', 'Basic deal estimates', 'Calculation history']
                ).map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            {/* Data & Privacy */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900">Data & Privacy</h3>
              </div>
              <div className="space-y-3">
                <button
                  onClick={handleExportData}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-slate-900">Export All My Data</p>
                      <p className="text-sm text-slate-500">Download your profile and calculation history</p>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Account Actions */}
            <div className="bg-white rounded-2xl p-6 border border-red-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-red-600">Account Actions</h3>
              </div>
              <div className="space-y-3">
                <button
                  onClick={onSignOut}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center group-hover:bg-slate-300 transition-colors">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-slate-900">Sign Out</p>
                      <p className="text-sm text-slate-500">Sign out of your account on this device</p>
                    </div>
                  </div>
                </button>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-between px-4 py-3.5 bg-red-50 hover:bg-red-100 rounded-xl transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-200 flex items-center justify-center group-hover:bg-red-300 transition-colors">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-red-700">Delete Account</p>
                        <p className="text-sm text-red-500">Permanently delete your account and all data</p>
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="p-5 bg-red-50 rounded-xl border border-red-200">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-red-700">Are you absolutely sure?</p>
                        <p className="text-sm text-red-600 mt-1">
                          This will permanently delete your account, all {history.length} calculations, and cannot be undone.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors"
                      >
                        Yes, Delete Forever
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
