'use client';

import type { AuthFormState } from './useAuthForm';
import PasswordStrengthBar from './PasswordStrengthBar';

interface SignUpFormProps {
  form: AuthFormState;
}

export default function SignUpForm({ form }: SignUpFormProps) {
  const {
    name, setName,
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    company, setCompany,
    showPassword, setShowPassword,
    acceptTerms, setAcceptTerms,
    touched, fieldErrors, passwordStrength,
    handleBlur,
  } = form;

  return (
    <div className="space-y-5">
      {/* Full Name */}
      <div>
        <label htmlFor="auth-name" className="block text-sm font-semibold text-neutral-700 mb-2">
          Full Name <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="auth-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => handleBlur('name')}
          placeholder="John Smith"
          aria-required="true"
          aria-invalid={touched.name && !!fieldErrors.name}
          aria-describedby={touched.name && fieldErrors.name ? 'name-error' : undefined}
          className={`w-full px-4 py-3.5 bg-neutral-50 border rounded-xl text-neutral-900 placeholder-neutral-400
                   focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all
                   ${touched.name && fieldErrors.name ? 'border-red-400' : 'border-neutral-200'}`}
        />
        {touched.name && fieldErrors.name && (
          <p id="name-error" role="alert" className="mt-1.5 text-xs text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="auth-email" className="block text-sm font-semibold text-neutral-700 mb-2">
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
          className={`w-full px-4 py-3.5 bg-neutral-50 border rounded-xl text-neutral-900 placeholder-neutral-400
                   focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all
                   ${touched.email && fieldErrors.email ? 'border-red-400' : 'border-neutral-200'}`}
        />
        {touched.email && fieldErrors.email && (
          <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-600">{fieldErrors.email}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="auth-password" className="block text-sm font-semibold text-neutral-700 mb-2">
          Password <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <div className="relative">
          <input
            id="auth-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleBlur('password')}
            placeholder="Min. 8 characters"
            aria-required="true"
            aria-invalid={touched.password && !!fieldErrors.password}
            aria-describedby={[
              touched.password && fieldErrors.password ? 'password-error' : '',
              password ? 'password-strength' : '',
            ].filter(Boolean).join(' ') || undefined}
            className={`w-full px-4 py-3.5 bg-neutral-50 border rounded-xl text-neutral-900 placeholder-neutral-400
                     focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all pr-12
                     ${touched.password && fieldErrors.password ? 'border-red-400' : 'border-neutral-200'}`}
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
        {password && <PasswordStrengthBar strength={passwordStrength} />}
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="auth-confirm-password" className="block text-sm font-semibold text-neutral-700 mb-2">
          Confirm Password <span className="text-red-500">*</span>
        </label>
        <input
          id="auth-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => handleBlur('confirmPassword')}
          placeholder="••••••••"
          aria-invalid={touched.confirmPassword && !!fieldErrors.confirmPassword}
          aria-describedby={touched.confirmPassword && fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
          className={`w-full px-4 py-3.5 bg-neutral-50 border rounded-xl text-neutral-900 placeholder-neutral-400
                   focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all
                   ${touched.confirmPassword && fieldErrors.confirmPassword ? 'border-red-400' : 'border-neutral-200'}`}
        />
        {touched.confirmPassword && fieldErrors.confirmPassword && (
          <p id="confirm-password-error" role="alert" className="mt-1.5 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
        )}
      </div>

      {/* Company */}
      <div>
        <label className="block text-sm font-semibold text-neutral-700 mb-2">
          Company <span className="text-neutral-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Biotech Inc."
          className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400
                   focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
        />
      </div>

      {/* Terms Checkbox */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="terms"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-neutral-300 text-teal-600 focus:ring-teal-500"
        />
        <label htmlFor="terms" className="text-sm text-neutral-600">
          I agree to the{' '}
          <a href="/terms" target="_blank" className="text-teal-600 hover:text-teal-700 font-medium">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" className="text-teal-600 hover:text-teal-700 font-medium">
            Privacy Policy
          </a>
        </label>
      </div>
    </div>
  );
}
