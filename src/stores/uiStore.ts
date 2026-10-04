import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { monthKey } from '../lib/month';
import type { ThemePref } from '../lib/theme';

interface UIState {
  selectedGroupId: string | null;
  selectedMonth: string;
  theme: ThemePref;
  /** Mobile Add Expense sheet; session-only, never persisted. */
  addSheetOpen: boolean;
  setGroup: (id: string) => void;
  setMonth: (month: string) => void;
  setTheme: (theme: ThemePref) => void;
  openAddSheet: () => void;
  closeAddSheet: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selectedGroupId: null,
      selectedMonth: monthKey(new Date()),
      theme: 'system',
      addSheetOpen: false,
      setGroup: (id) => set({ selectedGroupId: id }),
      setMonth: (month) => set({ selectedMonth: month }),
      setTheme: (theme) => set({ theme }),
      openAddSheet: () => set({ addSheetOpen: true }),
      closeAddSheet: () => set({ addSheetOpen: false }),
    }),
    {
      name: 'spendshare-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ selectedGroupId: state.selectedGroupId, theme: state.theme }),
    },
  ),
);
