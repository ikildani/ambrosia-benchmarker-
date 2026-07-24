'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { CheckCircle2, AlertCircle, Loader2, LogIn, Key } from 'lucide-react';
import Link from 'next/link';

function JoinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [teamName, setTeamName] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No invite token provided. Please check your invite link.');
    }
  }, [token]);

  async function handleAccept() {
    if (!token) return;

    setStatus('loading');
    try {
      const res = await fetch('/api/portfolio/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.status === 401) {
        setNeedsAuth(true);
        setStatus('error');
        setErrorMessage('You must be signed in to accept this invite.');
        return;
      }

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error || 'Failed to accept invite.');
        return;
      }

      setTeamName(data.teamName || 'your team');
      setStatus('success');

      setTimeout(() => {
        router.push('/portfolio/admin');
      }, 2000);
    } catch {
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 mb-4">
            <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">Team Invite</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Join Your Team</h1>
          <p className="text-sm text-slate-400 mt-2">Accept the invite to get started with Solidus</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          {status === 'success' ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-teal-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Welcome to {teamName}!</h2>
              <p className="text-sm text-slate-400">Redirecting to your dashboard...</p>
            </div>
          ) : status === 'error' ? (
            <div className="text-center py-4">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">Unable to Join</h2>
              <p className="text-sm text-slate-400 mb-6">{errorMessage}</p>

              {needsAuth ? (
                <a
                  href={`/auth/sign-in?redirect=/portfolio/join?token=${token}`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Continue
                </a>
              ) : (
                <button
                  onClick={() => {
                    setStatus('idle');
                    setErrorMessage('');
                  }}
                  className="text-sm text-teal-400 hover:text-teal-300 font-medium"
                >
                  Try Again
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-500/30 flex items-center justify-center mx-auto mb-6">
                <LogIn className="w-7 h-7 text-teal-400" />
              </div>

              <p className="text-sm text-slate-400 mb-8">
                Click below to accept the invite and join your team.
              </p>

              <button
                onClick={handleAccept}
                disabled={status === 'loading' || !token}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-teal-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Accept Invite & Join Team'
                )}
              </button>
            </div>
          )}
        </div>

        {/* SSO Link */}
        <div className="text-center mt-4">
          <Link
            href="/portfolio/sso"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-400 transition-colors"
          >
            <Key className="w-3 h-3" />
            Sign in with SSO instead
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          Ambrosia Ventures | <a href="https://ambrosiaventures.co" className="text-teal-500 hover:text-teal-400">ambrosiaventures.co</a>
        </p>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        </div>
      }
    >
      <JoinPageContent />
    </Suspense>
  );
}
