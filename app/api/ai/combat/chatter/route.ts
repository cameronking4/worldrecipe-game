import { NextResponse } from 'next/server';
import { gateway } from '@ai-sdk/gateway';
import { generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 20;

const combatChatterSchema = z.object({
  line: z.string().min(8).max(140),
  mood: z.enum(['calm', 'urgent', 'hype']),
});

interface CombatChatterRequest {
  eventType: 'enemy_down' | 'player_hit' | 'low_ammo' | 'critical_health' | 'reloaded';
  context?: {
    dishName?: string;
    regionName?: string;
    kills?: number;
    health?: number;
    ammo?: number;
  };
}

export async function POST(request: Request) {
  try {
    const body: CombatChatterRequest = await request.json();

    if (!body.eventType) {
      return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
    }

    const prompt = [
      'Generate one short in-world tactical radio line for a cozy-styled FPS game called World Recipe.',
      `Event: ${body.eventType}`,
      `Region: ${body.context?.regionName || 'unknown'}`,
      `Dish mission: ${body.context?.dishName || 'field operation'}`,
      `Kills: ${body.context?.kills ?? 0}, Health: ${body.context?.health ?? 0}, Ammo: ${body.context?.ammo ?? 0}`,
      'Tone must stay playful and non-gory, like high-energy kitchen adventure comms.',
      'No profanity. No real-world military references.',
    ].join('\n');

    const { object } = await generateObject({
      model: gateway('openai/gpt-4o-mini'),
      schema: combatChatterSchema,
      system:
        'You write compact dynamic radio chatter for gameplay feedback. Keep it fun, readable, and action-oriented.',
      prompt,
      temperature: 0.9,
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error('Combat chatter generation error:', error);

    const fallback: Record<string, { line: string; mood: 'calm' | 'urgent' | 'hype' }> = {
      enemy_down: { line: 'Nice shot, Chef. One less spice wisp in the pantry lane.', mood: 'hype' },
      player_hit: { line: 'You are taking heat. Strafe and reset your angle.', mood: 'urgent' },
      low_ammo: { line: 'Magazine is nearly empty. Reload before the next push.', mood: 'urgent' },
      critical_health: { line: 'Critical condition. Break contact and recover now.', mood: 'urgent' },
      reloaded: { line: 'Fresh mag locked. You are good to re-engage.', mood: 'calm' },
    };

    return NextResponse.json(fallback.enemy_down);
  }
}
