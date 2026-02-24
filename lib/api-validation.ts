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

// --- Zod schemas for API routes ---

// Deals GET query params
export const dealsQuerySchema = z.object({
  therapeutic_area: z.string().optional(),
  modality: z.string().optional(),
  phase: z.string().optional(),
  indication: z.string().optional(),
  deal_type: z.string().optional(),
  min_upfront: z.string().regex(/^\d+$/, 'min_upfront must be a number').optional(),
  max_upfront: z.string().regex(/^\d+$/, 'max_upfront must be a number').optional(),
  year_from: z.string().regex(/^\d{4}$/, 'year_from must be a 4-digit year').optional(),
  year_to: z.string().regex(/^\d{4}$/, 'year_to must be a 4-digit year').optional(),
  terms_disclosed: z.enum(['true']).optional(),
  search: z.string().max(100, 'search must be at most 100 characters').optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  sort_by: z.enum([
    'announced_date', 'upfront_usd', 'total_deal_value_usd',
    'licensor_name', 'licensee_name', 'asset_name', 'modality', 'phase_at_signing',
  ]).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
}).passthrough(); // Allow extra query params (e.g. tracking params)

// Partners match POST body
export const partnerMatchSchema = z.object({
  modality: z.string().min(1, 'modality is required'),
  development_phase: z.string().min(1, 'development_phase is required'),
  indication_category: z.string().optional().nullable(),
  indication_specific: z.string().optional().nullable(),
  territory_scope: z.string().optional().nullable(),
  therapeutic_area: z.string().optional().nullable(),
  user_id: z.string().optional().nullable(),
  user_email: z.string().optional().nullable(),
  calculation_id: z.string().optional().nullable(),
  session_id: z.string().optional().nullable(),
  anonymous_id: z.string().optional().nullable(),
  tier: z.string().optional(), // accepted but ignored (security)
}).passthrough();

// Pulse GET query params
export const pulseQuerySchema = z.object({
  history: z.enum(['true']).optional(),
  user_id: z.string().optional().nullable(),
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'week must be YYYY-MM-DD format').optional(),
}).passthrough();

// Content GET query params
export const contentQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
}).passthrough();

// Content POST body
export const contentPostSchema = z.object({
  title: z.string().min(1, 'title is required'),
  content: z.string().min(1, 'content is required'),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  meta_description: z.string().optional(),
  category: z.string().optional(),
  tags: z.unknown().optional(),
  modality: z.unknown().optional(),
  indication: z.unknown().optional(),
  ai_generated: z.boolean().optional(),
}).passthrough();

// Events POST body
export const eventSchema = z.object({
  event_type: z.string().min(1, 'event_type is required'),
  event_data: z.record(z.string(), z.unknown()).default({}),
  session_id: z.string().optional().nullable(),
  anonymous_id: z.string().optional().nullable(),
  user_id: z.string().optional().nullable(),
});

// Checkout POST body
export const checkoutSchema = z.object({
  email: z.string().email().optional(),
  purchaseType: z.enum(['subscription', 'report']).default('subscription'),
  promoCode: z.string().optional(),
  calculationData: z.object({
    inputs: z.record(z.string(), z.unknown()),
    results: z.record(z.string(), z.unknown()),
  }).optional(),
}).refine(
  (data) => data.purchaseType !== 'report' || data.calculationData,
  { message: 'calculationData is required for report purchases', path: ['calculationData'] }
);

/** Format Zod validation errors into a concise string. */
export function formatZodErrors(error: z.ZodError): string {
  return error.issues.map(i =>
    i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message
  ).join('; ');
}
