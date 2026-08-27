import { Metadata } from 'next';
import InstantEstimator from '@/components/estimator/InstantEstimator';

const BASE_URL = 'https://solidus.ambrosiaventures.co';

export const metadata: Metadata = {
  title: "What's Your Asset Worth? | Solidus Deal Estimator",
  description: 'Instant biopharma deal term estimates. Select your therapeutic area, phase, modality, and territory to see predicted upfront payments, milestones, and total deal value with confidence intervals.',
  alternates: { canonical: `${BASE_URL}/estimate` },
  openGraph: {
    title: "What's Your Asset Worth? | Solidus",
    description: 'Instant deal term prediction for biopharma licensing. Free, no signup required.',
    type: 'website',
    url: `${BASE_URL}/estimate`,
    siteName: 'Solidus',
  },
};

export default function EstimatePage() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-20 sm:py-28">
        <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white tracking-tight mb-3">
          What&rsquo;s Your Asset Worth?
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 mb-10 max-w-xl">
          Get an instant estimate of expected deal terms based on comparable biopharma transactions. No signup required.
        </p>
        <InstantEstimator />
      </div>
    </main>
  );
}
