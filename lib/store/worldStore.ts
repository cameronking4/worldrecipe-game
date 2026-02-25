import { create } from 'zustand';

// Minimal world store - world data is now in gameStore
// This file is kept for backward compatibility with unused components

interface WorldState {
  world: null;
  isLoading: boolean;
  error: string | null;
  currentRegionId: string | null;
  currentRegion: null;
  setWorld: (world: any) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  world: null,
  isLoading: false,
  error: null,
  currentRegionId: null,
  currentRegion: null,
  setWorld: () => {},
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set({ world: null, isLoading: false, error: null }),
}));
