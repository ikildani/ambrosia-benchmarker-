'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';

interface CustomAssumptionsBadgeProps {
  count: number; // number of overridden fields
  onClick?: () => void; // optional click handler (e.g., to scroll to panel or expand it)
  variant?: 'compact' | 'detailed'; // compact: just count, detailed: "X custom assumptions"
  className?: string;
}

/**
 * Teal pill badge showing how many custom assumptions are active.
 * Used in the wizard stepper and results header.
 * Renders nothing when count is 0.
 */
function CustomAssumptionsBadgeInner({
  count,
  onClick,
  variant = 'compact',
  className = '',
}: CustomAssumptionsBadgeProps) {
  const prefersReducedMotion = useReducedMotion();

  if (count === 0) return null;

  const label =
    variant === 'detailed'
      ? `${count} custom assumption${count === 1 ? '' : 's'}`
      : String(count);

  const isClickable = !!onClick;

  return (
    <motion.span
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`${count} custom assumption${count === 1 ? '' : 's'} active`}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 400, damping: 25 }
      }
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                  bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400
                  ${isClickable ? 'cursor-pointer hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors duration-150' : ''}
                  ${className}`}
    >
      <SlidersHorizontal size={12} strokeWidth={2} className="flex-shrink-0" />
      <span className="[font-variant-numeric:tabular-nums]">{label}</span>
    </motion.span>
  );
}

const CustomAssumptionsBadge = React.memo(CustomAssumptionsBadgeInner);
export default CustomAssumptionsBadge;
