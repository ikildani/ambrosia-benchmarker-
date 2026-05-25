'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function TrialBanner() {
  const { user, tier } = useAuth();
  const router = useRouter();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;

    supabase
      .from('user_profiles')
      .select('pro_engagement_type, pro_expires_at')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data?.pro_engagement_type?.startsWith('auto-trial') || !data.pro_expires_at) return;
        const expires = new Date(data.pro_expires_at);
        const now = new Date();
        const days = Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        setDaysLeft(days);
      });
  }, [user?.id]);

  if (daysLeft === null || dismissed) return null;
  if (tier !== 'pro') return null;

  const urgent = daysLeft <= 2;

  return (
    <div className={`fixed top-16 left-0 right-0 z-40 ${urgent ? 'bg-amber-600' : 'bg-teal-600'} text-white text-center py-2 px-4 text-sm font-medium`}>
      <span>
        {daysLeft === 0
          ? 'Your Pro trial ends today.'
          : `Pro trial: ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining.`}
        {' '}
        <button
          onClick={() => router.push('/pro?plan=annual')}
          className="underline font-semibold hover:text-white/90"
        >
          Keep Pro access — $199/mo annual
        </button>
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}
