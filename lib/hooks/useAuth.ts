'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

const ANONYMOUS_ID_KEY = 'ambrosia_anonymous_id';

// Mutex to prevent race conditions during auth state changes
let isProcessingAuthChange = false;

interface SignUpData {
  email: string;
  password: string;
  name?: string;
  company?: string;
  jobTitle?: string;
  jobFunction?: string;
  companyType?: string;
}

interface SignInData {
  email: string;
  password: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const supabaseEnabled = isSupabaseConfigured();

  // Initialize auth state
  useEffect(() => {
    // Skip if Supabase is not configured
    if (!supabaseEnabled || !supabase) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);

        // On sign in, ensure profile exists then link anonymous data
        // Use mutex to prevent race conditions from rapid auth events
        if (event === 'SIGNED_IN' && session?.user && !isProcessingAuthChange) {
          isProcessingAuthChange = true;
          try {
            await ensureUserProfile(session.user);
            await linkAnonymousData(session.user.id);
          } catch (err) {
            console.error('[Auth] Post-signin setup failed:', err);
          } finally {
            isProcessingAuthChange = false;
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabaseEnabled]);

  const ensureUserProfile = async (user: User) => {
    if (!supabase) return;

    // Create user profile if it doesn't exist (for OAuth users)
    const { error } = await supabase.from('user_profiles').upsert({
      id: user.id,
      email: user.email,
      company_name: user.user_metadata?.company || null,
      tier: 'free',
      email_verified: true,
    }, { onConflict: 'id', ignoreDuplicates: true });

    if (error) {
      console.error('Profile upsert error:', error);
    }
  };

  const linkAnonymousData = async (userId: string) => {
    const anonymousId = localStorage.getItem(ANONYMOUS_ID_KEY);
    if (!anonymousId) return;

    try {
      const response = await fetch('/api/auth/link-anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          anonymous_id: anonymousId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Link anonymous failed:', response.status, errorData);
        return; // Don't throw - this is non-critical
      }

      const data = await response.json();
      if (data.success) {
        console.log('[Auth] Linked anonymous data:', data.linked);
      }
    } catch (err) {
      console.error('Failed to link anonymous data:', err);
    }
  };

  const signUp = useCallback(
    async (data: SignUpData): Promise<{ success: boolean; error?: string }> => {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }

      setError(null);
      setIsLoading(true);

      try {
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              name: data.name,
              company: data.company,
            },
          },
        });

        if (authError) {
          setError(authError.message);
          return { success: false, error: authError.message };
        }

        if (!authData.user) {
          setError('Failed to create account');
          return { success: false, error: 'Failed to create account' };
        }

        // Create user profile
        const { error: profileError } = await supabase.from('user_profiles').insert({
          id: authData.user.id,
          email: data.email,
          company_name: data.company || null,
          job_title: data.jobTitle || null,
          job_function: data.jobFunction || null,
          company_type: data.companyType || null,
          tier: 'free',
          attribution_source: new URLSearchParams(window.location.search).get('utm_source') || null,
          attribution_campaign: new URLSearchParams(window.location.search).get('utm_campaign') || null,
        });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          // Don't fail signup if profile creation fails - profile can be created later
        }

        // Link anonymous data
        await linkAnonymousData(authData.user.id);

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const signIn = useCallback(
    async (data: SignInData): Promise<{ success: boolean; error?: string }> => {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }

      setError(null);
      setIsLoading(true);

      try {
        const { data: authData, error: authError } =
          await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          });

        if (authError) {
          setError(authError.message);
          return { success: false, error: authError.message };
        }

        if (!authData.user) {
          setError('Failed to sign in');
          return { success: false, error: 'Failed to sign in' };
        }

        // Link any anonymous data from this session
        await linkAnonymousData(authData.user.id);

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    if (!supabase) return;

    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const updateProfile = useCallback(
    async (updates: {
      company_name?: string;
      job_title?: string;
      job_function?: string;
      company_type?: string;
      consent_marketing?: boolean;
    }): Promise<{ success: boolean; error?: string }> => {
      if (!supabase) {
        return { success: false, error: 'Supabase not configured' };
      }
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const { error } = await supabase
          .from('user_profiles')
          .update(updates)
          .eq('id', user.id);

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        return { success: false, error: message };
      }
    },
    [user, supabase]
  );

  const getUserProfile = useCallback(async () => {
    if (!supabase || !user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Get profile error:', error);
      return null;
    }

    return data;
  }, [user, supabase]);

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    updateProfile,
    getUserProfile,
  };
}
