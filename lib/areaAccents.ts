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
  cardiovascular: {
    bg: 'bg-rose-500',
    bg70: 'bg-rose-500/70',
    bg50: 'bg-rose-500/50',
    bg30: 'bg-rose-500/30',
    text30: 'text-rose-700 dark:text-rose-300',
  },
  infectiousDisease: {
    bg: 'bg-orange-500',
    bg70: 'bg-orange-500/70',
    bg50: 'bg-orange-500/50',
    bg30: 'bg-orange-500/30',
    text30: 'text-orange-700 dark:text-orange-300',
  },
  ophthalmology: {
    bg: 'bg-cyan-500',
    bg70: 'bg-cyan-500/70',
    bg50: 'bg-cyan-500/50',
    bg30: 'bg-cyan-500/30',
    text30: 'text-cyan-700 dark:text-cyan-300',
  },
  womensHealth: {
    bg: 'bg-pink-500',
    bg70: 'bg-pink-500/70',
    bg50: 'bg-pink-500/50',
    bg30: 'bg-pink-500/30',
    text30: 'text-pink-700 dark:text-pink-300',
  },
  rareDisease: {
    bg: 'bg-violet-500',
    bg70: 'bg-violet-500/70',
    bg50: 'bg-violet-500/50',
    bg30: 'bg-violet-500/30',
    text30: 'text-violet-700 dark:text-violet-300',
  },
  hematology: {
    bg: 'bg-red-500',
    bg70: 'bg-red-500/70',
    bg50: 'bg-red-500/50',
    bg30: 'bg-red-500/30',
    text30: 'text-red-700 dark:text-red-300',
  },
  dermatology: {
    bg: 'bg-fuchsia-500',
    bg70: 'bg-fuchsia-500/70',
    bg50: 'bg-fuchsia-500/50',
    bg30: 'bg-fuchsia-500/30',
    text30: 'text-fuchsia-700 dark:text-fuchsia-300',
  },
  gastroenterology: {
    bg: 'bg-lime-500',
    bg70: 'bg-lime-500/70',
    bg50: 'bg-lime-500/50',
    bg30: 'bg-lime-500/30',
    text30: 'text-lime-700 dark:text-lime-300',
  },
};
