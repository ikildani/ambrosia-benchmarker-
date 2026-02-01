'use client';

import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useSession } from '@/lib/hooks/useSession';
import { useEventTracker } from '@/lib/hooks/useEventTracker';
import { useAuth } from '@/lib/hooks/useAuth';

interface TrackingContextType {
  // Session
  sessionId: string;
  anonymousId: string;
  isSessionInitialized: boolean;

  // Auth
  user: ReturnType<typeof useAuth>['user'];
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  signUp: ReturnType<typeof useAuth>['signUp'];
  signIn: ReturnType<typeof useAuth>['signIn'];
  signOut: ReturnType<typeof useAuth>['signOut'];

  // Tracking
  track: ReturnType<typeof useEventTracker>['track'];
  trackCalculation: ReturnType<typeof useEventTracker>['trackCalculation'];
  trackParameterChange: ReturnType<typeof useEventTracker>['trackParameterChange'];
  trackPaywallHit: ReturnType<typeof useEventTracker>['trackPaywallHit'];
  trackPaywallDismissed: ReturnType<typeof useEventTracker>['trackPaywallDismissed'];
  trackProFeatureClick: ReturnType<typeof useEventTracker>['trackProFeatureClick'];
  trackUpgradeCtaClick: ReturnType<typeof useEventTracker>['trackUpgradeCtaClick'];
  trackExportAttempted: ReturnType<typeof useEventTracker>['trackExportAttempted'];
}

const TrackingContext = createContext<TrackingContextType | null>(null);

export function TrackingProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const tracker = useEventTracker();
  const auth = useAuth();

  // When user authenticates, update session with user_id
  useEffect(() => {
    if (auth.user && session.sessionId) {
      // Update session to link with authenticated user
      fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.sessionId,
          user_id: auth.user.id,
        }),
      }).catch(console.error);
    }
  }, [auth.user, session.sessionId]);

  const value: TrackingContextType = {
    // Session
    sessionId: session.sessionId,
    anonymousId: session.anonymousId,
    isSessionInitialized: session.isInitialized,

    // Auth
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isAuthLoading: auth.isLoading,
    signUp: auth.signUp,
    signIn: auth.signIn,
    signOut: auth.signOut,

    // Tracking
    track: tracker.track,
    trackCalculation: tracker.trackCalculation,
    trackParameterChange: tracker.trackParameterChange,
    trackPaywallHit: tracker.trackPaywallHit,
    trackPaywallDismissed: tracker.trackPaywallDismissed,
    trackProFeatureClick: tracker.trackProFeatureClick,
    trackUpgradeCtaClick: tracker.trackUpgradeCtaClick,
    trackExportAttempted: tracker.trackExportAttempted,
  };

  return (
    <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>
  );
}

export function useTracking() {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
}
