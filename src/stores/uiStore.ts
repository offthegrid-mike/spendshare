import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { monthKey } from '../lib/month';

interface UIState {
  selectedGroupId: string | null;
  selectedMonth: string;
  setGroup: (id: string) => void;
  setMonth: (month: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selectedGroupId: null,
      selectedMonth: monthKey(new Date()),
      setGroup: (id) => set({ selectedGroupId: id }),
      setMonth: (month) => set({ selectedMonth: month }),
    }),
    {
      name: 'spendshare-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ selectedGroupId: state.selectedGroupId }),
    },
  ),
);
