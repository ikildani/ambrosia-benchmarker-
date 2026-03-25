import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { timingSafeEqual } from 'crypto';
import { nanoid } from 'nanoid';
import { calculateDealTerms, type CalculationInput } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/outreach-report
 *
 * Generates a shared calculation link for outreach emails.
 * Takes minimal asset profile inputs, runs the calculation engine,
 * and creates a public share link.
 *
 * Auth: Bearer $ADMIN_API_KEY or Bearer $CRON_SECRET
 *
 * Body: {
 *   therapeuticArea: string,
 *   modality: string,
 *   phase: string,
 *   indication: string,
 *   territory?: string,        // defaults to 'global'
 *   dealType?: string,          // defaults to 'licensing'
 *   recipientName?: string,     // for tracking
 *   recipientCompany?: string,  // for tracking
 * }
 *
 * Returns: { shareUrl, shareToken, recipientName, recipientCompany }
 */
export async function POST(request: NextRequest) {
  // Accept either ADMIN_API_KEY or CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  let cronAuthed = false;

  if (cronSecret && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const isValidLength = token.length === cronSecret.length;
    const tokenToCompare = isValidLength ? token : cronSecret;
    cronAuthed = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(cronSecret));
  }

  if (!cronAuthed) {
    const authError = await verifyAdminAuth(request);
    if (authError) return authError;
  }

  try {
    const body = await request.json();
    const {
      therapeuticArea,
      modality,
      phase,
      indication,
      territory = 'global',
      dealType = 'licensing',
      recipientName,
      recipientCompany,
    } = body;

    if (!therapeuticArea || !modality || !phase || !indication) {
      return NextResponse.json(
        { error: 'Required: therapeuticArea, modality, phase, indication' },
        { status: 400 }
      );
    }

    // Build calculation input with sensible defaults
    const input: CalculationInput = {
      therapeuticArea,
      phase,
      modality,
      indication,
      territory,
      dealType,
      biomarker: 'unselected',
      lineOfTherapy: '1L',
      treatmentApproach: 'diseaseModifying',
      combinationPotential: 'some',
      competitivePosition: 'firstInClass',
      dataQuality: 'strongPhase2',
      regulatoryDesignations: {
        breakthrough: false,
        fastTrack: false,
        orphan: false,
        prime: false,
      },
    };

    // Run the calculation engine
    const result = calculateDealTerms(input);

    // Build labels for display
    const labels = {
      phase: phase.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      modality: modality.replace(/([A-Z])/g, ' $1').replace(/^./, (c: string) => c.toUpperCase()).trim(),
      indication: indication.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      therapeuticArea: therapeuticArea.replace(/([A-Z])/g, ' $1').replace(/^./, (c: string) => c.toUpperCase()).trim(),
    };

    // Create shared calculation
    const supabase = createServiceClient();
    const shareToken = nanoid(12);

    // Use the admin user ID (ikildani) or null
    const { data: adminUser } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', 'ikildani@ambrosiaventures.co')
      .single();

    const { error: insertError } = await supabase
      .from('shared_calculations')
      .insert({
        share_token: shareToken,
        user_id: adminUser?.id || null,
        email: 'ikildani@ambrosiaventures.co',
        inputs: input,
        results: result,
        labels,
        is_public: true,
        expires_at: null, // Never expires for outreach
      });

    if (insertError) {
      console.error('Error creating outreach share:', insertError);
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
    }

    const shareUrl = `https://calculator.ambrosiaventures.co/share/${shareToken}`;

    return NextResponse.json({
      success: true,
      shareUrl,
      shareToken,
      recipientName: recipientName || null,
      recipientCompany: recipientCompany || null,
      summary: {
        upfrontMedian: result.terms.upfront.median,
        totalDealValueMedian: result.terms.totalDealValue.median,
        phase: labels.phase,
        modality: labels.modality,
      },
    });
  } catch (error) {
    console.error('Outreach report error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
