import { z } from 'zod';

/**
 * Zod schemas for API input validation.
 * Validates calculation parameters, email, and filenames.
 */

// Calculation request — validates the core fields that affect deal computation
export const calculationRequestSchema = z.object({
  modality: z.string().min(1, 'modality is required'),
  development_phase: z.string().min(1, 'development_phase is required'),
  therapeutic_area: z.string().optional().default('oncology'),
  indication_category: z.string().optional().nullable(),
  indication_specific: z.string().optional().nullable(),
  territory_scope: z.string().optional().nullable(),
  territories_included: z.array(z.string()).optional().nullable(),
  exclusivity_type: z.string().optional().nullable(),
  deal_type: z.string().optional().nullable(),
  includes_manufacturing: z.boolean().optional().default(false),
  includes_codev: z.boolean().optional().default(false),
  includes_copromote: z.boolean().optional().default(false),
  session_id: z.string().optional().nullable(),
  anonymous_id: z.string().optional().nullable(),
  outputs: z.object({
    upfront_low: z.number().optional().nullable(),
    upfront_mid: z.number().optional().nullable(),
    upfront_high: z.number().optional().nullable(),
    milestones_total: z.number().optional().nullable(),
    royalty_low: z.number().optional().nullable(),
    royalty_high: z.number().optional().nullable(),
    total_deal_value_low: z.number().optional().nullable(),
    total_deal_value_high: z.number().optional().nullable(),
  }).optional().nullable(),
}).passthrough(); // Allow extra fields without breaking

// Report email request
export const reportEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  pdfBase64: z.string().min(1, 'PDF data is required'),
  fileName: z.string()
    .min(1, 'Filename is required')
    .transform(name => name.replace(/[^a-zA-Z0-9._\-() ]/g, '_')), // Sanitize
  indication: z.string().optional().default(''),
});

/**
 * Parse + clamp an integer query parameter.
 * Prevents DoS via ?limit=999999999 and ensures sane defaults.
 */
export function clampInt(value: string | null | undefined, min: number, max: number, fallback: number): number {
  if (value == null) return fallback;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Hash an email for safe storage in analytics/events.
 * Uses Web Crypto API (available in Node 18+ and Edge Runtime).
 */
export async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
