interface TOCItem {
  id: string;
  label: string;
}

interface TableOfContentsProps {
  items: TOCItem[];
}

export function TableOfContents({ items }: TableOfContentsProps) {
  return (
    <nav className="my-8 bg-slate-50 rounded-xl p-6 border border-slate-200" aria-label="Table of contents">
      <p className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">In This Report</p>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="flex items-start gap-3 text-sm text-slate-600 hover:text-teal-700 transition-colors group"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-500 text-xs font-semibold flex-shrink-0 mt-0.5 group-hover:bg-teal-100 group-hover:text-teal-700 transition-colors">
                {i + 1}
              </span>
              <span className="leading-snug">{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
