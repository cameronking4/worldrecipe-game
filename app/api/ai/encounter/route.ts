import { NextResponse } from 'next/server';
import { gateway } from '@ai-sdk/gateway';
import { generateObject } from 'ai';
import { encounterSchema } from '@/lib/ai/schemas';
import { ENCOUNTER_SYSTEM_PROMPT, buildEncounterPrompt } from '@/lib/ai/prompts';

export const maxDuration = 20;

interface EncounterRequest {
  dishName: string;
  regionName: string;
  regionInspiration: string;
  timeOfDay: string;
}

export async function POST(request: Request) {
  try {
    const body: EncounterRequest = await request.json();

    if (!body.dishName || !body.regionName) {
      return NextResponse.json(
        { error: 'dishName and regionName are required' },
        { status: 400 }
      );
    }

    const prompt = buildEncounterPrompt({
      dishName: body.dishName,
      regionName: body.regionName,
      regionInspiration: body.regionInspiration || 'global cuisine',
      timeOfDay: body.timeOfDay || 'day',
    });

    const { object } = await generateObject({
      model: gateway('openai/gpt-4o-mini'),
      schema: encounterSchema,
      system: ENCOUNTER_SYSTEM_PROMPT,
      prompt,
      temperature: 0.8,
    });

    return NextResponse.json({ encounter: object });
  } catch (error) {
    console.error('Encounter generation error:', error);

    return NextResponse.json({
      encounter: {
        encounterName: 'Pantry Patrol',
        mood: 'brisk',
        objectiveHint: 'Keep moving in circles and reload before your magazine is empty.',
        threatLevel: 2,
        enemies: [
          {
            enemyId: 'pepper_sprite',
            name: 'Pepper Sprite',
            taunt: 'Spice storm incoming!',
            colorHex: '#ff6b6b',
            speed: 4.8,
            health: 45,
            size: 0.9,
          },
          {
            enemyId: 'broth_guardian',
            name: 'Broth Guardian',
            taunt: 'Simmer down, chef.',
            colorHex: '#4ecdc4',
            speed: 2.7,
            health: 90,
            size: 1.25,
          },
        ],
      },
      fallback: true,
    });
  }
}
