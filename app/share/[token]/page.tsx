import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SharedCalculationView from '@/components/SharedCalculationView';

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calculator.ambrosiaventures.co';
  const ogImageUrl = `${baseUrl}/api/og/share/${token}`;

  // Fetch shared data for dynamic title/description
  let title = 'Shared Deal Analysis | Ambrosia Ventures';
  let description = 'View this shared biotech licensing deal analysis from Ambrosia Ventures Calculator.';

  try {
    const response = await fetch(`${baseUrl}/api/share/${token}`, {
      cache: 'no-store',
    });
    if (response.ok) {
      const data = await response.json();
      if (data.labels) {
        title = `${data.labels.modality} ${data.labels.indication} Deal Analysis | Ambrosia Ventures`;
        description = `${data.labels.phase} ${data.labels.modality} deal analysis for ${data.labels.indication}. View benchmarked deal terms, milestones, and royalties.`;
      }
    }
  } catch {
    // Fall back to generic metadata
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: 'Ambrosia Ventures Deal Analysis',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    robots: {
      index: false, // Don't index shared pages
      follow: false,
    },
  };
}

async function getSharedCalculation(token: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://calculator.ambrosiaventures.co';
    const response = await fetch(`${baseUrl}/api/share/${token}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching shared calculation:', error);
    return null;
  }
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const data = await getSharedCalculation(token);

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-sm font-medium text-teal-400">Shared Analysis</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            {data.labels?.modality || 'Deal'} Analysis
          </h1>
          <p className="text-neutral-300">
            {data.labels?.phase} &bull; {data.labels?.indication}
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm text-neutral-400">
            <span>Shared {new Date(data.createdAt).toLocaleDateString()}</span>
            <span>&bull;</span>
            <span>{data.viewCount} views</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SharedCalculationView results={data.results} labels={data.labels} />

        {/* CTA */}
        <div className="mt-8 p-6 bg-gradient-to-r from-navy-800 to-navy-900 rounded-xl text-center">
          <h3 className="text-xl font-bold text-white mb-2">
            Run Your Own Analysis
          </h3>
          <p className="text-neutral-300 mb-4 max-w-lg mx-auto">
            Use the Ambrosia Ventures Deal Calculator to benchmark your biotech
            licensing deals in seconds.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all"
          >
            Try the Calculator
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </div>
    </main>
  );
}
