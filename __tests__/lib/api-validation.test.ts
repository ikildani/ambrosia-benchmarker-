import { z } from 'zod';
import {
  formatZodErrors,
  dealsQuerySchema,
  partnerMatchSchema,
  pulseQuerySchema,
  contentPostSchema,
  eventSchema,
  checkoutSchema,
  hashEmail,
} from '@/lib/api-validation';

// --- formatZodErrors ---

describe('formatZodErrors', () => {
  // 1. Single error: path + message
  it('formats a single field error as "path: message"', () => {
    const result = dealsQuerySchema.safeParse({ year_from: '23' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted).toBe('year_from: year_from must be a 4-digit year');
    }
  });

  // 2. Multiple errors: semicolon-separated
  it('joins multiple errors with semicolons', () => {
    const schema = z.object({
      a: z.string().min(1, 'a is required'),
      b: z.number({ error: 'b is required' }),
    });
    const result = schema.safeParse({ a: '', b: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted).toContain('; ');
      expect(formatted).toContain('a: ');
      expect(formatted).toContain('b: ');
    }
  });

  // 3. Root-level error (empty path): just message
  it('outputs only the message for root-level errors', () => {
    const schema = z.string().min(1, 'cannot be empty');
    const result = schema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted).toBe('cannot be empty');
    }
  });
});

// --- dealsQuerySchema ---

describe('dealsQuerySchema', () => {
  // 4. Valid empty object passes
  it('accepts an empty object', () => {
    const result = dealsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  // 5. Valid full params passes
  it('accepts a full set of valid parameters', () => {
    const result = dealsQuerySchema.safeParse({
      therapeutic_area: 'oncology',
      modality: 'small molecule',
      phase: 'Phase 3',
      indication: 'NSCLC',
      deal_type: 'license',
      min_upfront: '100',
      max_upfront: '5000',
      year_from: '2020',
      year_to: '2025',
      terms_disclosed: 'true',
      search: 'checkpoint',
      page: '1',
      limit: '25',
      sort_by: 'announced_date',
      sort_order: 'desc',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort_by).toBe('announced_date');
      expect(result.data.sort_order).toBe('desc');
    }
  });

  // 6. Invalid year_from (not 4 digits) fails with message
  it('rejects a year_from that is not 4 digits', () => {
    const result = dealsQuerySchema.safeParse({ year_from: '23' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues[0].message;
      expect(msg).toBe('year_from must be a 4-digit year');
    }
  });

  // 7. Invalid sort_by (not in enum) fails
  it('rejects an invalid sort_by value', () => {
    const result = dealsQuerySchema.safeParse({ sort_by: 'invalid_column' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('sort_by');
    }
  });
});

// --- partnerMatchSchema ---

describe('partnerMatchSchema', () => {
  // 8. Valid with all fields passes
  it('accepts valid input with all fields', () => {
    const result = partnerMatchSchema.safeParse({
      modality: 'antibody',
      development_phase: 'Phase 2',
      indication_category: 'solid tumors',
      indication_specific: 'NSCLC',
      territory_scope: 'worldwide',
      therapeutic_area: 'oncology',
      user_id: 'user-123',
      user_email: 'test@example.com',
      calculation_id: 'calc-456',
      session_id: 'sess-789',
      anonymous_id: 'anon-000',
      tier: 'pro',
    });
    expect(result.success).toBe(true);
  });

  // 9. Missing modality (empty string) fails
  it('rejects empty modality', () => {
    const result = partnerMatchSchema.safeParse({
      modality: '',
      development_phase: 'Phase 1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const modalityError = result.error.issues.find(
        (i) => i.path.includes('modality')
      );
      expect(modalityError).toBeDefined();
      expect(modalityError!.message).toBe('modality is required');
    }
  });

  // 10. Extra fields pass through (.passthrough())
  it('preserves extra fields via passthrough', () => {
    const result = partnerMatchSchema.safeParse({
      modality: 'ADC',
      development_phase: 'Phase 3',
      custom_field: 'should survive',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).custom_field).toBe(
        'should survive'
      );
    }
  });
});

// --- pulseQuerySchema ---

describe('pulseQuerySchema', () => {
  // 11. Valid with all params
  it('accepts valid query parameters', () => {
    const result = pulseQuerySchema.safeParse({
      history: 'true',
      user_id: 'user-123',
      week: '2025-01-06',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.week).toBe('2025-01-06');
    }
  });

  // 12. Invalid week format fails
  it('rejects an invalid week format', () => {
    const result = pulseQuerySchema.safeParse({ week: '2025-1-6' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'week must be YYYY-MM-DD format'
      );
    }
  });
});

// --- contentPostSchema ---

describe('contentPostSchema', () => {
  // 13. Valid with title + content passes
  it('accepts valid input with title and content', () => {
    const result = contentPostSchema.safeParse({
      title: 'Test Article',
      content: 'Lorem ipsum dolor sit amet.',
      slug: 'test-article',
      category: 'insights',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Test Article');
    }
  });

  // 14. Missing title fails
  it('rejects missing title', () => {
    const result = contentPostSchema.safeParse({
      content: 'Body text without a title.',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const titleError = result.error.issues.find((i) =>
        i.path.includes('title')
      );
      expect(titleError).toBeDefined();
    }
  });
});

// --- eventSchema ---

describe('eventSchema', () => {
  // 15. Valid event with defaults
  it('accepts a valid event and applies defaults', () => {
    const result = eventSchema.safeParse({
      event_type: 'page_view',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe('page_view');
      expect(result.data.event_data).toEqual({});
    }
  });

  // 16. Empty event_type fails
  it('rejects empty event_type', () => {
    const result = eventSchema.safeParse({
      event_type: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find((i) =>
        i.path.includes('event_type')
      );
      expect(error).toBeDefined();
      expect(error!.message).toBe('event_type is required');
    }
  });
});

// --- checkoutSchema ---

describe('checkoutSchema', () => {
  // 17. Subscription without calculationData passes
  it('accepts subscription without calculationData', () => {
    const result = checkoutSchema.safeParse({
      purchaseType: 'subscription',
      email: 'buyer@example.com',
    });
    expect(result.success).toBe(true);
  });

  // 18. Report without calculationData fails (refine)
  it('rejects report purchase without calculationData', () => {
    const result = checkoutSchema.safeParse({
      purchaseType: 'report',
      email: 'buyer@example.com',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = formatZodErrors(result.error);
      expect(msg).toContain('calculationData is required for report purchases');
    }
  });

  // 19. Report with calculationData passes
  it('accepts report purchase with calculationData', () => {
    const result = checkoutSchema.safeParse({
      purchaseType: 'report',
      email: 'buyer@example.com',
      calculationData: {
        inputs: { modality: 'ADC', phase: 'Phase 2' },
        results: { upfront_mid: 150 },
      },
    });
    expect(result.success).toBe(true);
  });
});

// --- hashEmail ---

describe('hashEmail', () => {
  // 20. Returns deterministic hex string
  it('returns a deterministic 64-character hex string', async () => {
    const hash1 = await hashEmail('test@example.com');
    const hash2 = await hashEmail('test@example.com');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  // 21. Normalizes case and whitespace
  it('normalizes email case and trims whitespace before hashing', async () => {
    const hashNormal = await hashEmail('test@example.com');
    const hashUpper = await hashEmail('TEST@EXAMPLE.COM');
    const hashPadded = await hashEmail('  test@example.com  ');
    expect(hashNormal).toBe(hashUpper);
    expect(hashNormal).toBe(hashPadded);
  });
});
