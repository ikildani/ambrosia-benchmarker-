'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { useAuthForm } from './auth/useAuthForm';
import { useAuthActions } from './auth/useAuthActions';
import SignUpForm from './auth/SignUpForm';
import SignInForm from './auth/SignInForm';
import ForgotPasswordForm from './auth/ForgotPasswordForm';
import VerifyEmailView from './auth/VerifyEmailView';
import SocialSignInButtons from './auth/SocialSignInButtons';
import { DEAL_STATS } from '@/lib/config/constants';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string, name: string) => void;
  initialMode?: 'signin' | 'signup';
}

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'verify-email';

export default function AuthModal({ isOpen, onClose, onSuccess, initialMode = 'signup' }: AuthModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen, onClose);
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const form = useAuthForm();
  const actions = useAuthActions({
    email: form.email,
    password: form.password,
    confirmPassword: form.confirmPassword,
    name: form.name,
    company: form.company,
    acceptTerms: form.acceptTerms,
    magicLinkMode: form.magicLinkMode,
    mode,
    setMode,
    onSuccess,
  });

  const showSocial = (mode === 'signin' || mode === 'signup') && isSupabaseConfigured();

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      actions.clearMessages();
      form.setMagicLinkMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const getTitle = () => {
    switch (mode) {
      case 'signup': return 'Create your account';
      case 'signin': return 'Sign in';
      case 'forgot-password': return 'Reset password';
      case 'verify-email': return 'Check your email';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'signup': return `Access deal benchmarks from ${DEAL_STATS.TOTAL_DEALS} verified transactions`;
      case 'signin': return 'Welcome back to Ambrosia Ventures';
      case 'forgot-password': return 'We\'ll send you a link to reset your password';
      case 'verify-email': return 'We sent a verification link to your email';
    }
  };

  const getButtonText = () => {
    if (actions.isLoading) return 'Processing...';
    switch (mode) {
      case 'signup': return 'Create Account';
      case 'signin': return form.magicLinkMode ? 'Send Magic Link' : 'Sign In';
      case 'forgot-password': return 'Send Reset Link';
      default: return 'Continue';
    }
  };

  const handleModeSwitch = (newMode: AuthMode) => {
    setMode(newMode);
    actions.clearMessages();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        tabIndex={-1}
        className="bg-white dark:bg-[#0d1420] border dark:border-white/[0.06] rounded-2xl shadow-2xl max-w-[420px] w-full max-h-[90vh] overflow-y-auto overscroll-contain animate-slide-up"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-2">
          <div className="flex items-center justify-between mb-6">
            <Image src="/logo-white.png" alt="Ambrosia Ventures" width={134} height={28} className="h-7 w-auto hidden dark:block" />
            <Image src="/logo-color.png" alt="Ambrosia Ventures" width={134} height={28} className="h-7 w-auto dark:hidden" />
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
              aria-label="Close dialog"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <h3 id="auth-modal-title" className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {getTitle()}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{getSubtitle()}</p>
        </div>

        {/* Form */}
        <form onSubmit={actions.handleSubmit} className="px-8 pb-8 pt-4">
          {actions.error && (
            <div role="alert" className="mb-5 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-start gap-2.5">
              <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 dark:text-red-400 text-sm">{actions.error}</p>
            </div>
          )}

          {actions.success && (
            <div role="status" className="mb-5 p-3 bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/20 rounded-lg flex items-start gap-2.5">
              <svg className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-teal-800 dark:text-teal-300 text-sm">{actions.success}</p>
            </div>
          )}

          {/* Social Sign In */}
          {showSocial && <SocialSignInButtons mode={mode} actions={actions} />}

          {/* Form content by mode */}
          {mode === 'verify-email' && (
            <VerifyEmailView email={form.email} actions={actions} setMode={handleModeSwitch} />
          )}
          {mode === 'forgot-password' && <ForgotPasswordForm form={form} />}
          {mode === 'signup' && <SignUpForm form={form} />}
          {mode === 'signin' && <SignInForm form={form} actions={actions} setMode={handleModeSwitch} />}

          {/* Submit button */}
          {mode !== 'verify-email' && (
            <button
              type="submit"
              disabled={actions.isLoading}
              className="w-full mt-6 bg-teal-500 hover:bg-teal-400 text-[#0a0f1a] font-bold py-3 px-6 rounded-lg
                       transition-all duration-200 shadow-lg shadow-teal-500/20 hover:shadow-teal-400/30
                       disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {actions.isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <span>{getButtonText()}</span>
              )}
            </button>
          )}

          {/* Mode switching */}
          <div className="mt-5 text-center">
            {mode === 'signup' && (
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('signin')}
                  className="text-slate-900 dark:text-teal-400 font-semibold hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === 'signin' && (
              <>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('signup')}
                    className="text-slate-900 dark:text-teal-400 font-semibold hover:underline"
                  >
                    Create one
                  </button>
                </p>
                <Link
                  href="/portfolio/sso"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-teal-500 dark:hover:text-teal-400 transition-colors mt-2"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Sign in with SSO
                </Link>
              </>
            )}
            {mode === 'forgot-password' && (
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('signin')}
                  className="text-slate-900 dark:text-teal-400 font-semibold hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>

          {mode === 'signup' && (
            <p className="mt-5 text-[11px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
              By creating an account, you agree to our{' '}
              <a href="/terms" className="underline hover:text-slate-600 dark:hover:text-slate-300">Terms</a> and{' '}
              <a href="/privacy" className="underline hover:text-slate-600 dark:hover:text-slate-300">Privacy Policy</a>.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
