'use client';

import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { FPSHUD } from '@/components/ui/FPSHUD';
import { ToastContainer, AutosaveIndicator } from '@/components/ui/ToastNotifications';
import { useGameStore } from '@/lib/store/gameStore';
import { useWorldStore } from '@/lib/store/worldStore';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useSaveStore } from '@/lib/store/saveStore';
import { useNotificationStore } from '@/lib/store/notificationStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Dynamic import for Canvas3D to avoid SSR issues
const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-lg font-medium text-foreground">Loading Arena...</p>
        <p className="text-sm text-muted-foreground mt-2">Preparing for battle</p>
      </div>
    </div>
  ),
});

// ============================================
// Pause Menu
// ============================================

function PauseMenu() {
  const setPaused = useGameStore((s) => s.setPaused);
  const toggleJournal = useGameStore((s) => s.toggleJournal);
  const toggleInventory = useGameStore((s) => s.toggleInventory);
  const world = useWorldStore((s) => s.world);
  const playTimeSeconds = useGameStore((s) => s.playTimeSeconds);
  
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <Card className="w-full max-w-md bg-card/95 backdrop-blur-md animate-in zoom-in-95 duration-200">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">⏸️ Paused</CardTitle>
          {world && (
            <p className="text-sm text-muted-foreground">
              {world.dish.name} • {formatTime(playTimeSeconds)} played
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            className="w-full h-12"
            onClick={() => setPaused(false)}
          >
            ▶️ Resume
          </Button>
          <Button 
            variant="outline"
            className="w-full h-12"
            onClick={() => {
              toggleJournal();
              setPaused(false);
            }}
          >
            📔 Journal
          </Button>
          <Button 
            variant="outline"
            className="w-full h-12"
            onClick={() => {
              toggleInventory();
              setPaused(false);
            }}
          >
            🎒 Inventory
          </Button>
          <Button 
            variant="outline"
            className="w-full h-12"
            onClick={() => window.location.href = '/'}
          >
            🏠 Main Menu
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Dish Complete Ceremony
// ============================================

function DishCompleteCeremony({ onClose }: { onClose: () => void }) {
  const world = useWorldStore((s) => s.world);
  const playTimeSeconds = useGameStore((s) => s.playTimeSeconds);
  const relationships = usePlayerStore((s) => s.npcRelationships);
  
  if (!world) return null;
  
  const friendsMade = Object.values(relationships).filter((r) => r >= 5).length;
  const totalFriendship = Object.values(relationships).reduce((sum, r) => sum + r, 0);
  
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="text-center animate-in zoom-in duration-500">
        <div className="text-8xl mb-6 animate-bounce">🎉</div>
        <h1 className="text-4xl font-bold text-white mb-2">
          {world.dish.name} Complete!
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          {world.dish.tagline}
        </p>
        
        <Card className="max-w-md mx-auto bg-card/90 backdrop-blur-md mb-8">
          <CardContent className="p-6 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">{formatTime(playTimeSeconds)}</p>
              <p className="text-sm text-muted-foreground">Time Played</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">{friendsMade}</p>
              <p className="text-sm text-muted-foreground">Friends Made</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">{world.regions.length}</p>
              <p className="text-sm text-muted-foreground">Regions Visited</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">{totalFriendship}</p>
              <p className="text-sm text-muted-foreground">Total Friendship</p>
            </div>
          </CardContent>
        </Card>
        
        <div className="space-x-4">
          <Button size="lg" onClick={onClose}>
            Continue Playing
          </Button>
          <Button size="lg" variant="outline" onClick={() => window.location.href = '/'}>
            New Adventure
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Game Page Content (uses searchParams)
// ============================================

function GamePageContent() {
  const [showComplete, setShowComplete] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const hasInitialized = useRef(false);
  const searchParams = useSearchParams();
  
  const isPaused = useGameStore((s) => s.isPaused);
  const setPaused = useGameStore((s) => s.setPaused);
  const dialogueActive = false; // No dialogue in FPS mode
  const world = useWorldStore((s) => s.world);
  const setWorld = useWorldStore((s) => s.setWorld);
  const isLoading = useWorldStore((s) => s.isLoading);
  const completedSteps = usePlayerStore((s) => s.completedCookingSteps);
  
  const saveGame = useSaveStore((s) => s.saveGame);
  const loadLatestSave = useSaveStore((s) => s.loadLatestSave);
  const startAutoSave = useSaveStore((s) => s.startAutoSave);
  const stopAutoSave = useSaveStore((s) => s.stopAutoSave);
  const isSaving = useSaveStore((s) => s.isSaving);
  
  const showAutosave = useNotificationStore((s) => s.showAutosave);
  const showInfo = useNotificationStore((s) => s.showInfo);
  
  // Initialize game: load world and restore save
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    const initializeGame = async () => {
      setIsInitializing(true);
      
      // Get dish from URL params or use default
      const dishPrompt = searchParams.get('dish') || 'Simple Ramen';
      const difficulty = searchParams.get('difficulty') || 'medium';
      
      try {
        // First, generate/load the world
        const res = await fetch('/api/ai/world', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dishPrompt,
            seed: `${dishPrompt}-${Date.now()}`,
            playerPrefs: { difficulty },
          }),
        });
        
        const data = await res.json();
        
        if (data.world) {
          setWorld(data.world);
          
          // Try to load existing save for this world
          const saveLoaded = await loadLatestSave(data.world.worldId);
          
          if (saveLoaded) {
            console.log('Restored from previous save');
          } else {
            console.log('Starting new game');
            showInfo(`🍳 ${data.world.dish.name}`, data.world.dish.tagline);
          }
        } else if (data.error) {
          console.error('World generation error:', data.error);
          if (data.fallbackWorld) {
            setWorld(data.fallbackWorld);
          }
        }
      } catch (error) {
        console.error('Failed to initialize game:', error);
      } finally {
        setIsInitializing(false);
      }
    };
    
    initializeGame();
  }, [setWorld, loadLatestSave, searchParams, showInfo]);
  
  // Start autosave when playing
  useEffect(() => {
    if (world && !isInitializing) {
      // Custom autosave with notification
      const autoSaveInterval = setInterval(async () => {
        const gameState = useGameStore.getState();
        if (gameState.isPlaying && !gameState.isPaused) {
          const success = await saveGame();
          if (success) {
            showAutosave();
          }
        }
      }, 60000); // Autosave every 60 seconds
      
      // Save before page unload
      const handleBeforeUnload = () => {
        saveGame();
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      // Show welcome message
      showInfo('Welcome back!', 'Your adventure continues...');
      
      return () => {
        clearInterval(autoSaveInterval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [world, isInitializing, saveGame, showAutosave, showInfo]);
  
  // Handle escape key for pause and other shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if dialogue is active (dialogue handles its own escape)
      if (dialogueActive) return;
      
      if (e.code === 'Escape') {
        setPaused(!isPaused);
      }
      
      // Additional shortcuts when not paused
      if (!isPaused) {
        switch (e.code) {
          case 'KeyI':
            useGameStore.getState().toggleInventory();
            break;
          case 'KeyJ':
            useGameStore.getState().toggleJournal();
            break;
          case 'KeyC':
            useGameStore.getState().toggleCooking();
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, setPaused, dialogueActive]);
  
  // Check if dish is complete
  useEffect(() => {
    if (!world) return;
    
    const allStepsComplete = world.questArcs.every((arc) => 
      arc.unlocksCookingStepId && completedSteps.includes(arc.unlocksCookingStepId)
    );
    
    if (allStepsComplete && world.questArcs.length > 0 && completedSteps.length > 0) {
      setShowComplete(true);
    }
  }, [world, completedSteps]);
  
  if (isLoading || isInitializing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-lg font-medium text-foreground">
            {isInitializing ? 'Loading Your Adventure...' : 'Generating World...'}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {isInitializing ? 'Restoring your progress' : 'This may take a moment'}
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <Suspense fallback={null}>
        <GameCanvas />
      </Suspense>
      
      {/* FPS HUD */}
      <FPSHUD />

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Autosave Indicator */}
      <AutosaveIndicator />
    </main>
  );
}

// ============================================
// Main Game Page (wraps content in Suspense)
// ============================================

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-lg font-medium text-foreground">Loading Your Adventure...</p>
        </div>
      </div>
    }>
      <GamePageContent />
    </Suspense>
  );
}
