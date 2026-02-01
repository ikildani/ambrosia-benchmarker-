'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

const SESSION_KEY = 'ambrosia_session_id';
const ANONYMOUS_ID_KEY = 'ambrosia_anonymous_id';
const SESSION_START_KEY = 'ambrosia_session_start';
const LAST_ACTIVITY_KEY = 'ambrosia_last_activity';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getDeviceType(): 'desktop' | 'tablet' | 'mobile' {
  if (typeof window === 'undefined') return 'desktop';

  const ua = navigator.userAgent.toLowerCase();

  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet';
  }

  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }

  return 'desktop';
}

function getUTMParams(): Record<string, string | null> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
  };
}

export function useSession() {
  const [sessionId, setSessionId] = useState<string>('');
  const [anonymousId, setAnonymousId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const sessionStartRef = useRef<number>(0);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize session
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Get or create anonymous ID (persists across sessions)
    let anonId = localStorage.getItem(ANONYMOUS_ID_KEY);
    if (!anonId) {
      anonId = `anon_${generateUUID()}`;
      localStorage.setItem(ANONYMOUS_ID_KEY, anonId);
    }
    setAnonymousId(anonId);

    // Check for existing session
    const storedSessionId = sessionStorage.getItem(SESSION_KEY);
    const lastActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY);
    const sessionStart = sessionStorage.getItem(SESSION_START_KEY);

    const now = Date.now();
    const isExpired = lastActivity && now - parseInt(lastActivity, 10) > SESSION_TIMEOUT;

    if (storedSessionId && !isExpired && sessionStart) {
      // Resume existing session
      setSessionId(storedSessionId);
      sessionStartRef.current = parseInt(sessionStart, 10);
      updateLastActivity();
    } else {
      // Create new session
      createSession(anonId);
    }

    setIsInitialized(true);

    // Track session end on page unload
    const handleUnload = () => {
      if (!sessionId) return;

      const durationSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);

      // Use sendBeacon for reliable delivery on unload
      navigator.sendBeacon(
        '/api/sessions',
        JSON.stringify({
          session_id: sessionStorage.getItem(SESSION_KEY),
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
        })
      );

      // Also send session_ended event
      navigator.sendBeacon(
        '/api/events',
        JSON.stringify({
          event_type: 'session_ended',
          session_id: sessionStorage.getItem(SESSION_KEY),
          anonymous_id: anonId,
          event_data: {
            duration_seconds: durationSeconds,
          },
        })
      );
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, []);

  const createSession = async (anonId: string) => {
    const newSessionId = generateUUID();
    const now = Date.now();

    sessionStorage.setItem(SESSION_KEY, newSessionId);
    sessionStorage.setItem(SESSION_START_KEY, now.toString());
    sessionStorage.setItem(LAST_ACTIVITY_KEY, now.toString());

    setSessionId(newSessionId);
    sessionStartRef.current = now;

    // Create session in database
    try {
      const utmParams = getUTMParams();

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonymous_id: anonId,
          device_type: getDeviceType(),
          referrer_url: document.referrer || null,
          utm_source: utmParams.utm_source,
          utm_medium: utmParams.utm_medium,
          utm_campaign: utmParams.utm_campaign,
        }),
      });

      const data = await response.json();

      if (data.session_id) {
        // Update with server-generated session ID
        sessionStorage.setItem(SESSION_KEY, data.session_id);
        setSessionId(data.session_id);
      }

      // Track session_started event
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'session_started',
          session_id: data.session_id || newSessionId,
          anonymous_id: anonId,
          event_data: {
            referrer: document.referrer,
            ...utmParams,
          },
        }),
      });
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const updateLastActivity = useCallback(() => {
    if (typeof window === 'undefined') return;

    sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

    // Reset inactivity timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    activityTimeoutRef.current = setTimeout(() => {
      // Session expired due to inactivity - will create new session on next action
      sessionStorage.removeItem(SESSION_KEY);
    }, SESSION_TIMEOUT);
  }, []);

  // Track user activity
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleActivity = () => updateLastActivity();

    // Throttle activity tracking
    let lastTracked = 0;
    const throttledHandler = () => {
      const now = Date.now();
      if (now - lastTracked > 5000) {
        // Update every 5 seconds at most
        lastTracked = now;
        handleActivity();
      }
    };

    window.addEventListener('click', throttledHandler);
    window.addEventListener('scroll', throttledHandler);
    window.addEventListener('keypress', throttledHandler);

    return () => {
      window.removeEventListener('click', throttledHandler);
      window.removeEventListener('scroll', throttledHandler);
      window.removeEventListener('keypress', throttledHandler);
    };
  }, [updateLastActivity]);

  return {
    sessionId,
    anonymousId,
    isInitialized,
    updateLastActivity,
  };
}
