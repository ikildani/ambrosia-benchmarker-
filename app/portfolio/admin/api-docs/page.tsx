'use client';

import { useState, useEffect } from 'react';
import { Code, Copy, Check, ExternalLink } from 'lucide-react';

interface Endpoint {
  method: string;
  path: string;
  description: string;
  authLevel: 'Member' | 'Admin';
  exampleResponse: string;
}

const endpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/portfolio/dashboard',
    description: 'Team metrics, activity feed, and seat utilization',
    authLevel: 'Member',
    exampleResponse: `{
  "success": true,
  "team": { "name": "Acme Bio", "portfolio_tier": "scale" },
  "members": 8,
  "recentActivity": [...]
}`,
  },
  {
    method: 'GET',
    path: '/api/portfolio/members',
    description: 'List all team members with roles and status',
    authLevel: 'Admin',
    exampleResponse: `{
  "success": true,
  "members": [
    { "id": "...", "email": "analyst@acmebio.com", "role": "member", "status": "active" }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/api/portfolio/alerts',
    description: 'List deal alert configurations and recent triggers',
    authLevel: 'Member',
    exampleResponse: `{
  "success": true,
  "alerts": [
    { "id": "...", "name": "Oncology Deals > $500M", "active": true }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/api/portfolio/comp-sets',
    description: 'List shared comparable deal sets',
    authLevel: 'Member',
    exampleResponse: `{
  "success": true,
  "compSets": [
    { "id": "...", "name": "Phase 3 Oncology Licensing", "dealCount": 12 }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/api/portfolio/pipeline',
    description: 'Deal pipeline with conflict detection across team members',
    authLevel: 'Member',
    exampleResponse: `{
  "success": true,
  "deals": [...],
  "conflicts": [
    { "dealName": "...", "members": ["analyst1@acme.com", "analyst2@acme.com"] }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/api/portfolio/partner-matching',
    description: 'Cross-portfolio partner intelligence and matching scores',
    authLevel: 'Member',
    exampleResponse: `{
  "success": true,
  "matches": [
    { "company": "Novartis", "score": 0.87, "therapeuticAreas": ["oncology"] }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/api/portfolio/health-scores',
    description: 'Team member engagement and activity scores',
    authLevel: 'Admin',
    exampleResponse: `{
  "success": true,
  "scores": [
    { "userId": "...", "email": "...", "score": 82, "trend": "up" }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/api/portfolio/concentration',
    description: 'Therapeutic area concentration analysis across team activity',
    authLevel: 'Member',
    exampleResponse: `{
  "success": true,
  "concentration": {
    "oncology": 0.35,
    "neurology": 0.22,
    "immunology": 0.18
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/portfolio/quarterly-report',
    description: 'Historical quarterly portfolio benchmarking reports',
    authLevel: 'Admin',
    exampleResponse: `{
  "success": true,
  "reports": [
    { "quarter": "Q1 2026", "generatedAt": "2026-04-01T00:00:00Z" }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/api/portfolio/office-hours',
    description: 'Available and booked office hour slots',
    authLevel: 'Member',
    exampleResponse: `{
  "success": true,
  "slots": [
    { "date": "2026-06-20", "time": "10:00", "booked": false }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/api/portfolio/analyst-hours',
    description: 'Analyst hour entries and remaining allocation',
    authLevel: 'Admin',
    exampleResponse: `{
  "success": true,
  "entries": [...],
  "remaining": 4.5,
  "monthlyAllocation": 10
}`,
  },
  {
    method: 'GET',
    path: '/api/portfolio/playbooks',
    description: 'Negotiation playbook templates and term sheet guides',
    authLevel: 'Member',
    exampleResponse: `{
  "success": true,
  "playbooks": [
    { "id": "...", "title": "Phase 3 Licensing Template", "category": "licensing" }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/api/portfolio/isolation-check',
    description: 'Data isolation verification for compliance audits',
    authLevel: 'Admin',
    exampleResponse: `{
  "success": true,
  "isolated": true,
  "crossTeamLeaks": 0,
  "checkedAt": "2026-06-17T12:00:00Z"
}`,
  },
];

const sections = [
  { id: 'authentication', label: 'Authentication' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'rate-limits', label: 'Rate Limits' },
  { id: 'webhooks', label: 'Webhooks' },
];

function CodeBlock({ children, copyable = true }: { children: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-sm text-slate-300 overflow-x-auto whitespace-pre">
        {children}
      </pre>
      {copyable && (
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Copy to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState('authentication');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px' }
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Code className="w-6 h-6 text-teal-400" />
          API Documentation
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Read-only REST API for integrating portfolio data with internal systems
        </p>
      </div>

      <div className="flex gap-8">
        {/* Left nav - desktop only */}
        <nav className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-24 space-y-1">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`block px-3 py-1.5 rounded text-sm transition-colors ${
                  activeSection === section.id
                    ? 'text-teal-400 bg-teal-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {section.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-10">
          {/* Authentication */}
          <section id="authentication">
            <h2 className="text-lg font-semibold text-white mb-4">Authentication</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                All API requests require authentication via a Bearer token from your active session.
                Include the token in the <code className="text-teal-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs">Authorization</code> header of every request.
              </p>
              <CodeBlock>{`curl -X GET https://calculator.ambrosiaventures.co/api/portfolio/dashboard \\
  -H "Authorization: Bearer <your-token>" \\
  -H "Content-Type: application/json"`}</CodeBlock>
              <div className="bg-slate-800/50 border border-teal-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Code className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-teal-400">Enterprise API Keys &amp; MCP Server</p>
                    <p className="text-xs text-slate-400 mt-1 mb-3">
                      Manage your API keys and connect AI agents via the Model Context Protocol.
                      Go to <a href="/dashboard?tab=api" className="text-teal-400 hover:text-teal-300 underline">Dashboard → API tab</a> to create, view, and revoke keys.
                    </p>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">MCP Endpoint</p>
                      <code className="block text-xs text-teal-300 bg-slate-900 px-3 py-2 rounded font-mono select-all">https://calculator.ambrosiaventures.co/api/mcp</code>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-3">21 Tools Available</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {['Deal Terms', 'rNPV', 'Monte Carlo', 'Deal Optimizer', 'Regulatory Risk', 'Partner Match', 'Royalty Stacking', 'Patent/LOE', 'CMC Risk', 'Earnout/CVR', 'Tax Structure', 'Buyer Synergy', 'Indication Sequence', 'Competitive Dynamics', 'Real Options', 'Lifecycle Extensions', 'Scenario Comparison', 'Defensive Analysis', 'Clinical Readouts', 'AdComm Calendar', 'ZOPA/Negotiation'].map(tool => (
                          <span key={tool} className="text-[9px] px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded">{tool}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoints */}
          <section id="endpoints">
            <h2 className="text-lg font-semibold text-white mb-4">Endpoints</h2>
            <div className="space-y-4">
              {endpoints.map((endpoint) => (
                <div
                  key={endpoint.path}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                        {endpoint.method}
                      </span>
                      <code className="text-sm font-mono text-white">{endpoint.path}</code>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wider ${
                      endpoint.authLevel === 'Admin'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-slate-700/50 text-slate-400'
                    }`}>
                      {endpoint.authLevel}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{endpoint.description}</p>
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Example response</p>
                    <CodeBlock>{endpoint.exampleResponse}</CodeBlock>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Rate Limits */}
          <section id="rate-limits">
            <h2 className="text-lg font-semibold text-white mb-4">Rate Limits</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <p className="text-sm text-slate-300 mb-4">
                Rate limits are applied per-user and reset on a rolling window. Exceeding the limit returns a <code className="text-red-400 bg-slate-800 px-1.5 py-0.5 rounded text-xs">429 Too Many Requests</code> response.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Category</th>
                      <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Limit</th>
                      <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Window</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    <tr className="border-b border-slate-800/50">
                      <td className="py-2.5 px-3">Standard endpoints</td>
                      <td className="py-2.5 px-3 font-mono text-teal-400">60</td>
                      <td className="py-2.5 px-3">per minute</td>
                    </tr>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-2.5 px-3">Report generation</td>
                      <td className="py-2.5 px-3 font-mono text-teal-400">5</td>
                      <td className="py-2.5 px-3">per minute</td>
                    </tr>
                    <tr className="border-b border-slate-800/50">
                      <td className="py-2.5 px-3">Partner matching</td>
                      <td className="py-2.5 px-3 font-mono text-teal-400">10</td>
                      <td className="py-2.5 px-3">per minute</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3">Quarterly report</td>
                      <td className="py-2.5 px-3 font-mono text-teal-400">3</td>
                      <td className="py-2.5 px-3">per minute</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Webhooks */}
          <section id="webhooks">
            <h2 className="text-lg font-semibold text-white mb-4">Webhooks</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Deal alerts and activity notifications can be pushed to Slack or Microsoft Teams via incoming webhooks.
                Configure your webhook URL in <strong className="text-white">Settings &gt; Slack / Teams Integration</strong>.
              </p>
              <p className="text-sm text-slate-300 leading-relaxed">
                When a deal alert triggers, a POST request is sent to your configured webhook URL with a JSON payload containing the alert details, matched deal information, and a direct link to the deal in your portfolio dashboard.
              </p>
              <div>
                <p className="text-xs text-slate-500 mb-2">Example webhook payload</p>
                <CodeBlock>{`{
  "text": "Deal Alert: Oncology Deals > $500M",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*New Deal Match*\\nPfizer / Seagen Oncology License\\nTotal Value: $2.1B\\nTA: Oncology"
      }
    }
  ]
}`}</CodeBlock>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-xs text-slate-400">
                  Webhook delivery is best-effort with automatic retries (up to 3 attempts with exponential backoff).
                  Failed deliveries are logged in the Audit Log.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
