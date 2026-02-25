'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ============================================
// Animated Background
// ============================================
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1a] via-[#121228] to-[#1a0a2a]" />

      {/* Animated grid lines */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,50,50,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,50,50,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            animation: 'gridScroll 20s linear infinite',
          }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: ['#FF4444', '#44AAFF', '#FFAA44', '#44FF44', '#FF44FF'][Math.floor(Math.random() * 5)],
              opacity: 0.3 + Math.random() * 0.4,
              animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/70" />
    </div>
  );
}

// ============================================
// Logo
// ============================================
function Logo() {
  return (
    <div className="text-center mb-8 animate-in fade-in slide-in-from-top duration-700">
      <div className="inline-block mb-4">
        <div className="text-6xl relative">
          <span className="relative z-10">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="8" y="24" width="48" height="16" rx="2" fill="#FF4444" opacity="0.8"/>
              <rect x="26" y="8" width="12" height="48" rx="2" fill="#FF4444" opacity="0.8"/>
              <circle cx="32" cy="32" r="4" fill="#FFFFFF"/>
              <rect x="4" y="4" width="56" height="56" rx="8" stroke="#FF4444" strokeWidth="2" fill="none" opacity="0.4"/>
            </svg>
          </span>
        </div>
      </div>
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
        <span className="bg-gradient-to-r from-[#FF4444] via-[#FF8844] to-[#FFAA44] bg-clip-text text-transparent">
          AI Arena
        </span>
      </h1>
      <p className="text-xl text-white/60 mt-3 font-medium tracking-wide">
        AI-Generated First Person Combat
      </p>
    </div>
  );
}

// ============================================
// Feature Card
// ============================================
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:border-red-500/50 transition-all duration-300 hover:scale-105">
      <CardContent className="p-4 text-center">
        <div className="text-2xl mb-2">{icon}</div>
        <h3 className="font-semibold text-white text-sm">{title}</h3>
        <p className="text-xs text-white/50 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

// ============================================
// Mission Card
// ============================================
function MissionCard({
  name,
  theme,
  difficulty,
  description,
  selected,
  onClick,
}: {
  name: string;
  theme: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'nightmare';
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  const difficultyColors = {
    easy: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    hard: 'bg-red-500/20 text-red-400 border-red-500/30',
    nightmare: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  const themeIcons: Record<string, string> = {
    industrial: 'Factory',
    ruins: 'Ruins',
    neon_city: 'Neon',
    frozen: 'Frozen',
    volcanic: 'Volcanic',
    forest: 'Forest',
    space_station: 'Space',
  };

  return (
    <Card
      className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
        selected
          ? 'ring-2 ring-red-500 bg-red-500/10 border-red-500/50'
          : 'bg-white/5 backdrop-blur-sm border-white/10 hover:border-red-500/30'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 font-bold text-xs">
            {themeIcons[theme] || theme}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">{name}</h3>
            <p className="text-xs text-white/50">{description}</p>
          </div>
          <Badge className={`${difficultyColors[difficulty]} border`} variant="secondary">
            {difficulty}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Main Menu
// ============================================
export default function MainMenu() {
  const router = useRouter();
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const missions = [
    {
      id: 'industrial_assault',
      name: 'Industrial Assault',
      theme: 'industrial',
      difficulty: 'medium' as const,
      description: 'Clear rogue AI from an abandoned factory',
    },
    {
      id: 'neon_showdown',
      name: 'Neon Showdown',
      theme: 'neon_city',
      difficulty: 'hard' as const,
      description: 'High-tech combat in a cyberpunk arena',
    },
    {
      id: 'frozen_outpost',
      name: 'Frozen Outpost',
      theme: 'frozen',
      difficulty: 'easy' as const,
      description: 'Defend the arctic research station',
    },
    {
      id: 'volcanic_core',
      name: 'Volcanic Core',
      theme: 'volcanic',
      difficulty: 'nightmare' as const,
      description: 'Survive the inferno of the core reactor',
    },
  ];

  const handleStartGame = () => {
    setIsLoading(true);
    const mission = missions.find((m) => m.id === selectedMission);
    const missionName = mission?.name || 'Training Grounds';
    const difficulty = mission?.difficulty || 'medium';
    const theme = mission?.theme || 'industrial';
    router.push(
      `/game?mission=${encodeURIComponent(missionName)}&difficulty=${difficulty}&theme=${theme}`
    );
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 relative">
      <AnimatedBackground />

      <div className="max-w-4xl w-full space-y-8">
        <Logo />

        {/* Feature highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom duration-700 delay-200">
          <FeatureCard
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>}
            title="FPS Combat"
            description="Intense first-person action"
          />
          <FeatureCard
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#44AAFF" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>}
            title="AI Generated"
            description="Every mission is unique"
          />
          <FeatureCard
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFAA44" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
            title="Wave Combat"
            description="Progressive enemy waves"
          />
          <FeatureCard
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#44FF44" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/></svg>}
            title="Weapons"
            description="AI-designed arsenal"
          />
        </div>

        {/* Mission selection */}
        <Card className="bg-white/5 backdrop-blur-sm border-white/10 animate-in fade-in slide-in-from-bottom duration-700 delay-300">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Select Mission</CardTitle>
            <CardDescription className="text-white/50">
              Choose your arena - AI will generate enemies, weapons, and waves
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {missions.map((mission) => (
                <MissionCard
                  key={mission.id}
                  {...mission}
                  selected={selectedMission === mission.id}
                  onClick={() => setSelectedMission(mission.id)}
                />
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                size="lg"
                className="flex-1 h-14 text-lg font-semibold bg-red-600 hover:bg-red-700 text-white"
                disabled={!selectedMission || isLoading}
                onClick={handleStartGame}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating Mission...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">Deploy</span>
                )}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 border-white/20 text-white hover:bg-white/10"
                onClick={() => router.push('/game')}
              >
                Quick Play
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-white/40 animate-in fade-in duration-700 delay-500">
          <p>WASD to move | Mouse to aim | Click to shoot | R to reload | ESC to pause</p>
          <p className="mt-2 text-xs opacity-60">
            Powered by AI-generated content | Built with Next.js & React Three Fiber
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes gridScroll {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 60px); }
        }
      `}</style>
    </main>
  );
}
