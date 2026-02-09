'use client';

interface ConfirmSwitchModalProps {
  isOpen: boolean;
  targetArea: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmSwitchModal({ isOpen, targetArea, onConfirm, onCancel }: ConfirmSwitchModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />

      {/* Card */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-in">
        <div className="flex items-center justify-center w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full mx-auto mb-4">
          <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-2">
          Switch to {targetArea}?
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
          Your current inputs will be reset to {targetArea} defaults.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
