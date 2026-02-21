'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleId?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  headerVariant?: 'gradient' | 'simple' | 'none';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  preventClose?: boolean;
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export default function ModalBase({
  isOpen,
  onClose,
  title,
  titleId = 'modal-title',
  subtitle,
  icon,
  headerVariant = 'gradient',
  size = 'md',
  children,
  footer,
  preventClose = false,
}: ModalBaseProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape key (handled inside the hook unless preventClose)
  useFocusTrap(modalRef, isOpen, preventClose ? undefined : onClose);

  // Escape key when preventClose is false is already handled by useFocusTrap.
  // No extra listener needed.

  // Body scroll lock — follows OnboardingModal pattern exactly (iOS position restore)
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1);
      }
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (!preventClose) onClose();
  };

  const closeButton = (
    <button
      onClick={preventClose ? undefined : onClose}
      className="absolute top-4 right-4 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
      aria-label="Close dialog"
      disabled={preventClose}
    >
      <X className="w-4 h-4" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto overscroll-contain w-full ${sizeMap[size]} outline-none`}
      >
        {/* Header: gradient */}
        {headerVariant === 'gradient' && (
          <div className="relative bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white p-6 rounded-t-2xl">
            <div className="text-white">{closeButton}</div>
            <div className="flex items-center gap-4">
              {icon && <div className="flex-shrink-0">{icon}</div>}
              <div>
                <h3 id={titleId} className="text-2xl font-bold text-white">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-neutral-400 text-sm mt-1">{subtitle}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Header: simple */}
        {headerVariant === 'simple' && (
          <div className="relative border-b border-neutral-200 dark:border-slate-700 p-6">
            <div className="text-neutral-500 hover:text-neutral-700 dark:text-slate-400">
              {closeButton}
            </div>
            <h3 id={titleId} className="text-xl font-bold text-neutral-900 dark:text-white">
              {title}
            </h3>
            {subtitle && (
              <p className="text-neutral-500 dark:text-slate-400 text-sm mt-1">{subtitle}</p>
            )}
          </div>
        )}

        {/* Header: none — floating close button only */}
        {headerVariant === 'none' && (
          <div className="text-neutral-500 hover:text-neutral-700 dark:text-slate-400">
            {closeButton}
          </div>
        )}

        {/* Children */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-neutral-200 dark:border-slate-700 p-4 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
