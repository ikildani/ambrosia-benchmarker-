import React from 'react';

export interface CardProps {
  variant?: 'default' | 'elevated' | 'interactive' | 'metric';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}

const variantClasses: Record<NonNullable<CardProps['variant']>, string> = {
  default:
    'bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-600 shadow-soft',
  elevated:
    'bg-white dark:bg-slate-800 rounded-xl shadow-soft-lg',
  interactive:
    'bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 shadow-soft hover:shadow-soft-lg hover:border-teal-200 transition-all duration-300 cursor-pointer',
  metric:
    'bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-600 shadow-soft hover:shadow-glow transition-all duration-300',
};

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-8',
};

export function Card({
  variant = 'default',
  padding = 'md',
  children,
  className = '',
  as: Component = 'div',
  ...rest
}: CardProps & Record<string, unknown>) {
  return (
    <Component
      className={[
        variantClasses[variant],
        paddingClasses[padding],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Component>
  );
}
