'use client';

interface ScoreProgressBarProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreProgressBar({
  score,
  showLabel = true,
  size = 'md',
}: ScoreProgressBarProps) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'from-teal-500 to-cyan-500';
    if (s >= 60) return 'from-blue-500 to-teal-500';
    if (s >= 40) return 'from-amber-500 to-yellow-500';
    return 'from-gray-400 to-gray-500';
  };

  const getTextColor = (s: number) => {
    if (s >= 80) return 'text-teal-700';
    if (s >= 60) return 'text-blue-700';
    if (s >= 40) return 'text-amber-700';
    return 'text-gray-700';
  };

  const heightClass = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  }[size];

  return (
    <div className="mb-4">
      {showLabel && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Match Score
          </span>
          <span className={`text-lg font-bold ${getTextColor(score)}`}>
            {score}%
          </span>
        </div>
      )}
      <div className={`${heightClass} bg-gray-200 rounded-full overflow-hidden`}>
        <div
          className={`h-full bg-gradient-to-r ${getScoreColor(score)} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

export default ScoreProgressBar;
