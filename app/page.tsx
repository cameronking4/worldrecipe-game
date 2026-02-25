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
      {/* Gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]" />
      
      {/* Floating elements */}
      <div className="absolute inset-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-20"
            style={{
              width: `${20 + Math.random() * 40}px`,
              height: `${20 + Math.random() * 40}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `linear-gradient(135deg, ${
                ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181'][Math.floor(Math.random() * 5)]
              }, transparent)`,
              animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>
      
      {/* Vignette overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/50" />
    </div>
  );
}

// ============================================
// Logo Component
// ============================================
function Logo() {
  return (
    <div className="text-center mb-8 animate-in fade-in slide-in-from-top duration-700">
      <div className="inline-block mb-4">
        <span className="text-6xl">🍳</span>
      </div>
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
        <span className="bg-gradient-to-r from-[#FF6B6B] via-[#FFE66D] to-[#4ECDC4] bg-clip-text text-transparent">
          World Recipe
        </span>
      </h1>
      <p className="text-xl text-muted-foreground mt-3 font-medium">
        A Stylized 3D AI Shooter Adventure
      </p>
    </div>
  );
}

// ============================================
// Feature Card
// ============================================
function FeatureCard({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300 hover:scale-105">
      <CardContent className="p-4 text-center">
        <span className="text-3xl block mb-2">{emoji}</span>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

// ============================================
// Dish Preview Card
// ============================================
function DishPreviewCard({ 
  name, 
  origin, 
  difficulty, 
  emoji,
  selected,
  onClick 
}: { 
  name: string; 
  origin: string; 
  difficulty: 'easy' | 'medium' | 'hard';
  emoji: string;
  selected: boolean;
  onClick: () => void;
}) {
  const difficultyColors = {
    easy: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    hard: 'bg-red-500/20 text-red-400',
  };
  
  return (
    <Card 
      className={`cursor-pointer transition-all duration-300 hover:scale-105 ${
        selected 
          ? 'ring-2 ring-primary bg-card/90 border-primary' 
          : 'bg-card/60 backdrop-blur-sm border-border/50 hover:border-primary/50'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{emoji}</span>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{name}</h3>
            <p className="text-xs text-muted-foreground">{origin}</p>
          </div>
          <Badge className={difficultyColors[difficulty]} variant="secondary">
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
  const [selectedDish, setSelectedDish] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const featuredDishes = [
    { id: 'ramen', name: 'Tonkotsu Ramen', origin: 'Japan', difficulty: 'medium' as const, emoji: '🍜' },
    { id: 'tagine', name: 'Lamb Tagine', origin: 'Morocco', difficulty: 'hard' as const, emoji: '🍲' },
    { id: 'tacos', name: 'Street Tacos', origin: 'Mexico', difficulty: 'easy' as const, emoji: '🌮' },
    { id: 'pho', name: 'Beef Pho', origin: 'Vietnam', difficulty: 'medium' as const, emoji: '🥢' },
  ];
  
  const handleStartGame = () => {
    setIsLoading(true);
    // Pass the selected dish to the game page
    const dishName = featuredDishes.find(d => d.id === selectedDish)?.name || 'Simple Ramen';
    const difficulty = featuredDishes.find(d => d.id === selectedDish)?.difficulty || 'medium';
    router.push(`/game?dish=${encodeURIComponent(dishName)}&difficulty=${difficulty}`);
  };
  
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 relative">
      <AnimatedBackground />
      
      <div className="max-w-4xl w-full space-y-8">
        <Logo />
        
        {/* Feature highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom duration-700 delay-200">
          <FeatureCard emoji="🎯" title="FPS Combat" description="Fast first-person action" />
          <FeatureCard emoji="🤖" title="AI Encounters" description="Dynamic enemy waves" />
          <FeatureCard emoji="👥" title="AI NPCs" description="Interactive dialogue & quests" />
          <FeatureCard emoji="🍳" title="Cook" description="Fight for ingredients, craft dishes" />
        </div>
        
        {/* Dish selection */}
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 animate-in fade-in slide-in-from-bottom duration-700 delay-300">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Choose Your Adventure</CardTitle>
            <CardDescription>Select a dish to begin your culinary journey</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {featuredDishes.map((dish) => (
                <DishPreviewCard
                  key={dish.id}
                  {...dish}
                  selected={selectedDish === dish.id}
                  onClick={() => setSelectedDish(dish.id)}
                />
              ))}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                size="lg"
                className="flex-1 h-14 text-lg font-semibold"
                disabled={!selectedDish || isLoading}
                onClick={handleStartGame}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating World...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    🚀 Start New Adventure
                  </span>
                )}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14"
                onClick={() => router.push('/game')}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Footer info */}
        <div className="text-center text-sm text-muted-foreground animate-in fade-in duration-700 delay-500">
          <p>🎮 Click to lock mouse • WASD move • LMB shoot • E interact</p>
          <p className="mt-2 text-xs opacity-60">
            Powered by AI-generated content • Built with Next.js & React Three Fiber
          </p>
        </div>
      </div>
    </main>
  );
}
