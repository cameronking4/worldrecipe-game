import { NextResponse } from 'next/server';
import { gateway } from '@ai-sdk/gateway';
import { generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

const radioRequestSchema = z.object({
  trigger: z.enum([
    'welcome',
    'mission_start',
    'first_blood',
    'wave_cleared',
    'low_health',
    'out_of_ammo',
    'mission_complete',
    'mission_failed',
    'player_message',
  ]),
  callsign: z
    .string()
    .min(2)
    .max(24)
    .regex(/^[A-Za-z0-9_-]+$/, 'callsign must be alphanumeric'),
  difficulty: z.enum(['rookie', 'veteran', 'nightmare']),
  note: z.string().max(280).optional(),
  stats: z.object({
    wave: z.number().int().min(1).max(10),
    kills: z.number().int().min(0).max(999),
    health: z.number().int().min(0).max(100),
    armor: z.number().int().min(0).max(100),
    ammo: z.number().int().min(0).max(200),
    reserveAmmo: z.number().int().min(0).max(800),
    enemiesRemaining: z.number().int().min(0).max(200),
    timeLeft: z.number().int().min(0).max(9999),
  }),
});

const radioResponseSchema = z.object({
  line: z.string().min(8).max(180),
  objective: z.string().min(6).max(80),
  mood: z.enum(['calm', 'alert', 'urgent', 'critical', 'victory']),
});

const SYSTEM_PROMPT = `
You are COMMAND-9, tactical mission control for a stylish sci-fi FPS training sim.
Write concise radio chatter for the player.

Rules:
- Keep lines short, punchy, and actionable.
- Avoid gore or explicit violence.
- Adapt tone to trigger and player status.
- Mention the callsign naturally when useful.
- Include one concrete objective update.
- Never roleplay as the player.
- Respond only with valid JSON matching the schema.
`;

function buildPrompt(input: z.infer<typeof radioRequestSchema>) {
  const { trigger, callsign, difficulty, note, stats } = input;
  return `
Trigger: ${trigger}
Callsign: ${callsign}
Difficulty: ${difficulty}
Player note: ${note ?? 'None'}
Current stats:
- Wave: ${stats.wave}
- Kills: ${stats.kills}
- Health: ${stats.health}
- Armor: ${stats.armor}
- Ammo: ${stats.ammo}
- Reserve ammo: ${stats.reserveAmmo}
- Enemies remaining: ${stats.enemiesRemaining}
- Time left (seconds): ${stats.timeLeft}

Generate one radio line and one objective line.
`;
}

function fallback(input: z.infer<typeof radioRequestSchema>) {
  const { trigger, callsign, stats } = input;

  const presets: Record<z.infer<typeof radioRequestSchema>['trigger'], { line: string; objective: string; mood: z.infer<typeof radioResponseSchema>['mood'] }> = {
    welcome: {
      line: `COMMAND-9 online. ${callsign}, prep for close-quarters sweep.`,
      objective: 'Tune loadout and deploy to the arena.',
      mood: 'calm',
    },
    mission_start: {
      line: `${callsign}, you are greenlit. Sweep sector and control the lane angles.`,
      objective: 'Neutralize active hostiles in the current wave.',
      mood: 'alert',
    },
    first_blood: {
      line: `Confirmed hit. Keep pressure and avoid tunnel vision.`,
      objective: 'Rotate through cover and maintain momentum.',
      mood: 'alert',
    },
    wave_cleared: {
      line: `Wave secured. Recenter, reload, and prepare for the next push.`,
      objective: 'Hold midline before the next spawn arrives.',
      mood: 'calm',
    },
    low_health: {
      line: `Vitals are critical, ${callsign}. Break contact and recover spacing.`,
      objective: 'Use hard cover and avoid open lanes.',
      mood: 'critical',
    },
    out_of_ammo: {
      line: `You are dry on primary ammo. Transition carefully and conserve shots.`,
      objective: 'Find a safe reload window immediately.',
      mood: 'urgent',
    },
    mission_complete: {
      line: `Arena clear. Excellent execution, ${callsign}.`,
      objective: 'Extract and review combat telemetry.',
      mood: 'victory',
    },
    mission_failed: {
      line: `Mission timeout or operator down. We reset and run it cleaner.`,
      objective: 'Re-deploy with tighter movement discipline.',
      mood: 'urgent',
    },
    player_message: {
      line: `Copy your transmission. Stay adaptive and keep your lanes controlled.`,
      objective: 'Prioritize threats nearest your position.',
      mood: 'alert',
    },
  };

  const preset = presets[trigger];
  const lowHealthOverride = stats.health <= 20 ? 'critical' : preset.mood;

  return {
    line: preset.line,
    objective: preset.objective,
    mood: lowHealthOverride,
  };
}

export async function POST(request: Request) {
  const rawPayload = await request.json();
  const parsedPayload = radioRequestSchema.safeParse(rawPayload);

  if (!parsedPayload.success) {
    return NextResponse.json(
      { error: 'Invalid radio payload', details: parsedPayload.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsedPayload.data;

  try {
    const { object } = await generateObject({
      model: gateway('openai/gpt-4o-mini'),
      schema: radioResponseSchema,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(payload),
      temperature: 0.75,
    });

    return NextResponse.json(object);
  } catch {
    return NextResponse.json({
      ...fallback(payload),
      fallback: true,
    });
  }
}
