import Link from 'next/link';

interface RelatedArticle {
  href: string;
  title: string;
  description: string;
  badge?: string;
}

interface RelatedInsightsProps {
  articles: RelatedArticle[];
  heading?: string;
}

export function RelatedInsights({ articles, heading = 'Related Benchmarks & Insights' }: RelatedInsightsProps) {
  return (
    <section className="my-12 py-12 border-t border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">{heading}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {articles.map((article) => (
          <Link
            key={article.href}
            href={article.href}
            className="group block bg-slate-50 rounded-xl p-5 border border-slate-200 hover:border-teal-300 hover:shadow-md transition-all"
          >
            {article.badge && (
              <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full mb-2">
                {article.badge}
              </span>
            )}
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-teal-700 transition-colors leading-snug mb-1">
              {article.title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">{article.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
