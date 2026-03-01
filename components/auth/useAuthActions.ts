'use client';

import { useState, useCallback } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'verify-email';

interface UseAuthActionsParams {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  company: string;
  acceptTerms: boolean;
  magicLinkMode: boolean;
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  onSuccess: (email: string, name: string) => void;
}

export interface AuthActionsState {
  isLoading: boolean;
  error: string;
  success: string;
  setError: (v: string) => void;
  setSuccess: (v: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleGoogleSignIn: () => Promise<void>;
  handleLinkedInSignIn: () => Promise<void>;
  handleResendVerification: () => Promise<void>;
  clearMessages: () => void;
}

export function useAuthActions(params: UseAuthActionsParams): AuthActionsState {
  const { email, password, confirmPassword, name, company, acceptTerms, magicLinkMode, mode, setMode, onSuccess } = params;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const supabase = createClient();
  const useSupabaseAuth = isSupabaseConfigured() && supabase;

  const clearMessages = useCallback(() => {
    setError('');
    setSuccess('');
  }, []);

  const validateEmail = (emailStr: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  };

  const handleSupabaseSignUp = async () => {
    if (!supabase) return;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, company },
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
      setMode('verify-email');
      setSuccess(`We've sent a verification email to ${email}. Please check your inbox and click the link to verify your account.`);

      // Create user profile
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

      // Submit to Formspree for lead capture (10s timeout, non-blocking)
      try {
        const fsController = new AbortController();
        setTimeout(() => fsController.abort(), 10000);
        await fetch('https://formspree.io/f/maqbwgbq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email, name, company,
            source: 'Deal Calculator Sign Up',
            timestamp: new Date().toISOString(),
          }),
          signal: fsController.signal,
        });
      } catch {
        // Continue even if Formspree fails
      }
      return;
    }

    // If email confirmation not required, complete signup
    onSuccess(email, name);
  };

  const handleSupabaseSignIn = async () => {
    if (!supabase) return;

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
  };

  const handleLocalAuth = async () => {
    const userData = {
      email,
      name: mode === 'signup' ? name : email.split('@')[0],
      company,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem('user_data', JSON.stringify(userData));
    localStorage.setItem('is_authenticated', 'true');

    // Submit to Formspree for lead capture (signup only, 10s timeout)
    if (mode === 'signup') {
      try {
        const fsController = new AbortController();
        setTimeout(() => fsController.abort(), 10000);
        await fetch('https://formspree.io/f/maqbwgbq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email, name, company,
            source: 'Deal Calculator Sign Up',
            timestamp: new Date().toISOString(),
          }),
          signal: fsController.signal,
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

  const handleMagicLink = async () => {
    if (!supabase) return;

    if (!email || !validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError('Failed to send magic link. Please try again.');
    } else {
      setSuccess(`We've sent a login link to ${email}. Check your inbox!`);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (!email || !validateEmail(email)) {
        setError('Please enter a valid email address');
        setIsLoading(false);
        return;
      }

      if (mode === 'forgot-password') {
        await handleForgotPassword();
        return;
      }

      if (mode === 'signin' && magicLinkMode) {
        await handleMagicLink();
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
        if (mode === 'signup') {
          await handleSupabaseSignUp();
        } else {
          await handleSupabaseSignIn();
        }
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

  const handleGoogleSignIn = async () => {
    if (!supabase) return;

    setIsLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError('Failed to sign in with Google. Please try again.');
      setIsLoading(false);
    }
  };

  const handleLinkedInSignIn = async () => {
    if (!supabase) return;

    setIsLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError('Failed to sign in with LinkedIn. Please try again.');
      setIsLoading(false);
    }
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

  return {
    isLoading,
    error,
    success,
    setError,
    setSuccess,
    handleSubmit,
    handleGoogleSignIn,
    handleLinkedInSignIn,
    handleResendVerification,
    clearMessages,
  };
}
