'use client';

import { useRef } from 'react';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

interface ConfirmSwitchModalProps {
  isOpen: boolean;
  targetArea: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmSwitchModal({ isOpen, targetArea, onConfirm, onCancel }: ConfirmSwitchModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen, onCancel);

  if (!isOpen) return null;

  const areaLabel = targetArea === 'neurology' ? 'Neurology / CNS' : 'Oncology';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="confirm-switch-title" tabIndex={-1} className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 id="confirm-switch-title" className="text-lg font-semibold text-slate-900 dark:text-white">
            Switch to {areaLabel}?
          </h3>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Your current inputs will be reset to {areaLabel} defaults. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
