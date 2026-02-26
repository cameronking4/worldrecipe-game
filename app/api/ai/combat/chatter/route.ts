import { NextResponse } from 'next/server';
import { gateway } from '@ai-sdk/gateway';
import { generateObject } from 'ai';
import { combatChatterSchema } from '@/lib/ai/schemas';
import { COMBAT_CHATTER_SYSTEM_PROMPT, buildCombatChatterPrompt } from '@/lib/ai/prompts';
import { db } from '@/lib/db/client';
import { worlds } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const maxDuration = 20;

interface CombatChatterRequest {
  worldId: string;
  regionId?: string;
  timeOfDay: string;
  eventType: 'kill' | 'critical' | 'streak' | 'objective';
  playerState: {
    kills: number;
    score: number;
    health: number;
  };
}

export async function POST(request: Request) {
  try {
    const body: CombatChatterRequest = await request.json();

    if (!body.worldId || !body.timeOfDay || !body.eventType) {
      return NextResponse.json({ error: 'worldId, timeOfDay, and eventType are required' }, { status: 400 });
    }

    const world = await db.query.worlds.findFirst({
      where: eq(worlds.worldId, body.worldId),
    });

    const worldData = world ? JSON.parse(world.worldJson) : null;
    const regionName = body.regionId && worldData
      ? worldData.regions?.find((r: { regionId: string; name: string }) => r.regionId === body.regionId)?.name
      : undefined;

    const prompt = buildCombatChatterPrompt({
      regionName,
      timeOfDay: body.timeOfDay,
      eventType: body.eventType,
      kills: body.playerState.kills,
      score: body.playerState.score,
      health: body.playerState.health,
    });

    const { object } = await generateObject({
      model: gateway('openai/gpt-4o-mini'),
      schema: combatChatterSchema,
      system: COMBAT_CHATTER_SYSTEM_PROMPT,
      prompt,
      temperature: 0.8,
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Combat chatter generation error:', error);

    return NextResponse.json({
      speaker: 'Kitchen Ops',
      line: 'Nice shot. Stay mobile and keep pressure on the spirits.',
      mood: 'hype',
      fallback: true,
    });
  }
}
