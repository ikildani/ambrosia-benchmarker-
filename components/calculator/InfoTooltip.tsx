'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface InfoTooltipProps {
  content: string;
}

function InfoTooltipInner({ content }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const show = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  }, []);

  const hide = useCallback(() => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        !tooltipRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  return (
    <span className="relative inline-flex items-center ml-1">
      <button
        ref={triggerRef}
        type="button"
        aria-label="More info"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => setIsOpen(!isOpen)}
        className="w-4 h-4 rounded-full bg-neutral-200 dark:bg-slate-600 text-neutral-500 dark:text-slate-400
                   hover:bg-teal-100 hover:text-teal-600 dark:hover:bg-teal-900/30 dark:hover:text-teal-400
                   flex items-center justify-center transition-colors duration-150 text-[10px] font-bold"
      >
        ?
      </button>
      {isOpen && (
        <div
          ref={tooltipRef}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hide}
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50
                     w-56 px-3 py-2 rounded-lg shadow-lg
                     bg-navy-900 dark:bg-slate-700 text-white text-xs leading-relaxed
                     motion-safe:animate-tooltip-in"
        >
          {content}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-navy-900 dark:border-t-slate-700" />
        </div>
      )}
    </span>
  );
}

const InfoTooltip = React.memo(InfoTooltipInner);
export default InfoTooltip;
