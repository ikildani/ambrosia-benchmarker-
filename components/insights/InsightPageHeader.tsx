import Link from 'next/link';

interface StatItem {
  value: string;
  label: string;
}

interface InsightPageHeaderProps {
  title: string;
  titleAccent?: { text: string; color?: string };
  subtitle: string;
  badge?: string;
  readTime?: string;
  stats?: StatItem[];
  breadcrumbLabel: string;
}

export function InsightPageHeader({
  title,
  titleAccent,
  subtitle,
  badge = 'Data Report',
  readTime,
  stats,
  breadcrumbLabel,
}: InsightPageHeaderProps) {
  return (
    <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-24 pb-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.08),transparent)]" />
      <div className="relative max-w-3xl mx-auto text-center">
        <nav className="flex items-center justify-center gap-2 text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/insights" className="hover:text-white transition-colors">Insights</Link>
          <span>/</span>
          <span className="text-slate-200">{breadcrumbLabel}</span>
        </nav>

        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-sm font-medium rounded-full">
            {badge}
          </span>
          {readTime && (
            <span className="inline-block px-3 py-1 bg-slate-700/50 text-slate-300 text-sm font-medium rounded-full">
              {readTime}
            </span>
          )}
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-6">
          {titleAccent ? (
            <>
              {title.split(titleAccent.text)[0]}
              <span className={titleAccent.color || 'text-blue-400'}>{titleAccent.text}</span>
              {title.split(titleAccent.text)[1]}
            </>
          ) : (
            title
          )}
        </h1>

        <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
          {subtitle}
        </p>

        {stats && stats.length > 0 && (
          <div className={`grid grid-cols-${Math.min(stats.length, 4)} gap-4 max-w-lg mx-auto`}>
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
