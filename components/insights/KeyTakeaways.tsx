interface KeyTakeawaysProps {
  takeaways: string[];
}

export function KeyTakeaways({ takeaways }: KeyTakeawaysProps) {
  return (
    <div className="my-8 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border border-blue-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">Key Takeaways</h3>
      </div>
      <ul className="space-y-3">
        {takeaways.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-slate-700 leading-relaxed">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
