'use client';

import { useState } from 'react';
import { Key, ArrowLeft, Loader2, AlertCircle, Building2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function SSOLoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your work email address.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/portfolio/sso/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error_code === 'SSO_NOT_ENABLED') {
          setError('SSO is not yet enabled for this platform. Please contact support@ambrosiaventures.co to enable SSO.');
        } else if (res.status === 404) {
          setError('No SSO configuration found for this email domain. Please check with your team administrator or use regular sign-in.');
        } else if (res.status === 422) {
          setError(data.error || 'SSO is partially configured. Please contact your team administrator.');
        } else {
          setError(data.error || 'An error occurred. Please try again.');
        }
        return;
      }

      if (data.url) {
        // Redirect to the IdP login page
        window.location.href = data.url;
      } else {
        setError('Failed to get SSO login URL. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo-white.png"
              alt="Ambrosia Ventures"
              width={160}
              height={34}
              className="h-8 w-auto"
            />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 mb-4">
            <Key className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">Enterprise SSO</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Sign in with SSO</h1>
          <p className="text-sm text-slate-400 mt-2">
            Use your organization&apos;s identity provider to sign in
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="sso-email"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Work Email
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Building2 className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  id="sso-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="you@company.com"
                  autoComplete="email"
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Enter the email associated with your SSO-enabled organization
              </p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-teal-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting to your identity provider...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Sign in with SSO
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-3 text-slate-500 uppercase tracking-wider">or</span>
            </div>
          </div>

          {/* Back to regular sign-in */}
          <Link
            href="/?auth=signin"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-slate-700 text-slate-300 font-medium rounded-xl hover:bg-slate-800 hover:text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Sign in with email or password
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-slate-600">
            SSO is available on the{' '}
            <span className="text-teal-500 font-medium">Enterprise</span>{' '}
            portfolio tier
          </p>
          <p className="text-xs text-slate-600">
            Ambrosia Ventures |{' '}
            <a
              href="https://ambrosiaventures.co"
              className="text-teal-500 hover:text-teal-400 transition-colors"
            >
              ambrosiaventures.co
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
