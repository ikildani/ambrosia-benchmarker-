// Shared between the server page (which computes the default scenario) and the
// LiveDemo client island. Kept out of the 'use client' module on purpose: values
// imported from a client module into a server component arrive as client
// references, not data.
import type { Phase, Modality, Indication } from '@/lib/calculations';

export interface DemoRange { low: number; high: number; median: number }
export interface DemoResult {
  terms: { upfront: DemoRange; totalDealValue: DemoRange };
  tieredRoyalties: { base: { low: number; high: number } };
}
export interface OptionGroup { group: string; options: Array<{ value: string; label: string }> }

export const DEMO_DEFAULT: { phase: Phase; modality: Modality; indication: Indication } = {
  phase: 'phase2',
  modality: 'adc',
  indication: 'breast_tnbc',
};
