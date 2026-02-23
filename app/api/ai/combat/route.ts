import { NextResponse } from 'next/server';
import { gateway } from '@ai-sdk/gateway';
import { generateObject } from 'ai';
import { combatDirectorBeatSchema } from '@/lib/ai/schemas';
import { COMBAT_DIRECTOR_PROMPT, buildCombatDirectorPrompt } from '@/lib/ai/prompts';

export const maxDuration = 20;

interface CombatBeatRequest {
  event: 'spawn' | 'kill' | 'low_health';
  regionId: string;
  dishName?: string;
  killCount: number;
  playerHealth: number;
  activeQuestTitles?: string[];
}

export async function POST(request: Request) {
  try {
    const body: CombatBeatRequest = await request.json();

    if (!body.event || !body.regionId) {
      return NextResponse.json({ error: 'event and regionId are required' }, { status: 400 });
    }

    const prompt = buildCombatDirectorPrompt(body);

    const { object } = await generateObject({
      model: gateway('openai/gpt-4o-mini'),
      schema: combatDirectorBeatSchema,
      system: COMBAT_DIRECTOR_PROMPT,
      prompt,
      temperature: 0.7,
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Combat director error:', error);

    return NextResponse.json({
      line: 'Director AI: Stay sharp, gather supplies, and keep the route clear.',
      mood: 'steady',
      suggestedObjective: 'Clear nearby hostiles and continue your current quest.',
      fallback: true,
    });
  }
}
