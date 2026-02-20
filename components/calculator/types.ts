import type { CalculationInput } from '@/lib/calculations';

export interface DealTemplate {
  id: string;
  name: string;
  description: string;
  icon: 'standard' | 'premium' | 'highValue' | 'platform' | 'regional' | 'commercial';
  values: Partial<CalculationInput>;
}
