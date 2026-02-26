import { create } from 'zustand';
import type { PortalBoard, PortalType, POI } from '@/types/game';
import { normalizePosition } from '@/types/game';
import { usePlayerStore } from './playerStore';
import { useWorldStore } from './worldStore';

// ============================================
// Portal Store - Portal navigation and state
// ============================================

interface PortalState {
  // Current location
  isInPortal: boolean;
  currentPortalBoardId: string | null;
  currentPortalType: PortalType | null;
  
  // Transition state
  isTransitioning: boolean;
  
  // Portal history (for return navigation)
  portalHistory: Array<{
    portalBoardId: string;
    portalType: PortalType;
    hubPortalPoiId: string; // POI ID in hub that led here
  }>;
  
  // Actions
  enterPortal: (portalPoi: POI) => Promise<boolean>;
  returnToHub: () => Promise<boolean>;
  canAccessPortal: (portalPoi: POI) => boolean;
  getCurrentPortalBoard: () => PortalBoard | null;
  setTransitioning: (transitioning: boolean) => void;
  reset: () => void;
}

const initialState = {
  isInPortal: false,
  currentPortalBoardId: null,
  currentPortalType: null,
  isTransitioning: false,
  portalHistory: [],
};

export const usePortalStore = create<PortalState>((set, get) => ({
  ...initialState,
  
  canAccessPortal: (portalPoi) => {
    // Must be a portal POI
    if (portalPoi.type !== 'portal' || !portalPoi.portalType) {
      return false;
    }
    
    // Kitchen portal requires all dish ingredients
    if (portalPoi.portalType === 'kitchen') {
      const playerStore = usePlayerStore.getState();
      const worldStore = useWorldStore.getState();
      const world = worldStore.world;
      
      if (!world) return false;
      
      // Get all required ingredients for the dish
      const requiredIngredients = portalPoi.requiredIngredients || 
        world.ingredientGraph.ingredients.map(i => i.ingredientId);
      
      // Check if player has all required ingredients
      return requiredIngredients.every(ingredientId => 
        playerStore.hasItem(ingredientId, 1)
      );
    }
    
    // All other portals are always accessible
    return true;
  },
  
  getCurrentPortalBoard: () => {
    const { currentPortalBoardId } = get();
    const worldStore = useWorldStore.getState();
    const world = worldStore.world;
    
    if (!currentPortalBoardId || !world?.portalBoards) {
      return null;
    }
    
    return world.portalBoards.find(pb => pb.boardId === currentPortalBoardId) || null;
  },
  
  enterPortal: async (portalPoi) => {
    const { isTransitioning, canAccessPortal } = get();
    
    // Prevent double-entry
    if (isTransitioning) return false;
    
    // Check access
    if (!canAccessPortal(portalPoi)) {
      return false;
    }
    
    // Must have destination board ID
    if (!portalPoi.destinationBoardId || !portalPoi.portalType) {
      console.error('Portal POI missing destinationBoardId or portalType');
      return false;
    }
    
    set({ isTransitioning: true });
    
    try {
      // Find the portal board
      const worldStore = useWorldStore.getState();
      const world = worldStore.world;
      
      if (!world?.portalBoards) {
        console.error('No portal boards found in world');
        return false;
      }
      
      const portalBoard = world.portalBoards.find(
        pb => pb.boardId === portalPoi.destinationBoardId
      );
      
      if (!portalBoard) {
        console.error(`Portal board not found: ${portalPoi.destinationBoardId}`);
        return false;
      }
      
      // Add to history
      const { portalHistory } = get();
      set({
        isInPortal: true,
        currentPortalBoardId: portalBoard.boardId,
        currentPortalType: portalBoard.portalType,
        portalHistory: [
          ...portalHistory,
          {
            portalBoardId: portalBoard.boardId,
            portalType: portalBoard.portalType,
            hubPortalPoiId: portalPoi.poiId,
          },
        ],
      });
      
      // Update player position to portal board spawn point
      const playerStore = usePlayerStore.getState();
      const [spawnX, spawnY] = normalizePosition(portalBoard.spawnPoint);
      playerStore.setPosition([spawnX, 0.5, spawnY]);
      
      return true;
    } catch (error) {
      console.error('Error entering portal:', error);
      set({ isTransitioning: false });
      return false;
    }
  },
  
  returnToHub: async () => {
    const { isTransitioning, portalHistory } = get();
    
    if (isTransitioning || !get().isInPortal) {
      return false;
    }
    
    set({ isTransitioning: true });
    
    try {
      // Get the last portal entry from history
      const lastPortal = portalHistory[portalHistory.length - 1];
      
      if (!lastPortal) {
        console.error('No portal history found');
        return false;
      }
      
      // Find the hub portal POI to return to
      const worldStore = useWorldStore.getState();
      const world = worldStore.world;
      
      if (!world) {
        console.error('No world found');
        return false;
      }
      
      // Find hub region
      const hubRegion = world.regions[0]; // First region is hub
      if (!hubRegion) {
        console.error('No hub region found');
        return false;
      }
      
      // Find the portal POI in hub
      const allHubPois = [...(hubRegion.pois || []), ...(hubRegion.mapSpec?.pois || [])];
      const hubPortalPoi = allHubPois.find(p => p.poiId === lastPortal.hubPortalPoiId);
      
      if (!hubPortalPoi) {
        console.error(`Hub portal POI not found: ${lastPortal.hubPortalPoiId}`);
        return false;
      }
      
      // Return to hub
      set({
        isInPortal: false,
        currentPortalBoardId: null,
        currentPortalType: null,
        portalHistory: portalHistory.slice(0, -1), // Remove last entry
      });
      
      // Update player position to hub portal location
      const playerStore = usePlayerStore.getState();
      const [portalX, portalY] = normalizePosition(hubPortalPoi.position);
      // Position player slightly offset from portal
      playerStore.setPosition([portalX + 2, 0.5, portalY + 2]);
      
      return true;
    } catch (error) {
      console.error('Error returning to hub:', error);
      set({ isTransitioning: false });
      return false;
    }
  },
  
  setTransitioning: (transitioning) => set({ isTransitioning: transitioning }),
  
  reset: () => set(initialState),
}));

