'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { isProEmailClient } from '@/lib/config/authorized-emails.client';

interface User {
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

// Safe JSON parse with validation
function safeParseUserData(jsonString: string): User | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (isValidUserData(parsed)) {
      return parsed;
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
  tier: 'free' | 'pro';

  // Auth actions
  signIn: (email: string, name: string, userData?: Partial<User>) => void;
  signOut: () => void;
  updateUser: (data: Partial<User>) => void;

  // Tier actions
  setTier: (tier: 'free' | 'pro') => void;

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
  const [tier, setTierState] = useState<'free' | 'pro'>('free');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signup');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from localStorage on mount
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
    if (savedTier === 'pro') {
      setTierState('pro'); // UI hint only - server will verify
    }

    // Load auth state
    const authState = localStorage.getItem('is_authenticated');
    const userData = localStorage.getItem('user_data');

    if (authState === 'true' && userData) {
      const parsed = safeParseUserData(userData);
      if (parsed) {
        setIsAuthenticated(true);
        setUser(parsed);

        // Auto-upgrade pro users by email (UI hint only - server verifies)
        if (isProEmailClient(parsed.email)) {
          setTierState('pro');
          localStorage.setItem('user_tier', 'pro');
        }
      } else {
        // Invalid stored data, clear it
        localStorage.removeItem('is_authenticated');
        localStorage.removeItem('user_data');
      }
    }

    setIsLoading(false);
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

    // Auto-upgrade pro users by email (UI hint only - server verifies)
    if (isProEmailClient(email)) {
      setTierState('pro');
      localStorage.setItem('user_tier', 'pro');
    }
  }, []);

  const signOut = useCallback(() => {
    // Cache profile data before signing out (so it persists for next sign-in)
    if (user?.email) {
      const emailKey = `profile_cache_${user.email.toLowerCase().trim()}`;
      const profileToCache = {
        name: user.name,
        company: user.company,
        title: user.title,
        phone: user.phone,
        linkedIn: user.linkedIn,
        role: user.role,
      };
      localStorage.setItem(emailKey, JSON.stringify(profileToCache));
    }

    setIsAuthenticated(false);
    setUser(null);
    setTierState('free');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('user_data');
    localStorage.removeItem('user_tier');
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

  const setTier = useCallback((newTier: 'free' | 'pro') => {
    setTierState(newTier);
    if (newTier === 'pro') {
      localStorage.setItem('user_tier', 'pro');
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
