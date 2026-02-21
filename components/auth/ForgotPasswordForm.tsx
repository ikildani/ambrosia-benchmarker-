'use client';

import type { AuthFormState } from './useAuthForm';

interface ForgotPasswordFormProps {
  form: AuthFormState;
}

export default function ForgotPasswordForm({ form }: ForgotPasswordFormProps) {
  const { email, setEmail, touched, fieldErrors, handleBlur } = form;

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="auth-reset-email" className="block text-sm font-semibold text-neutral-700 mb-2">
          Email Address
        </label>
        <input
          id="auth-reset-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => handleBlur('email')}
          placeholder="john@company.com"
          aria-invalid={touched.email && !!fieldErrors.email}
          aria-describedby={touched.email && fieldErrors.email ? 'reset-email-error' : undefined}
          className={`w-full px-4 py-3.5 bg-neutral-50 border rounded-xl text-neutral-900 placeholder-neutral-400
                   focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all
                   ${touched.email && fieldErrors.email ? 'border-red-400' : 'border-neutral-200'}`}
        />
        {touched.email && fieldErrors.email && (
          <p id="reset-email-error" role="alert" className="mt-1.5 text-xs text-red-600">{fieldErrors.email}</p>
        )}
      </div>
    </div>
  );
}
