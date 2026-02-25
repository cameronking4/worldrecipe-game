import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ItemStack, Item, QuestChapter, QuestObjective } from '@/types/game';
import { useNotificationStore } from './notificationStore';
import { useWorldStore } from './worldStore';

// ============================================
// Player Store - Player-specific state
// ============================================

interface PlayerState {
  // Position and movement
  position: [number, number, number];
  rotation: number;
  isMoving: boolean;
  moveDirection: { x: number; z: number };
  
  // Inventory
  inventory: ItemStack[];
  maxInventorySlots: number;
  
  // Quests
  activeQuests: QuestChapter[];
  completedQuestIds: string[];
  
  // NPC relationships
  npcRelationships: Record<string, number>;
  
  // Cooking progress
  completedCookingSteps: string[];
  unlockedTechniques: string[];
  
  // Collected items (to prevent respawn)
  collectedItemIds: string[];
  
  // NPC conversation memory
  npcConversationMemory: Record<string, string[]>;
  
  // Stats
  stamina: number;
  maxStamina: number;
  health: number;
  maxHealth: number;
  ammo: number;
  magazineSize: number;
  reserveAmmo: number;
  kills: number;
  lastDamageAt: number | null;
  
  // Actions
  setPosition: (pos: [number, number, number]) => void;
  setRotation: (rot: number) => void;
  setMoving: (moving: boolean) => void;
  setMoveDirection: (dir: { x: number; z: number }) => void;
  
  // Inventory actions
  addItem: (item: Item, quantity?: number) => boolean;
  removeItem: (itemId: string, quantity?: number) => boolean;
  hasItem: (itemId: string, quantity?: number) => boolean;
  getItemCount: (itemId: string) => number;
  hasAllDishIngredients: () => boolean;
  
  // Quest actions
  acceptQuest: (quest: QuestChapter) => void;
  updateObjective: (questId: string, objectiveId: string) => void;
  completeQuest: (questId: string) => void;
  getActiveQuest: (questId: string) => QuestChapter | undefined;
  checkAndUpdateGatherObjectives: (itemId: string) => void;
  checkAndUpdateTalkObjectives: (npcId: string) => void;
  
  // Relationship actions
  updateRelationship: (npcId: string, delta: number) => void;
  getRelationship: (npcId: string) => number;
  
  // Cooking actions
  completeCookingStep: (stepId: string) => void;
  unlockTechnique: (techniqueId: string) => void;
  hasCompletedStep: (stepId: string) => boolean;
  
  // Stamina actions
  useStamina: (amount: number) => boolean;
  restoreStamina: (amount: number) => void;
  
  // Combat actions
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  shoot: () => boolean;
  reload: () => boolean;
  addReserveAmmo: (amount: number) => void;
  registerKill: () => void;
  resetCombat: () => void;
  
  // Collected items actions
  markCollected: (itemId: string) => void;
  isCollected: (itemId: string) => boolean;
  
  // NPC memory actions
  addConversationMemory: (npcId: string, summary: string) => void;
  getConversationMemory: (npcId: string) => string[];
  
  // Restore state (for save/load)
  restoreState: (state: Partial<PlayerState>) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  position: [0, 0.5, 0] as [number, number, number],
  rotation: 0,
  isMoving: false,
  moveDirection: { x: 0, z: 0 },
  
  inventory: [] as ItemStack[],
  maxInventorySlots: 24,
  
  activeQuests: [] as QuestChapter[],
  completedQuestIds: [] as string[],
  
  npcRelationships: {} as Record<string, number>,
  
  completedCookingSteps: [] as string[],
  unlockedTechniques: [] as string[],
  
  // Collected items tracking (to prevent respawn)
  collectedItemIds: [] as string[],
  
  // NPC conversation memory (summaries for continuity)
  npcConversationMemory: {} as Record<string, string[]>,
  
  stamina: 100,
  maxStamina: 100,
  health: 100,
  maxHealth: 100,
  ammo: 24,
  magazineSize: 24,
  reserveAmmo: 96,
  kills: 0,
  lastDamageAt: null,
};

export const usePlayerStore = create<PlayerState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    setPosition: (pos) => set({ position: pos }),
    setRotation: (rot) => set({ rotation: rot }),
    setMoving: (moving) => set({ isMoving: moving }),
    setMoveDirection: (dir) => set({ moveDirection: dir }),
    
    addItem: (item, quantity = 1) => {
      const { inventory, maxInventorySlots } = get();
      const existingStack = inventory.find(stack => stack.item.itemId === item.itemId);
      
      if (existingStack) {
        // Add to existing stack
        set({
          inventory: inventory.map(stack =>
            stack.item.itemId === item.itemId
              ? { ...stack, quantity: stack.quantity + quantity }
              : stack
          ),
        });
        // Show notification
        useNotificationStore.getState().showItemCollected(item.name, quantity);
        // Auto-check gather objectives after adding
        setTimeout(() => get().checkAndUpdateGatherObjectives(item.itemId), 0);
        return true;
      }
      
      // Create new stack if we have room
      if (inventory.length < maxInventorySlots) {
        set({
          inventory: [...inventory, { item, quantity }],
        });
        // Show notification
        useNotificationStore.getState().showItemCollected(item.name, quantity);
        // Auto-check gather objectives after adding
        setTimeout(() => get().checkAndUpdateGatherObjectives(item.itemId), 0);
        return true;
      }
      
      return false; // No room
    },
    
    removeItem: (itemId, quantity = 1) => {
      const { inventory } = get();
      const stackIndex = inventory.findIndex(stack => stack.item.itemId === itemId);
      
      if (stackIndex === -1) return false;
      
      const stack = inventory[stackIndex];
      if (stack.quantity < quantity) return false;
      
      if (stack.quantity === quantity) {
        // Remove entire stack
        set({
          inventory: inventory.filter((_, i) => i !== stackIndex),
        });
      } else {
        // Reduce quantity
        set({
          inventory: inventory.map((s, i) =>
            i === stackIndex ? { ...s, quantity: s.quantity - quantity } : s
          ),
        });
      }
      
      return true;
    },
    
    hasItem: (itemId, quantity = 1) => {
      return get().getItemCount(itemId) >= quantity;
    },
    
    getItemCount: (itemId) => {
      const stack = get().inventory.find(s => s.item.itemId === itemId);
      return stack?.quantity ?? 0;
    },
    
    hasAllDishIngredients: () => {
      const { inventory } = get();
      const worldStore = useWorldStore.getState();
      const world = worldStore.world;
      
      if (!world) return false;
      
      // Get all ingredients required for the dish
      const requiredIngredients = world.ingredientGraph.ingredients.map(i => i.ingredientId);
      
      // Check if player has at least 1 of each required ingredient
      return requiredIngredients.every(ingredientId => 
        get().hasItem(ingredientId, 1)
      );
    },
    
    acceptQuest: (quest) => {
      const { activeQuests, completedQuestIds } = get();
      
      // Don't accept if already active or completed
      if (activeQuests.some(q => q.questId === quest.questId)) return;
      if (completedQuestIds.includes(quest.questId)) return;
      
      set({
        activeQuests: [...activeQuests, quest],
      });
      
      // Show notification
      useNotificationStore.getState().showQuestAccepted(quest.title);
    },
    
    updateObjective: (questId, objectiveId) => {
      set((state) => ({
        activeQuests: state.activeQuests.map(quest => {
          if (quest.questId !== questId) return quest;
          
          return {
            ...quest,
            objectives: quest.objectives.map(obj =>
              obj.objectiveId === objectiveId
                ? { ...obj, completed: true }
                : obj
            ),
          };
        }),
      }));
    },
    
    completeQuest: (questId) => {
      const { activeQuests, completedQuestIds, inventory, maxInventorySlots } = get();
      const quest = activeQuests.find(q => q.questId === questId);
      
      if (!quest) return;
      
      // Add rewards to inventory
      const newInventory = [...inventory];
      for (const reward of quest.rewards) {
        const existingStack = newInventory.find(s => s.item.itemId === reward.item.itemId);
        if (existingStack) {
          existingStack.quantity += reward.quantity;
        } else if (newInventory.length < maxInventorySlots) {
          newInventory.push({ ...reward });
        }
      }
      
      set({
        activeQuests: activeQuests.filter(q => q.questId !== questId),
        completedQuestIds: [...completedQuestIds, questId],
        inventory: newInventory,
      });
      
      // Show notification
      useNotificationStore.getState().showQuestCompleted(quest.title);
    },
    
    getActiveQuest: (questId) => {
      return get().activeQuests.find(q => q.questId === questId);
    },
    
    updateRelationship: (npcId, delta) => {
      const currentLevel = get().npcRelationships[npcId] ?? 0;
      const newLevel = Math.max(0, Math.min(10, currentLevel + delta));
      
      set((state) => ({
        npcRelationships: {
          ...state.npcRelationships,
          [npcId]: newLevel,
        },
      }));
      
      // Show notification for positive relationship changes
      if (delta > 0 && newLevel > currentLevel) {
        useNotificationStore.getState().showRelationshipUp(npcId);
      }
    },
    
    getRelationship: (npcId) => {
      return get().npcRelationships[npcId] ?? 0;
    },
    
    completeCookingStep: (stepId) => {
      const { completedCookingSteps } = get();
      if (!completedCookingSteps.includes(stepId)) {
        set({
          completedCookingSteps: [...completedCookingSteps, stepId],
        });
      }
    },
    
    unlockTechnique: (techniqueId) => {
      const { unlockedTechniques } = get();
      if (!unlockedTechniques.includes(techniqueId)) {
        set({
          unlockedTechniques: [...unlockedTechniques, techniqueId],
        });
      }
    },
    
    hasCompletedStep: (stepId) => {
      return get().completedCookingSteps.includes(stepId);
    },
    
    useStamina: (amount) => {
      const { stamina } = get();
      if (stamina < amount) return false;
      set({ stamina: stamina - amount });
      return true;
    },
    
    restoreStamina: (amount) => {
      const { stamina, maxStamina } = get();
      set({ stamina: Math.min(maxStamina, stamina + amount) });
    },
    
    takeDamage: (amount) => {
      const { health } = get();
      const next = Math.max(0, health - Math.max(0, amount));
      set({
        health: next,
        lastDamageAt: Date.now(),
      });
    },
    
    heal: (amount) => {
      const { health, maxHealth } = get();
      set({ health: Math.min(maxHealth, health + Math.max(0, amount)) });
    },
    
    shoot: () => {
      const { ammo } = get();
      if (ammo <= 0) return false;
      set({ ammo: ammo - 1 });
      return true;
    },
    
    reload: () => {
      const { ammo, magazineSize, reserveAmmo } = get();
      if (ammo >= magazineSize || reserveAmmo <= 0) return false;
      
      const needed = magazineSize - ammo;
      const used = Math.min(needed, reserveAmmo);
      set({
        ammo: ammo + used,
        reserveAmmo: reserveAmmo - used,
      });
      return true;
    },
    
    addReserveAmmo: (amount) => {
      const safeAmount = Math.max(0, Math.floor(amount));
      if (safeAmount === 0) return;
      set((state) => ({
        reserveAmmo: Math.min(999, state.reserveAmmo + safeAmount),
      }));
    },
    
    registerKill: () => {
      set((state) => ({ kills: state.kills + 1 }));
    },
    
    resetCombat: () => {
      set((state) => ({
        health: state.maxHealth,
        ammo: state.magazineSize,
        reserveAmmo: Math.max(state.reserveAmmo, 72),
      }));
    },
    
    // Check and auto-update gather objectives when items are collected
    checkAndUpdateGatherObjectives: (itemId) => {
      const { activeQuests, inventory } = get();
      const itemCount = inventory.find(s => s.item.itemId === itemId)?.quantity || 0;
      
      let updated = false;
      const completedObjectives: string[] = [];
      
      const updatedQuests = activeQuests.map(quest => {
        const updatedObjectives = quest.objectives.map(obj => {
          if (
            obj.type === 'gather' &&
            obj.target === itemId &&
            !obj.completed &&
            itemCount >= (obj.quantity || 1)
          ) {
            updated = true;
            completedObjectives.push(obj.description);
            return { ...obj, completed: true };
          }
          return obj;
        });
        return { ...quest, objectives: updatedObjectives };
      });
      
      if (updated) {
        set({ activeQuests: updatedQuests });
        // Show notification for completed objectives
        completedObjectives.forEach(desc => {
          useNotificationStore.getState().showObjectiveCompleted(desc);
        });
      }
    },
    
    // Check and auto-update talk objectives when talking to NPCs
    checkAndUpdateTalkObjectives: (npcId) => {
      const { activeQuests } = get();
      
      let updated = false;
      const updatedQuests = activeQuests.map(quest => {
        const updatedObjectives = quest.objectives.map(obj => {
          if (
            obj.type === 'talk' &&
            obj.target === npcId &&
            !obj.completed
          ) {
            updated = true;
            return { ...obj, completed: true };
          }
          return obj;
        });
        return { ...quest, objectives: updatedObjectives };
      });
      
      if (updated) {
        set({ activeQuests: updatedQuests });
      }
    },
    
    // Mark an item as collected (to prevent respawn)
    markCollected: (itemId) => {
      const { collectedItemIds } = get();
      if (!collectedItemIds.includes(itemId)) {
        set({ collectedItemIds: [...collectedItemIds, itemId] });
      }
    },
    
    isCollected: (itemId) => {
      return get().collectedItemIds.includes(itemId);
    },
    
    // NPC conversation memory
    addConversationMemory: (npcId, summary) => {
      const { npcConversationMemory } = get();
      const existing = npcConversationMemory[npcId] || [];
      // Keep last 5 conversation summaries
      const updated = [...existing, summary].slice(-5);
      set({
        npcConversationMemory: {
          ...npcConversationMemory,
          [npcId]: updated,
        },
      });
    },
    
    getConversationMemory: (npcId) => {
      return get().npcConversationMemory[npcId] || [];
    },
    
    // Restore state from save
    restoreState: (state) => {
      set({
        ...state,
        // Ensure arrays are initialized
        inventory: state.inventory || [],
        activeQuests: state.activeQuests || [],
        completedQuestIds: state.completedQuestIds || [],
        completedCookingSteps: state.completedCookingSteps || [],
        unlockedTechniques: state.unlockedTechniques || [],
        collectedItemIds: state.collectedItemIds || [],
        npcConversationMemory: state.npcConversationMemory || {},
        npcRelationships: state.npcRelationships || {},
        health: typeof state.health === 'number' ? state.health : get().maxHealth,
        maxHealth: typeof state.maxHealth === 'number' ? state.maxHealth : get().maxHealth,
        ammo: typeof state.ammo === 'number' ? state.ammo : get().magazineSize,
        magazineSize: typeof state.magazineSize === 'number' ? state.magazineSize : get().magazineSize,
        reserveAmmo: typeof state.reserveAmmo === 'number' ? state.reserveAmmo : get().reserveAmmo,
        kills: typeof state.kills === 'number' ? state.kills : get().kills,
        lastDamageAt: state.lastDamageAt ?? null,
      });
    },
    
    reset: () => set(initialState),
  }))
);
