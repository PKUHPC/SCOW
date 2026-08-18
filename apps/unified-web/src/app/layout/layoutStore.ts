import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LayoutState {
  navigationCollapsed: boolean;
  mobileNavigationOpen: boolean;
  toggleNavigationCollapsed: () => void;
  setMobileNavigationOpen: (open: boolean) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      navigationCollapsed: false,
      mobileNavigationOpen: false,
      toggleNavigationCollapsed: () => set((state) => ({ navigationCollapsed: !state.navigationCollapsed })),
      setMobileNavigationOpen: (mobileNavigationOpen) => set({ mobileNavigationOpen }),
    }),
    {
      name: "scow-unified-layout",
      partialize: (state) => ({ navigationCollapsed: state.navigationCollapsed }),
    },
  ),
);
