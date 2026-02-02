'use client';

import { useState, useEffect } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string, name: string) => void;
  initialMode?: 'signin' | 'signup';
}

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'verify-email';

export default function AuthModal({ isOpen, onClose, onSuccess, initialMode = 'signup' }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const supabase = createClient();
  const useSupabaseAuth = isSupabaseConfigured() && supabase;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
      setSuccess('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // Validation
      if (!email || !validateEmail(email)) {
        setError('Please enter a valid email address');
        setIsLoading(false);
        return;
      }

      if (mode === 'forgot-password') {
        await handleForgotPassword();
        return;
      }

      if (!password) {
        setError('Please enter your password');
        setIsLoading(false);
        return;
      }

      if (mode === 'signup') {
        if (!name.trim()) {
          setError('Please enter your name');
          setIsLoading(false);
          return;
        }

        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          setIsLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }

        if (!acceptTerms) {
          setError('Please accept the terms of service');
          setIsLoading(false);
          return;
        }
      }

      if (useSupabaseAuth) {
        await handleSupabaseAuth();
      } else {
        await handleLocalAuth();
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupabaseAuth = async () => {
    if (!supabase) return;

    if (mode === 'signup') {
      // Sign up with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            company,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('An account with this email already exists. Please sign in.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      if (data.user && !data.user.confirmed_at) {
        // Email confirmation required
        setMode('verify-email');
        setSuccess(`We've sent a verification email to ${email}. Please check your inbox and click the link to verify your account.`);

        // Also create user profile
        try {
          await supabase.from('user_profiles').insert({
            id: data.user.id,
            email,
            company_name: company || null,
            tier: 'free',
            email_verified: false,
            attribution_source: new URLSearchParams(window.location.search).get('utm_source') || null,
            attribution_campaign: new URLSearchParams(window.location.search).get('utm_campaign') || null,
          });
        } catch (profileErr) {
          console.error('Profile creation error:', profileErr);
        }

        // Submit to Formspree for lead capture
        try {
          await fetch('https://formspree.io/f/maqbwgbq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              name,
              company,
              source: 'Deal Calculator Sign Up',
              timestamp: new Date().toISOString(),
            }),
          });
        } catch {
          // Continue even if Formspree fails
        }
        return;
      }

      // If email confirmation not required, complete signup
      onSuccess(email, name);
    } else {
      // Sign in with Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please verify your email before signing in. Check your inbox for the verification link.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      if (data.user) {
        const userName = data.user.user_metadata?.name || email.split('@')[0];
        onSuccess(email, userName);
      }
    }
  };

  const handleLocalAuth = async () => {
    // Local storage fallback (demo mode)
    const userData = {
      email,
      name: mode === 'signup' ? name : email.split('@')[0],
      company,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem('user_data', JSON.stringify(userData));
    localStorage.setItem('is_authenticated', 'true');

    // Submit to Formspree for lead capture (signup only)
    if (mode === 'signup') {
      try {
        await fetch('https://formspree.io/f/maqbwgbq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name,
            company,
            source: 'Deal Calculator Sign Up',
            timestamp: new Date().toISOString(),
          }),
        });
      } catch {
        // Continue even if Formspree fails
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    onSuccess(email, mode === 'signup' ? name : email.split('@')[0]);
  };

  const handleForgotPassword = async () => {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    if (useSupabaseAuth && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }
    }

    // Always show success (don't reveal if email exists)
    setSuccess(`If an account exists for ${email}, you will receive a password reset link shortly.`);
    setIsLoading(false);
  };

  const handleResendVerification = async () => {
    if (!supabase) return;

    setIsLoading(true);
    setError('');

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      setError('Failed to resend verification email. Please try again.');
    } else {
      setSuccess('Verification email sent! Please check your inbox.');
    }

    setIsLoading(false);
  };

  const renderForm = () => {
    if (mode === 'verify-email') {
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

    if (mode === 'forgot-password') {
      return (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@company.com"
              className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400
                       focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400
                       focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Work Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@company.com"
            className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400
                     focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
              className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400
                       focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
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
        </div>

        {mode === 'signup' && (
          <>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-2">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400
                         focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              />
            </div>

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
          </>
        )}

        {mode === 'signin' && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => { setMode('forgot-password'); setError(''); setSuccess(''); }}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors"
            >
              Forgot password?
            </button>
          </div>
        )}
      </div>
    );
  };

  const getHeaderContent = () => {
    switch (mode) {
      case 'signup':
        return {
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />,
          title: 'Create Account',
          subtitle: 'Get access to deal benchmarks'
        };
      case 'signin':
        return {
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />,
          title: 'Welcome Back',
          subtitle: 'Sign in to your account'
        };
      case 'forgot-password':
        return {
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />,
          title: 'Reset Password',
          subtitle: 'Enter your email to receive a reset link'
        };
      case 'verify-email':
        return {
          icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
          title: 'Verify Email',
          subtitle: 'Check your inbox for the verification link'
        };
    }
  };

  const getButtonText = () => {
    if (isLoading) return 'Processing...';
    switch (mode) {
      case 'signup': return 'Create Account';
      case 'signin': return 'Sign In';
      case 'forgot-password': return 'Send Reset Link';
      default: return 'Continue';
    }
  };

  const header = getHeaderContent();

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 px-8 py-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
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
              <h3 className="text-2xl font-bold text-white">{header.title}</h3>
              <p className="text-neutral-400 text-sm mt-1">{header.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          )}

          {renderForm()}

          {mode !== 'verify-email' && (
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-8 bg-gradient-to-r from-teal-600 to-cyan-500 text-white font-semibold py-4 px-6 rounded-xl
                       shadow-lg shadow-teal-500/25 hover:shadow-xl hover:shadow-teal-500/30
                       hover:from-teal-500 hover:to-cyan-400 transition-all duration-300
                       disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
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

          <div className="mt-6 text-center">
            {mode === 'signup' && (
              <p className="text-neutral-600 text-sm">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}
                  className="text-teal-600 font-semibold hover:text-teal-700 transition-colors"
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
                  onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                  className="text-teal-600 font-semibold hover:text-teal-700 transition-colors"
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
                  onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}
                  className="text-teal-600 font-semibold hover:text-teal-700 transition-colors"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>

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
