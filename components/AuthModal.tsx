'use client';

import { useState, useEffect, useRef } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { useAuthForm } from './auth/useAuthForm';
import { useAuthActions } from './auth/useAuthActions';
import SignUpForm from './auth/SignUpForm';
import SignInForm from './auth/SignInForm';
import ForgotPasswordForm from './auth/ForgotPasswordForm';
import VerifyEmailView from './auth/VerifyEmailView';
import SocialSignInButtons from './auth/SocialSignInButtons';

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

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      actions.clearMessages();
      form.setMagicLinkMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const getHeaderContent = () => {
    switch (mode) {
      case 'signup':
        return {
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />,
          title: 'Create Account',
          subtitle: 'Get access to deal benchmarks',
        };
      case 'signin':
        return {
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />,
          title: 'Welcome Back',
          subtitle: 'Sign in to your account',
        };
      case 'forgot-password':
        return {
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />,
          title: 'Reset Password',
          subtitle: 'Enter your email to receive a reset link',
        };
      case 'verify-email':
        return {
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
          title: 'Verify Email',
          subtitle: 'Check your inbox for the verification link',
        };
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

  const header = getHeaderContent();

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        tabIndex={-1}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto overscroll-contain animate-slide-up"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 px-8 py-8">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
            aria-label="Close dialog"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {header.icon}
              </svg>
            </div>
            <div>
              <h3 id="auth-modal-title" className="text-2xl font-bold text-white">{header.title}</h3>
              <p className="text-neutral-500 text-sm mt-1">{header.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={actions.handleSubmit} className="p-8">
          {actions.error && (
            <div role="alert" className="mb-6 p-4 bg-red-100 border border-red-300 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-800 text-sm">{actions.error}</p>
            </div>
          )}

          {actions.success && (
            <div role="status" className="mb-6 p-4 bg-green-100 border border-green-300 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-800 text-sm">{actions.success}</p>
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
              className="w-full mt-8 bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold py-4 px-6 rounded-xl
                       shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30
                       hover:from-teal-500 hover:to-cyan-400 transition-all duration-300
                       disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {actions.isLoading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
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

          {/* Mode switching links */}
          <div className="mt-6 text-center">
            {mode === 'signup' && (
              <p className="text-neutral-600 text-sm">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('signin')}
                  className="text-teal-700 font-semibold hover:text-teal-800 transition-colors"
                >
                  Sign In
                </button>
              </p>
            )}
            {mode === 'signin' && (
              <p className="text-neutral-600 text-sm">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('signup')}
                  className="text-teal-700 font-semibold hover:text-teal-800 transition-colors"
                >
                  Sign Up Free
                </button>
              </p>
            )}
            {mode === 'forgot-password' && (
              <p className="text-neutral-600 text-sm">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('signin')}
                  className="text-teal-700 font-semibold hover:text-teal-800 transition-colors"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>

          {/* Marketing disclaimer for signup */}
          {mode === 'signup' && (
            <p className="mt-6 text-xs text-neutral-500 text-center leading-relaxed">
              By signing up, you agree to receive product updates and marketing communications from Ambrosia Ventures.
              We respect your privacy.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
