interface AuthorBylineProps {
  date?: string;
  updatedDate?: string;
}

export function AuthorByline({ date = 'March 24, 2026', updatedDate }: AuthorBylineProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 my-6 py-4 border-b border-slate-200">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">AV</span>
        </div>
        <span className="font-medium text-slate-700">Ambrosia Ventures Research</span>
      </div>
      <span className="hidden sm:inline text-slate-300">|</span>
      <time dateTime={date}>{date}</time>
      {updatedDate && (
        <>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span>Updated {updatedDate}</span>
        </>
      )}
      <span className="hidden sm:inline text-slate-300">|</span>
      <span>Based on 3,500+ verified transactions</span>
    </div>
  );
}
