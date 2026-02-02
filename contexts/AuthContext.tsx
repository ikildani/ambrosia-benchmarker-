'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Pro user emails that get auto-upgraded
const PRO_EMAILS = ['ikildani@ambrosiaventures.co'];

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
    // Check for Stripe success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setTierState('pro');
      localStorage.setItem('user_tier', 'pro');
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Load saved tier
    const savedTier = localStorage.getItem('user_tier');
    if (savedTier === 'pro') {
      setTierState('pro');
    }

    // Load auth state
    const authState = localStorage.getItem('is_authenticated');
    const userData = localStorage.getItem('user_data');

    if (authState === 'true' && userData) {
      try {
        const parsed = JSON.parse(userData);
        setIsAuthenticated(true);
        setUser({
          email: parsed.email || '',
          name: parsed.name || '',
          company: parsed.company,
          title: parsed.title,
          phone: parsed.phone,
          linkedIn: parsed.linkedIn,
          role: parsed.role,
          createdAt: parsed.createdAt,
        });

        // Auto-upgrade pro users by email
        const userEmailLower = (parsed.email || '').toLowerCase().trim();
        if (PRO_EMAILS.some(e => e.toLowerCase() === userEmailLower)) {
          setTierState('pro');
          localStorage.setItem('user_tier', 'pro');
        }
      } catch {
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
      try {
        profileData = JSON.parse(cachedProfile);
      } catch {
        // Invalid cached data, ignore
      }
    }

    const newUser: User = {
      email,
      name,
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

    // Auto-upgrade pro users by email
    const userEmailLower = email.toLowerCase().trim();
    if (PRO_EMAILS.some(e => e.toLowerCase() === userEmailLower)) {
      setTierState('pro');
      localStorage.setItem('user_tier', 'pro');
    }
  }, []);

  const signOut = useCallback(() => {
    // Cache profile data before signing out (so it persists for next sign-in)
    if (user?.email) {
      const emailKey = `profile_cache_${user.email.toLowerCase().trim()}`;
      const profileToCache = {
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
