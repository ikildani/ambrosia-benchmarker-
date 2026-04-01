'use client';

import type { AuthFormState } from './useAuthForm';
import type { AuthActionsState } from './useAuthActions';

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'verify-email';

interface SignInFormProps {
  form: AuthFormState;
  actions: AuthActionsState;
  setMode: (mode: AuthMode) => void;
}

export default function SignInForm({ form, actions, setMode }: SignInFormProps) {
  const {
    email, setEmail,
    password, setPassword,
    showPassword, setShowPassword,
    magicLinkMode, setMagicLinkMode,
    touched, fieldErrors,
    handleBlur,
  } = form;

  return (
    <div className="space-y-5">
      {/* Email */}
      <div>
        <label htmlFor="auth-email" className="block text-sm font-semibold text-neutral-700 dark:text-slate-300 mb-2">
          Work Email <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => handleBlur('email')}
          placeholder="john@company.com"
          aria-required="true"
          aria-invalid={touched.email && !!fieldErrors.email}
          aria-describedby={touched.email && fieldErrors.email ? 'email-error' : undefined}
          className={`w-full px-4 py-3.5 bg-neutral-50 dark:bg-white/[0.04] border rounded-xl text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-slate-500
                   focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all
                   ${touched.email && fieldErrors.email ? 'border-red-400' : 'border-neutral-200 dark:border-white/[0.08]'}`}
        />
        {touched.email && fieldErrors.email && (
          <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-600">{fieldErrors.email}</p>
        )}
      </div>

      {/* Password field - hidden in magic link mode */}
      {!magicLinkMode && (
        <div>
          <label htmlFor="auth-password" className="block text-sm font-semibold text-neutral-700 dark:text-slate-300 mb-2">
            Password <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur('password')}
              placeholder="••••••••"
              aria-required="true"
              aria-invalid={touched.password && !!fieldErrors.password}
              aria-describedby={touched.password && fieldErrors.password ? 'password-error' : undefined}
              className={`w-full px-4 py-3.5 bg-neutral-50 border rounded-xl text-neutral-900 placeholder-neutral-400
                       focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all pr-12
                       ${touched.password && fieldErrors.password ? 'border-red-400' : 'border-neutral-200 dark:border-white/[0.08]'}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors p-2"
            >
              {showPassword ? (
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
          {touched.password && fieldErrors.password && (
            <p id="password-error" role="alert" className="mt-1.5 text-xs text-red-600">{fieldErrors.password}</p>
          )}
        </div>
      )}

      {/* Magic link toggle + Forgot password */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setMagicLinkMode(!magicLinkMode); actions.clearMessages(); }}
          className="text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {magicLinkMode ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            )}
          </svg>
          {magicLinkMode ? 'Use password instead' : 'Send me a login link'}
        </button>
        {!magicLinkMode && (
          <button
            type="button"
            onClick={() => { setMode('forgot-password'); actions.clearMessages(); }}
            className="text-sm text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-300 transition-colors"
          >
            Forgot password?
          </button>
        )}
      </div>
    </div>
  );
}
