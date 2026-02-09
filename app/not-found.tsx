import Link from 'next/link';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-900 to-navy-950 flex flex-col items-center justify-center px-4">
      <AmbrosiaLogo variant="reversed" height={40} />

      <div className="mt-10 text-center max-w-md">
        <p className="text-6xl font-bold text-teal-400 mb-4">404</p>
        <h1 className="text-2xl font-bold text-white mb-3">Page Not Found</h1>
        <p className="text-neutral-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all"
          >
            Back to Home
          </Link>
          <Link
            href="/calculator"
            className="px-6 py-2.5 border border-neutral-600 text-neutral-300 font-semibold rounded-xl hover:bg-neutral-800 transition-all"
          >
            Open Calculator
          </Link>
        </div>
      </div>
    </div>
  );
}
