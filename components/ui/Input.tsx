'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  touched?: boolean;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      touched = false,
      helperText,
      id,
      className = '',
      ...rest
    },
    ref
  ) => {
    const inputId = id ?? React.useId();
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const showError = touched && !!error;

    return (
      <div>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={showError}
          aria-describedby={
            showError ? errorId : helperText ? helperId : undefined
          }
          className={[
            'w-full px-4 py-2.5 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2',
            showError
              ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
              : 'border-neutral-200 focus:ring-teal-500/20 focus:border-teal-500',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        />
        {showError && (
          <p id={errorId} role="alert" className="text-xs text-red-500 mt-1">
            {error}
          </p>
        )}
        {!showError && helperText && (
          <p id={helperId} className="text-xs text-neutral-500 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
