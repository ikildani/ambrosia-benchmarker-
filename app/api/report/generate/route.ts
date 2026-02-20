import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { createServiceClient } from '@/lib/supabase/server';
import { generateReportHTML } from '@/lib/report';
import { renderPDFBuffer } from '@/lib/report/server-renderer';
import type { PDFReportData } from '@/lib/report/types';

// Server-side PDF generation endpoint
// Requires: Pro tier OR active report purchase
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authUser = await getAuthenticatedUser(request);
    const userId = authUser?.id || null;
    const userEmail = authUser?.email || null;

    const body = await request.json();
    const { reportData, reportPurchaseId } = body as {
      reportData: PDFReportData;
      reportPurchaseId?: string;
    };

    if (!reportData?.result || !reportData?.inputs) {
      return NextResponse.json(
        { error: 'Report data with result and inputs is required' },
        { status: 400 }
      );
    }

    // Verify access: must be Pro tier or have a valid report purchase
    const supabase = createServiceClient();
    let hasAccess = false;

    if (userId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', userId)
        .single();

      if (profile?.tier === 'pro') {
        hasAccess = true;
      }
    }

    if (!hasAccess && reportPurchaseId) {
      const { data: purchase } = await supabase
        .from('report_purchases')
        .select('status')
        .eq('id', reportPurchaseId)
        .single();

      if (purchase?.status === 'completed') {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Pro subscription or report purchase required' },
        { status: 403 }
      );
    }

    // Generate HTML from report data
    const html = generateReportHTML(reportData);

    // Render to PDF via headless Chromium
    const pdfBuffer = await renderPDFBuffer(html);

    // Track the generation event
    supabase.from('events').insert({
      user_id: userId,
      event_type: 'report_generated_server',
      event_data: {
        therapeutic_area: reportData.inputs.therapeuticArea,
        modality: reportData.inputs.modality,
        phase: reportData.inputs.phase,
        format: 'pdf',
        pdf_size_bytes: pdfBuffer.length,
      },
      user_tier: hasAccess ? 'pro' : 'free',
    }).then(({ error }) => {
      if (error) console.error('Event tracking error:', error.message);
    });

    // Return PDF binary
    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ambrosia-deal-report-${
          reportData.result.labels.indication || 'analysis'
        }.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Server PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF report. Please try the browser print option.' },
      { status: 500 }
    );
  }
}
