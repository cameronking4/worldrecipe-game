import { create } from 'zustand';

// Portal Store - not used in FPS mode
interface PortalState {
  isInPortal: boolean;
  canAccessPortal: (poi: any) => boolean;
  getCurrentPortalBoard: () => null;
}

export const usePortalStore = create<PortalState>(() => ({
  isInPortal: false,
  canAccessPortal: () => false,
  getCurrentPortalBoard: () => null,
}));
