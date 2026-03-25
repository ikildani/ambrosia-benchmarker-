interface InsightCalloutProps {
  title: string;
  children: React.ReactNode;
}

export function InsightCallout({ title, children }: InsightCalloutProps) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 my-8">
      <p className="text-sm font-semibold text-blue-900 mb-1">{title}</p>
      <div className="text-sm text-blue-800 leading-relaxed">{children}</div>
    </div>
  );
}
