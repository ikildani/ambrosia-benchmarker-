import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { type CalculationHistoryItem } from '@/lib/history';
import { PRICING } from '@/lib/config/constants';
import { captureClientError } from '@/lib/sentry-client';
import AppearanceSettings from './AppearanceSettings';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { UserTier } from '@/types/tier';

function PasswordChangeSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (!isSupabaseConfigured()) {
      toast.error('Auth service unavailable.');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        toast.error('Auth service unavailable.');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setIsOpen(false);
      }
    } catch (err) {
      toast.error('Failed to update password. Please try again.');
      captureClientError(err, 'SettingsTab', { context: 'Password change failed' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Security</h3>
        </div>
        <button
          data-password-toggle
          onClick={() => setIsOpen(!isOpen)}
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {isOpen ? 'Cancel' : 'Change Password'}
        </button>
      </div>
      {isOpen && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={saving || !newPassword || !confirmPassword}
            className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-slate-800 dark:bg-slate-600 text-white hover:bg-slate-700 dark:hover:bg-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      )}
    </div>
  );
}

interface AvatarGradient {
  id: string;
  from: string;
  to: string;
  label: string;
}

interface SettingsTabProps {
  editName: string;
  userEmail: string;
  editCompany: string;
  editTitle: string;
  editPhone: string;
  editLinkedIn: string;
  editRole: string;
  memberSince: string;
  selectedAvatar: string;
  isSaving: boolean;
  saveMessage: string;
  showDeleteConfirm: boolean;
  tier: UserTier;
  history: CalculationHistoryItem[];
  avatarGradients: AvatarGradient[];
  getAvatarGradient: (id: string | null) => AvatarGradient;
  onEditName: (value: string) => void;
  onEditCompany: (value: string) => void;
  onEditTitle: (value: string) => void;
  onEditPhone: (value: string) => void;
  onEditLinkedIn: (value: string) => void;
  onEditRole: (value: string) => void;
  onSelectAvatar: (id: string) => void;
  onSaveSettings: () => void;
  onExportData: () => void;
  onSignOut: () => void;
  onShowDeleteConfirm: (show: boolean) => void;
  onDeleteAccount: () => void;
  onUpgrade: () => void;
}

const SettingsTab = React.memo(function SettingsTab({
  editName,
  userEmail,
  editCompany,
  editTitle,
  editPhone,
  editLinkedIn,
  editRole,
  memberSince,
  selectedAvatar,
  isSaving,
  saveMessage,
  showDeleteConfirm,
  tier,
  history,
  avatarGradients,
  getAvatarGradient,
  onEditName,
  onEditCompany,
  onEditTitle,
  onEditPhone,
  onEditLinkedIn,
  onEditRole,
  onSelectAvatar,
  onSaveSettings,
  onExportData,
  onSignOut,
  onShowDeleteConfirm,
  onDeleteAccount,
  onUpgrade,
}: SettingsTabProps) {
  // Email preferences state
  const [weeklyDigest, setWeeklyDigest] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('email_pref_weekly_digest');
    return saved !== null ? saved === 'true' : true; // default on
  });
  const [platformUpdates, setPlatformUpdates] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('email_pref_platform_updates');
    return saved !== null ? saved === 'true' : true;
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  const saveEmailPref = useCallback(async (field: string, enabled: boolean) => {
    setSavingPrefs(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch('/api/user/profile', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ [field]: enabled }),
          });
        }
      }
    } catch (err) {
      captureClientError(err, 'SettingsTab', { context: 'Failed to save email preferences' });
      toast.error('Failed to save preference');
    } finally {
      setSavingPrefs(false);
    }
  }, []);

  const handleToggleWeeklyDigest = useCallback(async (enabled: boolean) => {
    setWeeklyDigest(enabled);
    localStorage.setItem('email_pref_weekly_digest', String(enabled));
    await saveEmailPref('weekly_digest', enabled);
    toast.success(enabled ? 'Weekly digest enabled' : 'Weekly digest disabled');
  }, [saveEmailPref]);

  const handleTogglePlatformUpdates = useCallback(async (enabled: boolean) => {
    setPlatformUpdates(enabled);
    localStorage.setItem('email_pref_platform_updates', String(enabled));
    await saveEmailPref('platform_updates', enabled);
    toast.success(enabled ? 'Platform updates enabled' : 'Platform updates disabled');
  }, [saveEmailPref]);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Profile Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(14, 165, 165, 0.5) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />

        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${getAvatarGradient(selectedAvatar).from} ${getAvatarGradient(selectedAvatar).to} flex items-center justify-center text-4xl font-bold shadow-xl shadow-slate-900/15 dark:shadow-blue-400/15`}>
            {editName.charAt(0).toUpperCase()}
          </div>
          <div className="text-center sm:text-left flex-1">
            <h2 className="text-2xl font-bold">{editName}</h2>
            <p className="text-slate-400">{userEmail}</p>
            {editCompany && <p className="text-blue-400 mt-1">{editCompany}</p>}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                (tier === 'pro' || tier === 'report' || tier === 'portfolio')
                  ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {tier === 'pro' ? 'Pro Member' : tier === 'report' ? 'Report' : 'Free Plan'}
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

        {/* Avatar Color Selection */}
        <div className="relative mt-6 pt-6 border-t border-slate-700/50">
          <p className="text-sm font-medium text-slate-400 mb-3">Choose Avatar Color</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3">
            {avatarGradients.map((gradient) => (
              <button
                key={gradient.id}
                onClick={() => onSelectAvatar(gradient.id)}
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient.from} ${gradient.to} flex items-center justify-center transition-all ${
                  selectedAvatar === gradient.id
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                    : 'hover:scale-105 opacity-70 hover:opacity-100'
                }`}
                title={gradient.label}
              >
                {selectedAvatar === gradient.id && (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appearance */}
      <AppearanceSettings />

      {/* Personal Information */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Personal Information</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => onEditName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Email <span className="text-slate-500 dark:text-slate-400 font-normal">(read only)</span>
            </label>
            <input
              type="email"
              value={userEmail}
              disabled
              className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => onEditPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                       focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">LinkedIn Profile</label>
            <input
              type="url"
              value={editLinkedIn}
              onChange={(e) => onEditLinkedIn(e.target.value)}
              placeholder="linkedin.com/in/yourprofile"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                       focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Professional Details */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Professional Details</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Job Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => onEditTitle(e.target.value)}
              placeholder="e.g., VP Business Development"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                       focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Company</label>
            <input
              type="text"
              value={editCompany}
              onChange={(e) => onEditCompany(e.target.value)}
              placeholder="e.g., Biotech Inc."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                       focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Your Role in Deal Process</label>
            <select
              value={editRole}
              onChange={(e) => onEditRole(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
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
          onClick={onSaveSettings}
          disabled={isSaving}
          className="w-full mt-6 px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold rounded-xl
                   shadow-lg shadow-slate-900/15 dark:shadow-blue-400/10 hover:shadow-xl hover:from-slate-700 hover:to-slate-800
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Subscription</h3>
        </div>
        <div className={`p-5 rounded-xl mb-4 ${(tier === 'pro' || tier === 'report' || tier === 'portfolio') ? 'bg-gradient-to-br from-slate-50 to-blue-50 dark:from-blue-900/15 dark:to-blue-800/20 border border-blue-200 dark:border-blue-600/20' : 'bg-slate-50 dark:bg-slate-700'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                (tier === 'pro' || tier === 'report' || tier === 'portfolio')
                  ? 'bg-gradient-to-br from-slate-800 to-slate-900 shadow-lg shadow-slate-900/15 dark:shadow-blue-400/10'
                  : 'bg-slate-200 dark:bg-slate-600'
              }`}>
                <svg className={`w-7 h-7 ${(tier === 'pro' || tier === 'report' || tier === 'portfolio') ? 'text-white' : 'text-slate-500 dark:text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{tier === 'pro' ? 'Pro Plan' : tier === 'report' ? 'Report Access' : 'Free Plan'}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{tier === 'pro' ? `${PRICING.PRO_MONTHLY} • Billed monthly` : tier === 'report' ? 'One-time report purchase' : 'Free forever'}</p>
              </div>
            </div>
            {tier === 'free' ? (
              <button
                onClick={onUpgrade}
                className="px-6 py-3 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold rounded-xl hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg shadow-slate-900/15 dark:shadow-blue-400/10"
              >
                Upgrade Now
              </button>
            ) : tier === 'pro' && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/billing/portal', { method: 'POST' });
                    const data = await res.json();
                    if (data.url) {
                      window.location.href = data.url;
                    } else {
                      toast.error('Unable to open billing portal. Please try again.');
                    }
                  } catch {
                    toast.error('Connection error. Please try again.');
                  }
                }}
                className="px-5 py-2.5 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
              >
                Manage Subscription
              </button>
            )}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {((tier === 'pro' || tier === 'report' || tier === 'portfolio')
            ? ['Unlimited calculations', 'PDF report generation', 'Full history access', 'Priority support', 'Advanced analytics']
            : ['2 calculations per month', 'Basic deal estimates', 'Calculation history']
          ).map((feature, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <PasswordChangeSection />

      {/* Email Preferences */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Email Preferences</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between px-4 py-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Weekly Market Digest</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Deal activity, benchmark shifts, and market trends</p>
              </div>
            </div>
            <button
              onClick={() => handleToggleWeeklyDigest(!weeklyDigest)}
              disabled={savingPrefs}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
                weeklyDigest ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
              } ${savingPrefs ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              role="switch"
              aria-checked={weeklyDigest}
              aria-label="Toggle weekly market digest emails"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                  weeklyDigest ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between px-4 py-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">Platform Updates</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">New features, improvements, and data updates</p>
              </div>
            </div>
            <button
              onClick={() => handleTogglePlatformUpdates(!platformUpdates)}
              disabled={savingPrefs}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
                platformUpdates ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-600'
              } ${savingPrefs ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              role="switch"
              aria-checked={platformUpdates}
              aria-label="Toggle platform update emails"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                  platformUpdates ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Data & Privacy</h3>
        </div>
        <div className="space-y-3">
          <button
            onClick={onExportData}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-500/30 transition-colors">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium text-slate-900 dark:text-white">Export All My Data</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Download your profile and calculation history</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Account Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-red-200 dark:border-red-500/30 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-semibold text-red-600 dark:text-red-400">Account Actions</h3>
        </div>
        <div className="space-y-3">
          <button
            onClick={onSignOut}
            className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center group-hover:bg-slate-300 dark:group-hover:bg-slate-500 transition-colors">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium text-slate-900 dark:text-white">Sign Out</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Sign out of your account on this device</p>
              </div>
            </div>
          </button>

          {!showDeleteConfirm ? (
            <button
              onClick={() => onShowDeleteConfirm(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-red-50 dark:bg-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/30 rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-200 dark:bg-red-500/30 flex items-center justify-center group-hover:bg-red-300 dark:group-hover:bg-red-500/40 transition-colors">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-medium text-red-700 dark:text-red-400">Delete Account</p>
                  <p className="text-sm text-red-500 dark:text-red-400/80">Permanently delete your account and all data</p>
                </div>
              </div>
            </button>
          ) : (
            <div className="p-5 bg-red-50 dark:bg-red-500/20 rounded-xl border border-red-200 dark:border-red-500/30">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-red-700 dark:text-red-400">Are you absolutely sure?</p>
                  <p className="text-sm text-red-600 dark:text-red-400/90 mt-1">
                    This will permanently delete your account, all {history.length} calculations, and cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => onShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onDeleteAccount}
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
  );
});

export default SettingsTab;
