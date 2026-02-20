'use client';

import React from 'react';
import type { ValidationWarning } from '@/lib/validationWarnings';

interface ValidationWarningsProps {
  warnings: ValidationWarning[];
}

function ValidationWarningsInner({ warnings }: ValidationWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((warning) => (
        <div
          key={warning.id}
          role="alert"
          className="flex gap-2.5 px-3 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300 motion-safe:animate-tooltip-in"
        >
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>{warning.message}</span>
        </div>
      ))}
    </div>
  );
}

const ValidationWarnings = React.memo(ValidationWarningsInner);
export default ValidationWarnings;
