'use client';

import type { AuthActionsState } from './useAuthActions';

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'verify-email';

interface VerifyEmailViewProps {
  email: string;
  actions: AuthActionsState;
  setMode: (mode: AuthMode) => void;
}

export default function VerifyEmailView({ email, actions, setMode }: VerifyEmailViewProps) {
  const { isLoading, handleResendVerification, setSuccess } = actions;

  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-teal-50 flex items-center justify-center">
        <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-neutral-900 mb-2">Check Your Email</h3>
      <p className="text-neutral-600 mb-6">
        We&apos;ve sent a verification link to<br />
        <span className="font-semibold text-neutral-900">{email}</span>
      </p>
      <button
        onClick={handleResendVerification}
        disabled={isLoading}
        className="text-teal-600 font-semibold hover:text-teal-700 transition-colors disabled:opacity-50"
      >
        {isLoading ? 'Sending...' : 'Resend verification email'}
      </button>
      <div className="mt-6">
        <button
          onClick={() => { setMode('signin'); setSuccess(''); }}
          className="text-neutral-500 text-sm hover:text-neutral-700 transition-colors"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );
}
