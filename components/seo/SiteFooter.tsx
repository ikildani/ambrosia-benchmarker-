import Link from 'next/link';

const footerLinks = {
  Product: [
    { label: 'Deal Calculator', href: '/calculator' },
    { label: 'Pro Plan', href: '/pro' },
    { label: 'Benchmarks', href: '/benchmarks' },
    { label: 'Deal Pulse', href: '/pulse' },
    { label: 'Companies', href: '/companies' },
    { label: 'Methodology', href: '/methodology' },
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
    { label: 'Deal Calculator Guide', href: '/guides/life-sciences-deal-calculator-guide' },
    { label: 'Reports', href: '/reports' },
    { label: 'Glossary', href: '/glossary' },
    { label: 'Insights', href: '/insights' },
    { label: 'Press & Media', href: '/press' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
};

export function SiteFooter() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
                {section}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-500 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Ambrosia Ventures. All rights reserved.
          </p>
          <p className="text-xs text-slate-600">
            Benchmarks powered by 3,000+ real biopharma licensing deals
          </p>
        </div>
      </div>
    </footer>
  );
}
