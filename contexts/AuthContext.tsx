'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { toast } from 'sonner';
import { isProEmailClient } from '@/lib/config/authorized-emails.client';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { syncUsageFromDatabase } from '@/lib/usage';
import { captureClientError } from '@/lib/sentry-client';
import type { UserTier, TeamContext, TeamRole, PortfolioSubTier } from '@/types/tier';
import { DEFAULT_TEAM_CONTEXT } from '@/types/tier';

interface User {
  id: string;  // Unique user identifier (UUID)
  email: string;
  name: string;
  company?: string;
  title?: string;
  phone?: string;
  linkedIn?: string;
  role?: string;
  createdAt?: string;
}

// Type guard to validate user data from localStorage
function isValidUserData(data: unknown): data is User {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.name === 'string' &&
    (obj.company === undefined || typeof obj.company === 'string') &&
    (obj.title === undefined || typeof obj.title === 'string') &&
    (obj.phone === undefined || typeof obj.phone === 'string') &&
    (obj.linkedIn === undefined || typeof obj.linkedIn === 'string') &&
    (obj.role === undefined || typeof obj.role === 'string') &&
    (obj.createdAt === undefined || typeof obj.createdAt === 'string')
  );
}

// Migration: add id to legacy user data
function migrateUserData(data: Record<string, unknown>): User | null {
  // If data has email and name but no id, generate one
  if (typeof data.email === 'string' && typeof data.name === 'string' && !data.id) {
    return {
      id: crypto.randomUUID(),
      email: data.email,
      name: data.name,
      company: typeof data.company === 'string' ? data.company : undefined,
      title: typeof data.title === 'string' ? data.title : undefined,
      phone: typeof data.phone === 'string' ? data.phone : undefined,
      linkedIn: typeof data.linkedIn === 'string' ? data.linkedIn : undefined,
      role: typeof data.role === 'string' ? data.role : undefined,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
    };
  }
  return null;
}

// Safe JSON parse with validation and migration
function safeParseUserData(jsonString: string): User | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (isValidUserData(parsed)) {
      return parsed;
    }
    // Try to migrate legacy data without id
    if (typeof parsed === 'object' && parsed !== null) {
      const migrated = migrateUserData(parsed as Record<string, unknown>);
      if (migrated) {
        // Save migrated data back to localStorage
        localStorage.setItem('user_data', JSON.stringify(migrated));
        return migrated;
      }
    }
    console.warn('Invalid user data structure in localStorage');
    return null;
  } catch {
    console.warn('Failed to parse user data from localStorage');
    return null;
  }
}

interface AuthContextType {
  // Auth state
  isAuthenticated: boolean;
  user: User | null;
  tier: UserTier;

  // Team/Portfolio state
  teamId: string | null;
  teamRole: TeamRole | null;
  teamName: string | null;
  teamSlug: string | null;
  portfolioSubTier: PortfolioSubTier | null;
  isPortfolioAdmin: boolean;

  // Auth actions
  signIn: (email: string, name: string, userData?: Partial<User>) => void;
  signOut: () => void;
  updateUser: (data: Partial<User>) => void;

  // Tier actions
  setTier: (tier: UserTier) => void;

  // Modal state
  showAuthModal: boolean;
  authModalMode: 'signin' | 'signup';
  openAuthModal: (mode: 'signin' | 'signup') => void;
  closeAuthModal: () => void;

  // Loading state
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [tier, setTierState] = useState<UserTier>('free');
  const [teamContext, setTeamContext] = useState<TeamContext>(DEFAULT_TEAM_CONTEXT);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signup');
  const [isLoading, setIsLoading] = useState(true);
  const previousTierRef = useRef<UserTier>('free');

  // Show "Welcome to Pro" toast ONLY on actual Stripe upgrades (not PRO_EMAILS auto-detection)
  // Stripe checkout redirects with ?upgraded=stripe in the URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('upgraded') === 'stripe' && !sessionStorage.getItem('pro_welcome_shown')) {
        sessionStorage.setItem('pro_welcome_shown', 'true');
        toast.success('Welcome to Pro! All features are now unlocked.');
        // Clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete('upgraded');
        window.history.replaceState({}, '', url.toString());
      }
    }
    previousTierRef.current = tier;
  }, [tier]);

  // Initialize from localStorage and listen to Supabase auth state
  useEffect(() => {
    // SECURITY: Removed URL parameter tier upgrade (?success=true)
    // Tier upgrades should ONLY happen via verified Stripe webhook
    // The webhook updates the database, and we verify tier server-side

    // Clean up any success parameter from URL (user may have bookmarked it)
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
      // Note: Tier will be verified from database on next API call
    }

    // SECURITY: localStorage tier is for UI display only, not authorization
    // All Pro features must be verified server-side against the database
    const savedTier = localStorage.getItem('user_tier');
    if (savedTier === 'pro' || savedTier === 'report' || savedTier === 'portfolio') {
      setTierState(savedTier as UserTier); // UI hint only - server will verify
    }

    // Load auth state from localStorage first
    const authState = localStorage.getItem('is_authenticated');
    const userData = localStorage.getItem('user_data');

    if (authState === 'true' && userData) {
      const parsed = safeParseUserData(userData);
      if (parsed) {
        setIsAuthenticated(true);
        setUser(parsed);

        // Email allowlist: temporary UI hint only — DB query overrides this async
        // Do NOT write to localStorage here; the DB query is authoritative
        const cached = localStorage.getItem('user_tier');
        if (!cached && isProEmailClient(parsed.email)) {
          setTierState('pro');
        }
      } else {
        // Invalid stored data, clear it
        localStorage.removeItem('is_authenticated');
        localStorage.removeItem('user_data');
      }
    }

    // Listen to Supabase auth state changes (for OAuth, etc.)
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        // Check current session with a timeout to prevent infinite loading
        const sessionTimeout = setTimeout(() => {
          console.warn('[Auth] getSession timed out after 5s, proceeding with localStorage auth');
          setIsLoading(false);
        }, 5000);

        // Async IIFE so we can AWAIT the tier DB query before dropping isLoading.
        // Without the await, isLoading flips false while tier is still 'free' (initial),
        // and the calculator page briefly renders the "Upgrade to Pro" banner for pro users
        // who just signed in (their localStorage user_tier hint was cleared on sign-out).
        (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            clearTimeout(sessionTimeout);

            if (session?.user) {
              const supabaseUser = session.user;
              const userName = supabaseUser.user_metadata?.name ||
                             supabaseUser.user_metadata?.full_name ||
                             supabaseUser.email?.split('@')[0] ||
                             'User';

              // Sync Supabase session to our auth context
              const newUser: User = {
                id: supabaseUser.id,
                email: supabaseUser.email || '',
                name: userName,
                company: supabaseUser.user_metadata?.company,
                createdAt: supabaseUser.created_at,
              };

              setIsAuthenticated(true);
              setUser(newUser);
              localStorage.setItem('is_authenticated', 'true');
              localStorage.setItem('user_data', JSON.stringify(newUser));

              // Check tier: database first (authoritative), then email allowlist fallback
              try {
                const { data: profile, error: tierError } = await supabase
                  .from('user_profiles')
                  .select('tier, team_id')
                  .eq('id', supabaseUser.id)
                  .single();
                if (!tierError && (profile?.tier === 'pro' || profile?.tier === 'report' || profile?.tier === 'portfolio')) {
                  setTierState(profile.tier as UserTier);
                  localStorage.setItem('user_tier', profile.tier);

                  if (profile.tier === 'portfolio' && profile.team_id) {
                    await fetchTeamContext(supabase, supabaseUser.id, profile.team_id);
                  }
                } else if (supabaseUser.email && isProEmailClient(supabaseUser.email)) {
                  setTierState('pro');
                  localStorage.setItem('user_tier', 'pro');
                }
              } catch {
                // Fallback to email allowlist if DB query fails
                if (supabaseUser.email && isProEmailClient(supabaseUser.email)) {
                  setTierState('pro');
                  localStorage.setItem('user_tier', 'pro');
                }
                console.warn('[Auth] Tier query failed');
              }

              // Sync usage count from database (fire-and-forget — not gating UI)
              syncUsageFromDatabase(supabaseUser.id).catch(console.error);
            }
          } catch (error) {
            clearTimeout(sessionTimeout);
            captureClientError(error, 'AuthContext', { context: 'Supabase getSession failed' });
          } finally {
            setIsLoading(false);
          }
        })();

        // Listen for auth state changes (sign in, sign out, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          console.log('[Auth] State change:', event);

          if (event === 'SIGNED_IN' && session?.user) {
            const supabaseUser = session.user;
            const userName = supabaseUser.user_metadata?.name ||
                           supabaseUser.user_metadata?.full_name ||
                           supabaseUser.email?.split('@')[0] ||
                           'User';

            const newUser: User = {
              id: supabaseUser.id,
              email: supabaseUser.email || '',
              name: userName,
              company: supabaseUser.user_metadata?.company,
              createdAt: supabaseUser.created_at,
            };

            setIsAuthenticated(true);
            setUser(newUser);
            localStorage.setItem('is_authenticated', 'true');
            localStorage.setItem('user_data', JSON.stringify(newUser));

            // Determine tier BEFORE dismissing the auth modal so there's no flicker
            // where a pro user sees the "Upgrade to Pro" upsell during the gap between
            // sign-in completing and the tier DB query resolving.
            (async () => {
              try {
                try {
                  const { data: profile, error: tierError } = await supabase
                    .from('user_profiles')
                    .select('tier, team_id')
                    .eq('id', supabaseUser.id)
                    .single();
                  if (!tierError && (profile?.tier === 'pro' || profile?.tier === 'report' || profile?.tier === 'portfolio')) {
                    setTierState(profile.tier as UserTier);
                    localStorage.setItem('user_tier', profile.tier);

                    if (profile.tier === 'portfolio' && profile.team_id) {
                      await fetchTeamContext(supabase, supabaseUser.id, profile.team_id);
                    }
                  } else if (supabaseUser.email && isProEmailClient(supabaseUser.email)) {
                    setTierState('pro');
                    localStorage.setItem('user_tier', 'pro');
                  }
                } catch {
                  if (supabaseUser.email && isProEmailClient(supabaseUser.email)) {
                    setTierState('pro');
                    localStorage.setItem('user_tier', 'pro');
                  }
                  console.warn('[Auth] Tier query failed on sign-in');
                }
              } finally {
                setShowAuthModal(false);
              }
            })();

            // Sync usage count from database (so it persists across devices)
            syncUsageFromDatabase(supabaseUser.id).catch(console.error);

            // Create user profile if it doesn't exist (for OAuth users)
            // Using ignoreDuplicates to avoid overwriting existing profiles (especially tier)
            supabase.from('user_profiles').upsert({
              id: supabaseUser.id,
              email: supabaseUser.email,
              company_name: supabaseUser.user_metadata?.company || null,
              tier: 'free',
              email_verified: true,
            }, { onConflict: 'id', ignoreDuplicates: true }).then(({ error }) => {
              if (error) captureClientError(error, 'AuthContext', { context: 'Profile upsert failed on sign-in' });
            });
          }

          if (event === 'SIGNED_OUT') {
            setIsAuthenticated(false);
            setUser(null);
            setTierState('free');
            setTeamContext(DEFAULT_TEAM_CONTEXT);
            localStorage.removeItem('is_authenticated');
            localStorage.removeItem('user_data');
            localStorage.removeItem('user_tier');
          }
        });

        // Re-check tier from database when user returns to the tab
        // Handles: user pays in Stripe tab, comes back — tier should update without sign-out
        const handleVisibilityChange = () => {
          if (document.visibilityState !== 'visible') return;
          supabase.auth.getSession().then(({ data: { session: freshSession } }) => {
            if (!freshSession?.user) return;
            const uid = freshSession.user.id;
            supabase.from('user_profiles')
              .select('tier, team_id')
              .eq('id', uid)
              .single()
              .then(({ data: profile, error: tierErr }) => {
                if (!tierErr && profile?.tier && profile.tier !== 'free') {
                  setTierState(profile.tier as UserTier);
                  localStorage.setItem('user_tier', profile.tier);
                  if (profile.tier === 'portfolio' && profile.team_id) {
                    fetchTeamContext(supabase, uid, profile.team_id);
                  }
                }
              });
          });
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
          subscription.unsubscribe();
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
      }
    }

    setIsLoading(false);
  }, []);

  const fetchTeamContext = useCallback(async (supabase: ReturnType<typeof createClient>, userId: string, teamId: string) => {
    try {
      const [teamResult, memberResult] = await Promise.all([
        supabase!.from('teams').select('name, slug, portfolio_tier, max_seats').eq('id', teamId).single(),
        supabase!.from('team_members').select('role').eq('team_id', teamId).eq('user_id', userId).eq('status', 'active').single(),
      ]);

      if (teamResult.data && memberResult.data) {
        const role = memberResult.data.role as TeamRole;
        setTeamContext({
          teamId,
          teamRole: role,
          teamName: teamResult.data.name,
          teamSlug: teamResult.data.slug,
          portfolioSubTier: teamResult.data.portfolio_tier as PortfolioSubTier,
          isPortfolioAdmin: role === 'admin',
          maxSeats: teamResult.data.max_seats,
        });
      }
    } catch {
      console.warn('[Auth] Failed to fetch team context');
    }
  }, []);

  const signIn = useCallback((email: string, name: string, userData?: Partial<User>) => {
    // Check for cached profile data for this email
    const emailKey = `profile_cache_${email.toLowerCase().trim()}`;
    const cachedProfile = localStorage.getItem(emailKey);
    let profileData: Partial<User> = {};

    if (cachedProfile) {
      const parsed = safeParseUserData(cachedProfile);
      if (parsed) {
        profileData = parsed;
      }
    }

    // Use cached name if the provided name is just the email prefix (sign-in mode)
    const displayName = profileData.name && name === email.split('@')[0]
      ? profileData.name
      : name;

    const newUser: User = {
      id: profileData.id || crypto.randomUUID(), // Use cached id or generate new one
      email,
      name: displayName,
      createdAt: new Date().toISOString(),
      ...profileData, // Restore cached profile data
      ...userData, // Override with any new data provided
    };

    setIsAuthenticated(true);
    setUser(newUser);
    setShowAuthModal(false);

    // Persist to localStorage
    localStorage.setItem('is_authenticated', 'true');
    localStorage.setItem('user_data', JSON.stringify(newUser));

    // Email allowlist: temporary UI hint — DB query overrides async
    if (isProEmailClient(email)) {
      setTierState('pro');
    }
  }, []);

  const signOut = useCallback(async () => {
    // Cache profile data before signing out (so it persists for next sign-in)
    if (user?.email) {
      const emailKey = `profile_cache_${user.email.toLowerCase().trim()}`;
      const profileToCache = {
        id: user.id,
        name: user.name,
        company: user.company,
        title: user.title,
        phone: user.phone,
        linkedIn: user.linkedIn,
        role: user.role,
      };
      localStorage.setItem(emailKey, JSON.stringify(profileToCache));
    }

    // Clear local state first (ensures UI updates even if Supabase fails)
    setIsAuthenticated(false);
    setUser(null);
    setTierState('free');
    setTeamContext(DEFAULT_TEAM_CONTEXT);
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('user_data');
    localStorage.removeItem('user_tier');
    sessionStorage.clear();

    // Sign out from Supabase — use scope: 'global' to invalidate all sessions
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      if (supabase) {
        try {
          const { error } = await supabase.auth.signOut({ scope: 'global' });
          if (error) {
            captureClientError(error, 'AuthContext', { context: 'Supabase signOut failed' });
            // Force-clear Supabase cookies manually if signOut fails
            document.cookie.split(';').forEach(c => {
              const name = c.trim().split('=')[0];
              if (name.startsWith('sb-') || name.includes('supabase')) {
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
              }
            });
          }
        } catch (err) {
          captureClientError(err, 'AuthContext', { context: 'Supabase signOut threw exception' });
        }
      }
    }
  }, [user]);

  const updateUser = useCallback((data: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...data };
      localStorage.setItem('user_data', JSON.stringify(updated));

      // Also update the profile cache for this email
      if (updated.email) {
        const emailKey = `profile_cache_${updated.email.toLowerCase().trim()}`;
        const profileToCache = {
          name: updated.name,
          company: updated.company,
          title: updated.title,
          phone: updated.phone,
          linkedIn: updated.linkedIn,
          role: updated.role,
        };
        localStorage.setItem(emailKey, JSON.stringify(profileToCache));
      }

      return updated;
    });
  }, []);

  const setTier = useCallback((newTier: UserTier) => {
    setTierState(newTier);
    if (newTier !== 'free') {
      localStorage.setItem('user_tier', newTier);
    } else {
      localStorage.removeItem('user_tier');
    }
  }, []);

  const openAuthModal = useCallback((mode: 'signin' | 'signup') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setShowAuthModal(false);
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    user,
    tier,
    teamId: teamContext.teamId,
    teamRole: teamContext.teamRole,
    teamName: teamContext.teamName,
    teamSlug: teamContext.teamSlug,
    portfolioSubTier: teamContext.portfolioSubTier,
    isPortfolioAdmin: teamContext.isPortfolioAdmin,
    signIn,
    signOut,
    updateUser,
    setTier,
    showAuthModal,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
