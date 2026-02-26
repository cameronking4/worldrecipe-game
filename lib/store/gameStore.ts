import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  TimeOfDay,
  InteractionPrompt,
  DialogueState,
  DialogueNode,
  WorldRecipe,
  RegionSpec,
} from '@/types/game';

// ============================================
// Game Store - Core game state management
// ============================================

interface GameState {
  // Game status
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  
  // Time system
  timeOfDay: TimeOfDay;
  dayNumber: number;
  gameTimeSeconds: number;
  playTimeSeconds: number;
  
  // World data
  world: WorldRecipe | null;
  currentRegionId: string | null;
  currentRegion: RegionSpec | null;
  
  // UI state
  interactionPrompt: InteractionPrompt;
  dialogueState: DialogueState;
  showJournal: boolean;
  showCooking: boolean;
  showInventory: boolean;
  
  // Actions
  setIsPlaying: (playing: boolean) => void;
  setPaused: (paused: boolean) => void;
  setLoading: (loading: boolean) => void;
  
  setWorld: (world: WorldRecipe) => void;
  setCurrentRegion: (regionId: string) => void;
  
  advanceTime: (deltaSeconds: number) => void;
  setTimeOfDay: (time: TimeOfDay) => void;
  
  showInteractionPrompt: (text: string, targetId?: string, targetType?: 'npc' | 'item' | 'poi') => void;
  hideInteractionPrompt: () => void;
  
  startDialogue: (npcId: string, initialNode: DialogueNode) => void;
  advanceDialogue: (nextNode: DialogueNode) => void;
  endDialogue: () => void;
  
  toggleJournal: () => void;
  toggleCooking: () => void;
  toggleInventory: () => void;
  closeAllPanels: () => void;
  
  reset: () => void;
}

const initialState = {
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  
  timeOfDay: 'morning' as TimeOfDay,
  dayNumber: 1,
  gameTimeSeconds: 0, // 0 = 6:00 AM
  playTimeSeconds: 0,
  
  world: null,
  currentRegionId: null,
  currentRegion: null,
  
  interactionPrompt: {
    visible: false,
    text: '',
    targetId: undefined,
    targetType: undefined,
  },
  
  dialogueState: {
    active: false,
    currentNpcId: undefined,
    currentNode: undefined,
    history: [],
  },
  
  showJournal: false,
  showCooking: false,
  showInventory: false,
};

// Time constants (game time in seconds)
const DAY_LENGTH_SECONDS = 24 * 60; // 24 minutes real time = 1 game day
const TIME_PHASES: { start: number; end: number; phase: TimeOfDay }[] = [
  { start: 0, end: 6 * 60, phase: 'morning' },    // 6:00 AM - 12:00 PM (0-360 seconds)
  { start: 6 * 60, end: 12 * 60, phase: 'day' },  // 12:00 PM - 6:00 PM (360-720 seconds)
  { start: 12 * 60, end: 18 * 60, phase: 'evening' }, // 6:00 PM - 12:00 AM (720-1080 seconds)
  { start: 18 * 60, end: 24 * 60, phase: 'night' },   // 12:00 AM - 6:00 AM (1080-1440 seconds)
];

function getTimeOfDay(gameTimeSeconds: number): TimeOfDay {
  const normalizedTime = gameTimeSeconds % DAY_LENGTH_SECONDS;
  for (const phase of TIME_PHASES) {
    if (normalizedTime >= phase.start && normalizedTime < phase.end) {
      return phase.phase;
    }
  }
  return 'morning';
}

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setPaused: (paused) => set({ isPaused: paused }),
    setLoading: (loading) => set({ isLoading: loading }),
    
    setWorld: (world) => {
      const firstRegion = world.regions[0];
      set({
        world,
        currentRegionId: firstRegion?.regionId ?? null,
        currentRegion: firstRegion ?? null,
      });
    },
    
    setCurrentRegion: (regionId) => {
      const { world } = get();
      if (!world) return;
      
      const region = world.regions.find(r => r.regionId === regionId);
      if (region) {
        set({ currentRegionId: regionId, currentRegion: region });
      }
    },
    
    advanceTime: (deltaSeconds) => {
      const { gameTimeSeconds, dayNumber, isPaused } = get();
      if (isPaused) return;
      
      const newGameTime = gameTimeSeconds + deltaSeconds;
      const newDayNumber = dayNumber + Math.floor(newGameTime / DAY_LENGTH_SECONDS);
      const normalizedTime = newGameTime % DAY_LENGTH_SECONDS;
      const newTimeOfDay = getTimeOfDay(normalizedTime);
      
      set({
        gameTimeSeconds: normalizedTime,
        dayNumber: newDayNumber,
        timeOfDay: newTimeOfDay,
        playTimeSeconds: get().playTimeSeconds + deltaSeconds,
      });
    },
    
    setTimeOfDay: (time) => set({ timeOfDay: time }),
    
    showInteractionPrompt: (text, targetId, targetType) => set({
      interactionPrompt: { visible: true, text, targetId, targetType },
    }),
    
    hideInteractionPrompt: () => set({
      interactionPrompt: { visible: false, text: '', targetId: undefined, targetType: undefined },
    }),
    
    startDialogue: (npcId, initialNode) => set({
      dialogueState: {
        active: true,
        currentNpcId: npcId,
        currentNode: initialNode,
        history: [initialNode],
      },
      isPaused: true,
    }),
    
    advanceDialogue: (nextNode) => set((state) => ({
      dialogueState: {
        ...state.dialogueState,
        currentNode: nextNode,
        history: [...state.dialogueState.history, nextNode],
      },
    })),
    
    endDialogue: () => set({
      dialogueState: {
        active: false,
        currentNpcId: undefined,
        currentNode: undefined,
        history: [],
      },
      isPaused: false,
    }),
    
    toggleJournal: () => set((state) => ({
      showJournal: !state.showJournal,
      showCooking: false,
      showInventory: false,
    })),
    
    toggleCooking: () => set((state) => ({
      showCooking: !state.showCooking,
      showJournal: false,
      showInventory: false,
    })),
    
    toggleInventory: () => set((state) => ({
      showInventory: !state.showInventory,
      showJournal: false,
      showCooking: false,
    })),
    
    closeAllPanels: () => set({
      showJournal: false,
      showCooking: false,
      showInventory: false,
    }),
    
    reset: () => set(initialState),
  }))
);

