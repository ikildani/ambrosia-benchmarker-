import { createServiceClient } from '@/lib/supabase/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import { newsletterSchema, formatZodErrors } from '@/lib/api-validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = newsletterSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const { email } = parsed.data;

    const supabase = createServiceClient();

    // Check if already subscribed
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return apiSuccess({ message: 'Already subscribed' });
    }

    // Insert new subscriber
    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email: email.toLowerCase(),
        source: 'blog',
        subscribed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Newsletter subscription error:', error);
      return apiError('Subscription failed', 500);
    }

    return apiSuccess({});
  } catch (error) {
    console.error('Newsletter error:', error);
    return apiError('Internal server error', 500);
  }
}
