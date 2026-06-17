import { NextRequest } from 'next/server';
import { requireTeamMember } from '@/lib/portfolio/auth';
import { isScalePlus } from '@/lib/portfolio/feature-gates';
import { createServiceClient } from '@/lib/supabase/server';
import { generateReportHTML } from '@/lib/report';
import { renderPDFBuffer } from '@/lib/report/server-renderer';
import { apiError } from '@/lib/api-response';
import type { PDFReportData, BrandConfig } from '@/lib/report/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTeamMember(request);
    if ('error' in auth) return auth.error;

    const { user, teamId } = auth;
    const supabase = createServiceClient();

    // Fetch team to check tier and get branding
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('name, logo_url, primary_color, secondary_color, disclaimer_text, portfolio_sub_tier')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return apiError('Team not found', 404);
    }

    if (!isScalePlus(team.portfolio_sub_tier)) {
      return apiError('White-label reports require Scale or Enterprise tier', 403);
    }

    const body = await request.json();
    const { reportData } = body as { reportData: PDFReportData };

    if (!reportData?.result || !reportData?.inputs) {
      return apiError('Report data with result and inputs is required', 400);
    }

    // Build brand config from team settings
    const brandConfig: BrandConfig = {
      fundName: team.name,
      logoUrl: team.logo_url || undefined,
      primaryColor: team.primary_color || '#0f172a',
      secondaryColor: team.secondary_color || '#14b8a6',
      disclaimerText: team.disclaimer_text || undefined,
    };

    // Generate HTML then render to PDF
    const html = generateReportHTML(reportData, brandConfig);
    const pdfBuffer = await renderPDFBuffer(html);

    // Audit event (fire-and-forget)
    supabase.from('events').insert({
      user_id: user.id,
      event_type: 'portfolio_report_generated',
      event_data: {
        team_id: teamId,
        therapeutic_area: reportData.inputs.therapeuticArea,
        modality: reportData.inputs.modality,
        phase: reportData.inputs.phase,
        format: 'pdf',
        pdf_size_bytes: pdfBuffer.length,
        white_label: true,
      },
      user_tier: 'portfolio',
    }).then(({ error }) => {
      if (error) console.error('Audit event error:', error.message);
    });

    const indication = reportData.result.labels.indication || 'analysis';
    const safeIndication = indication.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();

    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeIndication}-deal-report.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Portfolio report generation error:', error);
    return apiError('Failed to generate white-label report', 500);
  }
}
