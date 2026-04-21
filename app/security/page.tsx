import type { Metadata } from 'next';
import Link from 'next/link';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';

export const metadata: Metadata = {
  title: 'Security | Ambrosia Ventures',
  description: 'How Ambrosia Ventures protects your data. Infrastructure security, application security, data handling, compliance, and privacy practices for the Biopharma Deal Intelligence Platform.',
  openGraph: {
    title: 'Security — Ambrosia Ventures',
    description: 'Enterprise-grade security for biopharma deal intelligence. Encryption, access controls, data isolation, and compliance.',
  },
};

function Shield() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function Lock() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function Server() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

function Eye() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.22 6.22m3.658 3.658L3 3m18 18l-6.12-6.12" />
    </svg>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
          {icon}
        </div>
        <h2 className="text-lg sm:text-xl font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300 leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-2 flex-shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <header className="bg-slate-900/95 backdrop-blur-lg border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center">
              <AmbrosiaLogo variant="auto" height={40} />
            </Link>
            <Link href="/" className="text-sm text-slate-400 hover:text-teal-400 transition-colors">
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        {/* Hero */}
        <div className="mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-full px-4 py-1.5 mb-5">
            <Shield />
            <span className="text-sm font-medium text-teal-400">Security</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            How We Protect Your Data
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
            Ambrosia Ventures handles sensitive deal intelligence for biopharma companies. We treat every calculation input, valuation output, and partner search as confidential. Here is exactly how.
          </p>
        </div>

        {/* Principles bar */}
        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          {[
            ['Your data is yours', 'We never use your calculation inputs to train models, enrich our database, or share with other customers.'],
            ['Encrypted everywhere', 'All data is encrypted in transit (TLS 1.2+) and at rest. We never store payment card data.'],
            ['We never sell data', 'We do not sell, rent, or trade personal information or calculation data to any third party.'],
          ].map(([title, desc], i) => (
            <div key={i} className="bg-teal-500/5 border border-teal-500/15 rounded-xl p-5">
              <p className="text-sm font-semibold text-teal-300 mb-1.5">{title}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Sections */}
        <div className="space-y-6">

          <SectionCard icon={<Server />} title="Infrastructure Security">
            <BulletList items={[
              'Application hosted on Vercel (SOC 2 Type II compliant). Edge network with automatic DDoS protection and global CDN.',
              'Database hosted on Supabase (SOC 2 Type II compliant, ISO 27001). Data encrypted at rest with AES-256. Hosted in AWS US-West-2 with automated backups.',
              'All traffic encrypted via TLS 1.2+ (HSTS enforced with 2-year max-age). No unencrypted HTTP connections accepted.',
              'Payment processing through Stripe (PCI DSS Level 1 compliant). Card data never touches our servers.',
              'DNS and edge security via Cloudflare with automatic SSL certificate management.',
            ]} />
          </SectionCard>

          <SectionCard icon={<Lock />} title="Application Security">
            <BulletList items={[
              'Content Security Policy (CSP) headers restrict script execution, frame embedding, and form submissions to trusted origins only.',
              'CSRF protection on all mutating API endpoints (POST/PUT/DELETE/PATCH) with origin and referer validation.',
              'Route-specific rate limiting via Upstash Redis — calculation endpoints, authentication, and API routes each have independent limits to prevent abuse.',
              'Security headers enforced on every response: X-Frame-Options (SAMEORIGIN), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), Permissions-Policy.',
              'Stripe webhook signature verification with timing-safe comparison prevents forged payment events. Idempotency enforcement via unique constraint prevents duplicate processing.',
              'Cron endpoints protected with timing-safe Bearer token validation — not accessible via public URL.',
            ]} />
          </SectionCard>

          <SectionCard icon={<Shield />} title="Authentication & Access Control">
            <BulletList items={[
              'PKCE (Proof Key for Code Exchange) authentication flow via Supabase Auth — industry standard for secure OAuth/session management.',
              'Single-session enforcement: concurrent logins from multiple devices are blocked via session nonce validation. One active session per account.',
              'Server-side tier resolution: subscription tier (Free/Pro/Report) is validated server-side on every request. Client-side state cannot spoof access.',
              'Row-Level Security (RLS) on all database tables: users can only read and modify their own profiles, calculations, events, and sessions. Enforced at the database layer, not application layer.',
              'Service role access is restricted to server-side operations (webhooks, cron jobs, admin endpoints). No client-side code has service-level database access.',
              'Secure password reset tokens with single-use enforcement and time-based expiration.',
            ]} />
          </SectionCard>

          <SectionCard icon={<Eye />} title="Data Handling & Isolation">
            <div className="space-y-5">
              <BulletList items={[
                'Calculation inputs are stored only for your account history and are never shared with other customers, used to enrich our deal database, or fed into model training.',
                'Shared calculation links are access-controlled: each share link has a unique token, optional expiration, and view tracking. Recipients see a locked-down read-only view.',
                'Report purchases and PDF exports are tied to your account. Generated reports are not stored on public URLs or indexed by search engines.',
                'Account deletion removes all personal data within 30 days, including calculation history, profile data, and session records.',
              ]} />
              <div className="bg-slate-900/80 border border-slate-700/50 rounded-lg p-4">
                <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-2">What we do NOT store</p>
                <ul className="text-xs text-slate-400 space-y-1.5">
                  <li>- Payment card numbers, CVVs, or bank details (handled entirely by Stripe)</li>
                  <li>- Passwords in plaintext (hashed via Supabase Auth with bcrypt)</li>
                  <li>- IP addresses in calculation records (used only for rate limiting and fraud detection, not persisted with your data)</li>
                </ul>
              </div>
            </div>
          </SectionCard>

          {/* Compliance */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-5">Compliance & Privacy</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ['CCPA', 'California Consumer Privacy Act', 'California residents can request access, deletion, and opt-out. We do not sell personal information.'],
                ['GDPR', 'General Data Protection Regulation', 'EEA residents have rights to access, rectify, erase, restrict, port, and object. Legal basis: contract performance and legitimate interests.'],
                ['PCI DSS', 'Payment Card Industry', 'All payment processing handled by Stripe (PCI Level 1). Card data never enters our infrastructure.'],
                ['COPPA', 'Children\'s Privacy', 'Service is not intended for individuals under 18. We do not knowingly collect information from minors.'],
              ].map(([abbr, name, desc], i) => (
                <div key={i} className="bg-slate-900/60 border border-slate-700/40 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded">{abbr}</span>
                    <span className="text-xs text-slate-500">{name}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sub-processors */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">Sub-Processors</h2>
            <p className="text-sm text-slate-400 mb-5">Third-party services that process data on our behalf:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/60">
                    <th className="text-left py-2.5 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Provider</th>
                    <th className="text-left py-2.5 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Purpose</th>
                    <th className="text-left py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Data Processed</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  <tr className="border-b border-slate-800"><td className="py-2.5 pr-4 font-medium">Vercel</td><td className="py-2.5 pr-4 text-slate-400">Application hosting & CDN</td><td className="py-2.5 text-slate-400">Request logs, edge function execution</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2.5 pr-4 font-medium">Supabase</td><td className="py-2.5 pr-4 text-slate-400">Database & authentication</td><td className="py-2.5 text-slate-400">Account data, calculations, sessions</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2.5 pr-4 font-medium">Stripe</td><td className="py-2.5 pr-4 text-slate-400">Payment processing</td><td className="py-2.5 text-slate-400">Payment details, billing info</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2.5 pr-4 font-medium">SendGrid</td><td className="py-2.5 pr-4 text-slate-400">Transactional email</td><td className="py-2.5 text-slate-400">Email address, email content</td></tr>
                  <tr className="border-b border-slate-800"><td className="py-2.5 pr-4 font-medium">Sentry</td><td className="py-2.5 pr-4 text-slate-400">Error monitoring</td><td className="py-2.5 text-slate-400">Error traces (PII scrubbed)</td></tr>
                  <tr><td className="py-2.5 pr-4 font-medium">Upstash</td><td className="py-2.5 pr-4 text-slate-400">Rate limiting</td><td className="py-2.5 text-slate-400">Request counts (ephemeral)</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Responsible Disclosure */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-3">Responsible Disclosure</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              If you discover a security vulnerability, please report it to{' '}
              <a href="mailto:security@ambrosiaventures.co" className="text-teal-400 hover:text-teal-300 transition-colors">
                security@ambrosiaventures.co
              </a>. We take all reports seriously and will respond within 48 hours.
            </p>
            <p className="text-xs text-slate-500">
              Please do not publicly disclose vulnerabilities before we have had an opportunity to address them.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-4 pt-4">
            <Link href="/privacy" className="text-sm text-teal-400 hover:text-teal-300 transition-colors underline underline-offset-4">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-teal-400 hover:text-teal-300 transition-colors underline underline-offset-4">
              Terms & Conditions
            </Link>
            <Link href="/methodology" className="text-sm text-teal-400 hover:text-teal-300 transition-colors underline underline-offset-4">
              Methodology
            </Link>
            <a href="mailto:security@ambrosiaventures.co" className="text-sm text-teal-400 hover:text-teal-300 transition-colors underline underline-offset-4">
              security@ambrosiaventures.co
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
