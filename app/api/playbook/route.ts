import { NextResponse } from 'next/server';
import { getPlaybookGenerator, PlaybookInput, NegotiationPlaybook } from '@/lib/ai/playbook-generator';

export interface PlaybookRequest {
  inputs: {
    modality: string;
    phase: string;
    indication: string;
    territory: string;
  };
  results: PlaybookInput['results'];
  labels: {
    phase: string;
    modality: string;
    indication: string;
  };
}

export interface PlaybookResponse {
  success: boolean;
  playbook?: NegotiationPlaybook;
  error?: string;
}

export async function POST(request: Request): Promise<NextResponse<PlaybookResponse>> {
  try {
    const body = (await request.json()) as PlaybookRequest;

    // Validate required fields
    if (!body.inputs || !body.results || !body.labels) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: inputs, results, labels' },
        { status: 400 }
      );
    }

    // Validate inputs structure
    if (!body.inputs.modality || !body.inputs.phase || !body.inputs.indication || !body.inputs.territory) {
      return NextResponse.json(
        { success: false, error: 'Invalid inputs: modality, phase, indication, and territory are required' },
        { status: 400 }
      );
    }

    // Validate results structure
    if (!body.results.terms || !body.results.tieredRoyalties || !body.results.dealRecommendation) {
      return NextResponse.json(
        { success: false, error: 'Invalid results: terms, tieredRoyalties, and dealRecommendation are required' },
        { status: 400 }
      );
    }

    // Generate playbook
    const generator = getPlaybookGenerator();
    const playbook = await generator.generatePlaybook({
      inputs: body.inputs,
      results: body.results,
      labels: body.labels,
    });

    return NextResponse.json({
      success: true,
      playbook,
    });
  } catch (error) {
    console.error('Playbook generation error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error types
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json(
        { success: false, error: 'AI service configuration error' },
        { status: 500 }
      );
    }

    // Include error details for debugging
    if (error instanceof Error && error.message.includes('No JSON found')) {
      return NextResponse.json(
        { success: false, error: 'AI response format error. Retrying may help.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: `Generation failed: ${errorMessage.slice(0, 100)}` },
      { status: 500 }
    );
  }
}
