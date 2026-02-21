import type { TherapeuticArea } from './calculations';

// Per-area accent classes for section step numbers throughout the wizard.
// Keeps the accent color system consistent with TherapeuticAreaSelector.

interface StepAccent {
  /** Full-opacity circle for the current/primary step */
  bg: string;
  /** 70% opacity variant for secondary steps */
  bg70: string;
  /** 50% opacity variant for tertiary steps */
  bg50: string;
  /** 30% opacity variant with matching text for quaternary steps */
  bg30: string;
  text30: string;
}

export const STEP_ACCENTS: Record<TherapeuticArea, StepAccent> = {
  oncology: {
    bg: 'bg-teal-500',
    bg70: 'bg-teal-500/70',
    bg50: 'bg-teal-500/50',
    bg30: 'bg-teal-500/30',
    text30: 'text-teal-700 dark:text-teal-300',
  },
  neurology: {
    bg: 'bg-indigo-500',
    bg70: 'bg-indigo-500/70',
    bg50: 'bg-indigo-500/50',
    bg30: 'bg-indigo-500/30',
    text30: 'text-indigo-700 dark:text-indigo-300',
  },
  immunology: {
    bg: 'bg-amber-500',
    bg70: 'bg-amber-500/70',
    bg50: 'bg-amber-500/50',
    bg30: 'bg-amber-500/30',
    text30: 'text-amber-700 dark:text-amber-300',
  },
  metabolic: {
    bg: 'bg-emerald-500',
    bg70: 'bg-emerald-500/70',
    bg50: 'bg-emerald-500/50',
    bg30: 'bg-emerald-500/30',
    text30: 'text-emerald-700 dark:text-emerald-300',
  },
};
