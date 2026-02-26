import { useRef } from 'react';
import type { TherapeuticArea } from '@/lib/calculations';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

interface AreaSwitchModalProps {
  isOpen: boolean;
  pendingArea: TherapeuticArea | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AreaSwitchModal({
  isOpen,
  pendingArea,
  onConfirm,
  onCancel,
}: AreaSwitchModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen, onCancel);

  if (!isOpen || !pendingArea) return null;

  const areaLabel = pendingArea === 'metabolic'
    ? 'Metabolic / Obesity'
    : pendingArea === 'neurology'
    ? 'Neurology / CNS'
    : pendingArea === 'immunology'
    ? 'Immunology / Autoimmune'
    : 'Oncology';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="area-switch-title" tabIndex={-1} className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 id="area-switch-title" className="text-lg font-bold text-slate-900 dark:text-white mb-2">Switch Therapeutic Area?</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Switching to <strong>{areaLabel}</strong> will clear your current results. Your calculation history is still saved.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all"
          >
            Switch Area
          </button>
        </div>
      </div>
    </div>
  );
}
