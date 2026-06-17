'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  onDismiss: () => void;
  duration?: number;
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
};

const iconColorMap = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
};

export function Toast({ message, type, onDismiss, duration = 4000 }: ToastProps) {
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDismissing(true);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  useEffect(() => {
    if (dismissing) {
      const timer = setTimeout(() => {
        onDismiss();
      }, 300); // match slide-out animation duration
      return () => clearTimeout(timer);
    }
  }, [dismissing, onDismiss]);

  const handleDismiss = () => {
    setDismissing(true);
  };

  const Icon = iconMap[type];

  return (
    <div
      role="alert"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 max-w-sm
        bg-slate-800 border border-slate-700 rounded-lg px-4 py-3
        shadow-lg shadow-black/20
        ${dismissing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${iconColorMap[type]}`} />
      <p className="text-sm text-slate-200 flex-1">{message}</p>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-slate-400 hover:text-slate-200 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
