'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Difficulty = 'rookie' | 'veteran' | 'nightmare';
type RadioMood = 'calm' | 'alert' | 'urgent' | 'critical' | 'victory';

interface RadioResponse {
  line: string;
  objective: string;
  mood: RadioMood;
}

const DIFFICULTY_COPY: Record<Difficulty, { label: string; tempo: string; note: string; accent: string }> = {
  rookie: {
    label: 'Rookie',
    tempo: 'Low pressure',
    note: 'Longer timer, stronger armor, lower enemy damage.',
    accent: 'from-emerald-300/35 to-cyan-300/25',
  },
  veteran: {
    label: 'Veteran',
    tempo: 'Balanced tempo',
    note: 'Default FPS pacing with moderate enemy aggression.',
    accent: 'from-cyan-300/35 to-blue-300/25',
  },
  nightmare: {
    label: 'Nightmare',
    tempo: 'High pressure',
    note: 'More waves, tougher hostiles, tighter mission clock.',
    accent: 'from-orange-300/35 to-red-300/25',
  },
};

function sanitizeCallsign(raw: string) {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 16);

  return cleaned || 'RAVEN-7';
}

export default function HomePage() {
  const router = useRouter();

  const [callsign, setCallsign] = useState('RAVEN-7');
  const [difficulty, setDifficulty] = useState<Difficulty>('veteran');
  const [briefing, setBriefing] = useState('Syncing COMMAND-9 uplink...');
  const [objective, setObjective] = useState('Acquire mission packet.');
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const difficultyMeta = useMemo(() => DIFFICULTY_COPY[difficulty], [difficulty]);

  const loadBriefing = useCallback(async () => {
    setLoadingBriefing(true);

    try {
      const response = await fetch('/api/ai/fps/radio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger: 'welcome',
          callsign: sanitizeCallsign(callsign),
          difficulty,
          stats: {
            wave: 1,
            kills: 0,
            health: 100,
            armor: difficulty === 'rookie' ? 70 : difficulty === 'veteran' ? 55 : 45,
            ammo: 30,
            reserveAmmo: difficulty === 'rookie' ? 180 : difficulty === 'veteran' ? 150 : 130,
            enemiesRemaining: difficulty === 'rookie' ? 4 : difficulty === 'veteran' ? 5 : 6,
            timeLeft: difficulty === 'rookie' ? 360 : difficulty === 'veteran' ? 300 : 240,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Status ${response.status}`);
      }

      const data = (await response.json()) as RadioResponse;
      setBriefing(data.line || 'COMMAND-9 standing by.');
      setObjective(data.objective || 'Deploy and secure the arena.');
    } catch (error) {
      console.error('Failed to load briefing:', error);
      setBriefing('COMMAND-9 link unstable. Fall back to autonomous combat protocol.');
      setObjective('Deploy and clear active hostiles in every wave.');
    } finally {
      setLoadingBriefing(false);
    }
  }, [callsign, difficulty]);

  useEffect(() => {
    void loadBriefing();
  }, [loadBriefing]);

  const handleDeploy = () => {
    setDeploying(true);
    router.push(`/game?callsign=${encodeURIComponent(sanitizeCallsign(callsign))}&difficulty=${difficulty}`);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#04090f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.2),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(251,191,36,0.14),transparent_30%),linear-gradient(140deg,#04090f_0%,#061622_45%,#08111b_100%)]" />
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(34,211,238,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.08)_1px,transparent_1px)] [background-size:40px_40px]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-6 px-4 py-12 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-cyan-300/35 bg-[#07131d]/90 backdrop-blur">
            <CardHeader className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-cyan-300">New FPS Mission</p>
              <CardTitle className="text-4xl leading-tight md:text-5xl">Neon Extraction Protocol</CardTitle>
              <p className="max-w-xl text-sm text-cyan-100/85">
                Full first-person combat redesign: 3D arena movement, wave survival combat loop, and live AI mission radio powered by Vercel AI SDK + AI Gateway.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {(['rookie', 'veteran', 'nightmare'] as Difficulty[]).map((mode) => {
                  const meta = DIFFICULTY_COPY[mode];
                  const selected = difficulty === mode;

                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDifficulty(mode)}
                      className={`rounded-lg border px-3 py-3 text-left transition ${
                        selected
                          ? 'border-cyan-200 bg-cyan-950/45 shadow-[0_0_24px_rgba(34,211,238,0.25)]'
                          : 'border-cyan-300/20 bg-slate-900/45 hover:border-cyan-300/45'
                      }`}
                    >
                      <p className="font-semibold text-cyan-100">{meta.label}</p>
                      <p className="text-xs text-cyan-100/70">{meta.tempo}</p>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-cyan-300/25 bg-black/20 p-4">
                <label htmlFor="callsign" className="mb-2 block font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
                  Operator Callsign
                </label>
                <input
                  id="callsign"
                  value={callsign}
                  onChange={(event) => setCallsign(sanitizeCallsign(event.target.value))}
                  className="h-11 w-full rounded border border-cyan-300/30 bg-black/30 px-3 font-mono text-sm text-cyan-50 outline-none focus:border-cyan-200"
                />
                <p className="mt-2 text-xs text-cyan-100/65">
                  Recommended format: letters, numbers, `_` or `-` only.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="h-12 flex-1 bg-cyan-400 text-black hover:bg-cyan-300"
                  onClick={handleDeploy}
                  disabled={deploying}
                >
                  {deploying ? 'Deploying...' : 'Enter FPS Arena'}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 flex-1 border-cyan-300/35 text-cyan-100 hover:bg-cyan-950/35"
                  onClick={() => void loadBriefing()}
                  disabled={loadingBriefing}
                >
                  {loadingBriefing ? 'Refreshing...' : 'Refresh AI Briefing'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-300/35 bg-[#17110f]/90 backdrop-blur">
            <CardHeader>
              <p className="font-mono text-xs uppercase tracking-[0.26em] text-amber-300">Command Uplink</p>
              <CardTitle className="text-2xl">Live Mission Feed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`rounded-lg border border-amber-300/20 bg-gradient-to-br ${difficultyMeta.accent} p-4`}>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-100/90">AI Radio</p>
                <p className="mt-2 text-sm leading-relaxed text-amber-50">{briefing}</p>
              </div>

              <div className="rounded-lg border border-cyan-300/20 bg-cyan-950/25 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">Current Objective</p>
                <p className="mt-2 text-sm text-cyan-100">{objective}</p>
              </div>

              <div className="rounded-lg border border-cyan-300/15 bg-black/20 p-4 text-xs text-cyan-100/80">
                <p className="mb-2 font-mono uppercase tracking-[0.2em] text-cyan-300">Control Deck</p>
                <p>Movement: `W A S D`</p>
                <p>Aim + Fire: `Mouse + Left Click`</p>
                <p>Reload: `R`</p>
                <p>Pause: `Esc`</p>
              </div>

              <p className="text-xs text-amber-100/60">
                Mode profile: {difficultyMeta.note}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
