import Link from 'next/link';
import { DEAL_STATS } from '@/lib/config/constants';
import FooterSection from './FooterSection';

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

const footerLinks: Record<string, FooterLink[]> = {
  Product: [
    { label: 'Solidus', href: '/calculator' },
    { label: 'Pro Plan', href: '/pro' },
    { label: 'Deal Intelligence Brief', href: '/brief' },
    { label: 'Portfolio License', href: '/portfolio' },
    { label: 'Benchmarks', href: '/benchmarks' },
    { label: 'Deal Pulse', href: '/pulse' },
    { label: 'Companies', href: '/companies' },
    { label: 'Methodology', href: '/methodology' },
  ],
  Intelligence: [
    { label: 'Counterparty Playbooks', href: '/playbook' },
    { label: 'Deal Structure Trade Space', href: '/trade-space' },
    { label: 'Negotiation Simulator', href: '/simulator' },
    { label: 'Live Market Intelligence', href: '/intelligence' },
    { label: 'Engine Methodology', href: '/methodology/engine' },
  ],
  'Therapeutic Areas': [
    { label: 'Oncology Deals', href: '/therapeutic-areas/oncology' },
    { label: 'Neurology Deals', href: '/therapeutic-areas/neurology' },
    { label: 'Immunology Deals', href: '/therapeutic-areas/immunology' },
    { label: 'Cardiovascular', href: '/therapeutic-areas/cardiovascular' },
    { label: 'Rare Disease', href: '/therapeutic-areas/rareDisease' },
    { label: 'All Therapeutic Areas', href: '/therapeutic-areas' },
  ],
  Resources: [
    { label: 'Blog', href: '/blog' },
    { label: 'Guides', href: '/guides' },
    { label: 'Licensing Benchmarks', href: '/guides/biopharma-licensing-benchmarks' },
    { label: 'rNPV Guide', href: '/guides/rnpv-biotech-valuation' },
    { label: 'Royalty Benchmarks', href: '/guides/negotiate-pharma-royalty-rates' },
    { label: 'Solidus Platform Guide', href: '/guides/life-sciences-deal-calculator-guide' },
    { label: 'Reports', href: '/reports' },
    { label: 'Glossary', href: '/glossary' },
    { label: 'Insights', href: '/insights' },
    { label: 'Press & Media', href: '/press' },
  ],
  Company: [
    { label: 'Ambrosia Ventures', href: 'https://ambrosiaventures.co', external: true },
    { label: 'Advisory Services', href: 'https://ambrosiaventures.co/advisory', external: true },
    { label: 'About', href: '/about' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
};

export function SiteFooter() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-0 md:gap-8 mb-10">
          {Object.entries(footerLinks).map(([section, links]) => (
            <FooterSection key={section} title={section}>
              {links.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center min-h-11 md:min-h-8 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="flex items-center min-h-11 md:min-h-8 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </FooterSection>
          ))}
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} Ambrosia Ventures. All rights reserved.
          </p>
          <p className="text-xs text-slate-400">
            Benchmarks powered by {DEAL_STATS.TOTAL_DEALS} primary-sourced biopharma licensing deals
          </p>
        </div>
      </div>
    </footer>
  );
}
