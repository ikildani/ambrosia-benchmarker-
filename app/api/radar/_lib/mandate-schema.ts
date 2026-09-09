/**
 * Asset Radar — mandate input validation (shared by mandates/route.ts and
 * mandates/[id]/route.ts). Kept out of the route files because Next.js only
 * allows handler/config exports from a route module.
 */

import { z } from 'zod';
import {
  RADAR_TA_OPTIONS,
  RADAR_MODALITY_OPTIONS,
  RADAR_PHASE_OPTIONS,
  RADAR_PARTNERSHIP_OPTIONS,
  RADAR_REGION_OPTIONS,
  RADAR_COUNTRY_OPTIONS,
} from '@/lib/radar/vocab';

const vocabEnum = (opts: { value: string }[]) =>
  z.enum(opts.map(o => o.value) as [string, ...string[]]);

/**
 * Field-level validation for mandates. Used as-is for PATCH (all optional)
 * and for POST, which applies defaults explicitly. Vocabulary fields are
 * whitelisted against lib/radar/vocab.ts so stored filters always match the
 * values in clinical_assets.
 */
export const mandateFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable(),
  is_active: z.boolean(),
  therapeutic_areas: z.array(vocabEnum(RADAR_TA_OPTIONS)).max(20),
  modalities: z.array(vocabEnum(RADAR_MODALITY_OPTIONS)).max(20),
  phase_min: vocabEnum(RADAR_PHASE_OPTIONS).nullable(),
  phase_max: vocabEnum(RADAR_PHASE_OPTIONS).nullable(),
  countries: z.array(vocabEnum(RADAR_COUNTRY_OPTIONS)).max(50),
  regions: z.array(vocabEnum(RADAR_REGION_OPTIONS)).max(20),
  partnership_statuses: z.array(vocabEnum(RADAR_PARTNERSHIP_OPTIONS)).max(4),
  min_licensing_intent: z.coerce.number().min(0).max(100),
  min_deal_readiness: z.coerce.number().min(0).max(100),
  min_confidence: z.coerce.number().int().min(0).max(100),
  notify_email: z.boolean(),
  notify_in_app: z.boolean(),
  digest_frequency: z.enum(['realtime', 'daily', 'weekly']),
}).partial();

export type MandateFields = z.infer<typeof mandateFieldsSchema>;

/** First zod issue as a short client-safe message, e.g. "modalities.0: Invalid option". */
export function formatValidationError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid request';
  const field = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
  return `${field}${issue.message}`;
}
