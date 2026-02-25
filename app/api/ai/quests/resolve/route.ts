import { NextResponse } from 'next/server';
import { buildQuestResolutionPrompt } from '@/lib/ai/prompts';

// ============================================
// Mission Resolution API (minimal for FPS)
// ============================================

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Simple resolution - in FPS, missions are wave-based
    return NextResponse.json({
      resolution: {
        questId: body.questId || 'unknown',
        success: true,
        message: 'Mission progress updated.',
        stateUpdates: [],
      },
    });
  } catch (error) {
    console.error('Resolution error:', error);
    return NextResponse.json({
      resolution: {
        questId: 'unknown',
        success: true,
        message: 'Progress recorded.',
        stateUpdates: [],
      },
      fallback: true,
    });
  }
}
