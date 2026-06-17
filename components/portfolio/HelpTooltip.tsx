'use client';

import { useState, useRef, useEffect } from 'react';

interface HelpTooltipProps {
  text: string;
  className?: string;
}

export function HelpTooltip({ text, className = '' }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [above, setAbove] = useState(true);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // If less than 120px above the trigger, show below instead
      setAbove(rect.top > 120);
    }
  }, [visible]);

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span
        className="w-4 h-4 rounded-full bg-slate-700 text-slate-400 text-xs flex items-center justify-center cursor-help hover:bg-slate-600 hover:text-slate-300 transition-colors select-none"
        aria-label="Help"
      >
        ?
      </span>

      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`absolute z-50 bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs text-slate-300 max-w-xs shadow-lg whitespace-normal leading-relaxed ${
            above
              ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
              : 'top-full mt-2 left-1/2 -translate-x-1/2'
          }`}
          style={{ width: 'max-content', maxWidth: '280px' }}
        >
          {text}
          {/* Caret arrow */}
          <span
            className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 border-slate-600 rotate-45 ${
              above
                ? 'top-full -mt-1 border-r border-b'
                : 'bottom-full -mb-1 border-l border-t'
            }`}
          />
        </div>
      )}
    </span>
  );
}
