'use client';

import AmbrosiaLogo from '@/components/AmbrosiaLogo';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-900 to-navy-950 flex flex-col items-center justify-center px-4">
      <AmbrosiaLogo variant="reversed" height={40} />

      <div className="mt-10 text-center max-w-md">
        <p className="text-5xl mb-4">&#9888;&#65039;</p>
        <h1 className="text-2xl font-bold text-white mb-3">Something Went Wrong</h1>
        <p className="text-neutral-400 mb-8">
          An unexpected error occurred. Please try again.
        </p>

        <button
          onClick={reset}
          className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
