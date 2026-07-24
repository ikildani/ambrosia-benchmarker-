import { Metadata } from 'next';
import Link from 'next/link';
import { EnterpriseKeyManager } from '@/components/enterprise/EnterpriseKeyManager';
import { SiteFooter } from '@/components/seo/SiteFooter';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: 'Enterprise API | Solidus',
  description:
    'API keys, usage dashboard, and integration docs for enterprise pilot customers.',
  alternates: { canonical: `${BASE_URL}/enterprise` },
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function EnterprisePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-slate-800/60 bg-gradient-to-b from-slate-900/50 to-slate-950">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <nav className="mb-4 text-sm">
            <Link href="/" className="text-slate-500 hover:text-slate-300">← Solidus</Link>
          </nav>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-50">
            Enterprise API
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-slate-400">
            Programmatic access to the Ambrosia valuation engine for institutional customers.
            Generate API keys, monitor usage, and review tier limits below. Contact us for
            production enterprise contracts above the pilot tier.
          </p>
        </div>
      </section>

      <section className="border-b border-slate-800/60">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <EnterpriseKeyManager />
        </div>
      </section>

      {/* Endpoints */}
      <section className="border-b border-slate-800/60 bg-slate-900/20">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">Available endpoints</h2>
          <div className="space-y-4 text-sm">
            <ApiEndpoint
              method="POST"
              path="/api/calculate"
              description="Full rNPV calculation. Returns risk-adjusted NPV, implied deal value (upfront + total), Monte Carlo bands, and all 14 modeling dimensions."
            />
            <ApiEndpoint
              method="GET"
              path="/api/playbook"
              description="All counterparty premium records. Per-buyer historical premium vs peer median, TA breakdowns, phase breakdowns."
            />
            <ApiEndpoint
              method="GET"
              path="/api/share/[token]"
              description="Retrieve a specific shared calculation by token. Returns inputs + results + labels."
            />
            <ApiEndpoint
              method="GET"
              path="/api/trials/intelligence"
              description="Upcoming Phase 3 trial readouts filtered by therapeutic area. Live CT.gov feed, 1h edge cache."
            />
          </div>
          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-500">
            <p><span className="text-slate-300">Authentication:</span> <code className="rounded bg-slate-800 px-1 py-0.5">Authorization: Bearer ambk_xxx</code></p>
            <p className="mt-1"><span className="text-slate-300">Rate limiting:</span> Monthly quota per key (pilot 1k / growth 10k / enterprise 100k). Usage counter resets on the 1st of each UTC month.</p>
            <p className="mt-1"><span className="text-slate-300">SLA:</span> Pilot tier has no SLA; growth and enterprise tiers include 99.5% uptime.</p>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="border-b border-slate-800/60">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">Tiers</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <TierCard
              name="Pilot"
              quota="1,000 calls/mo"
              price="Free"
              features={['All public endpoints', 'No SLA', 'Community support']}
            />
            <TierCard
              name="Growth"
              quota="10,000 calls/mo"
              price="Contact sales"
              features={['All endpoints', '99.5% uptime SLA', 'Priority email support', 'Quarterly calibration briefing']}
              highlighted
            />
            <TierCard
              name="Enterprise"
              quota="100,000 calls/mo"
              price="Contact sales"
              features={['All endpoints + bespoke models', 'Dedicated Slack channel', 'Custom rate limits', 'Engine methodology review on request', 'Portfolio-License integration']}
            />
          </div>
          <p className="mt-6 text-sm text-slate-400">
            Pilot key generation is self-serve above. Growth and Enterprise:
            email <code className="rounded bg-slate-800 px-1 py-0.5">enterprise@ambrosiaventures.co</code>.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function ApiEndpoint({ method, path, description }: { method: string; path: string; description: string }) {
  const methodColor = method === 'POST' ? 'text-teal-400' : 'text-cyan-400';
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-baseline gap-3">
        <span className={`font-mono text-xs font-semibold uppercase ${methodColor}`}>{method}</span>
        <code className="font-mono text-sm text-slate-200">{path}</code>
      </div>
      <p className="mt-2 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function TierCard({ name, quota, price, features, highlighted }: { name: string; quota: string; price: string; features: string[]; highlighted?: boolean }) {
  return (
    <div className={[
      'rounded-lg border p-5',
      highlighted ? 'border-teal-500/40 bg-teal-500/5' : 'border-slate-800 bg-slate-900/30',
    ].join(' ')}>
      <h3 className={`text-base font-semibold ${highlighted ? 'text-teal-300' : 'text-slate-200'}`}>{name}</h3>
      <div className="mt-2 font-mono text-xl text-slate-100">{quota}</div>
      <div className="mt-1 text-sm text-slate-500">{price}</div>
      <ul className="mt-4 space-y-2 text-xs text-slate-400">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-0.5 text-teal-400">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
