import { Metadata } from 'next';
import { getMethodologyStats } from '@/lib/methodology-stats';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

/**
 * Metadata reads the same live figures the page renders, so the description
 * never claims a count the database does not hold.
 */
export async function generateMetadata(): Promise<Metadata> {
  let description =
    'How Solidus sources biopharma deals, how each row is verified, how many deals sit at each level, how the four valuation methods work, and how accurate the engine is against verified disclosed deals.';
  try {
    const s = await getMethodologyStats();
    const c = s.counts;
    description =
      `${c.tracked.toLocaleString()} biopharma deals tracked, ${c.sourced.toLocaleString()} with a clickable source, ${c.verifiedCited.toLocaleString()} verified against the citation. ` +
      `How each deal is sourced and verified, how the comparable, rNPV, Monte Carlo and ensemble methods work, and the engine's measured accuracy against verified deals.`;
  } catch {
    // Keep the static description if the database is unreachable at build time.
  }
  const title = 'Methodology and Accuracy | Solidus';
  return {
    title,
    description,
    keywords: ['biopharma deal data methodology', 'deal benchmark accuracy', 'verified licensing deals', 'rNPV method', 'comparable transactions method', 'Monte Carlo biotech valuation'],
    alternates: { canonical: `${BASE_URL}/methodology` },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/methodology`,
      type: 'website',
      images: [{ url: `${BASE_URL}/api/og?title=Methodology%20and%20Accuracy&subtitle=How%20every%20deal%20is%20sourced%2C%20verified%20and%20scored`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

export default function MethodologyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
