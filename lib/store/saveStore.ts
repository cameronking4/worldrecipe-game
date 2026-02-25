import { create } from 'zustand';

// ============================================
// Save Store - Minimal for FPS mode
// ============================================

interface SaveState {
  saveId: string | null;
  lastSaveTime: number | null;
  isSaving: boolean;
  isLoading: boolean;

  setSaveId: (id: string) => void;
  saveGame: () => Promise<boolean>;
  loadLatestSave: (worldId: string) => Promise<boolean>;
  startAutoSave: (intervalMs?: number) => void;
  stopAutoSave: () => void;
}

export const useSaveStore = create<SaveState>((set, get) => ({
  saveId: null,
  lastSaveTime: null,
  isSaving: false,
  isLoading: false,

  setSaveId: (id) => set({ saveId: id }),

  saveGame: async () => {
    // Save is not implemented for FPS mode yet
    return false;
  },

  loadLatestSave: async () => {
    return false;
  },

  startAutoSave: () => {},
  stopAutoSave: () => {},
}));

export function useSaveStatus() {
  const isSaving = useSaveStore((s) => s.isSaving);
  const lastSaveTime = useSaveStore((s) => s.lastSaveTime);
  return { isSaving, lastSaveTime };
}
