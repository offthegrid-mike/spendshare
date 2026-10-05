import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { monthKey } from '../lib/month';
import type { ThemePref } from '../lib/theme';

export interface Notice {
  id: number;
  message: string;
  action?: { label: string; to: string };
}

// Distinguishes consecutive notices so each one gets its own dismiss timer.
let noticeSeq = 0;

interface UIState {
  selectedGroupId: string | null;
  selectedMonth: string;
  theme: ThemePref;
  /** Mobile Add Expense sheet; session-only, never persisted. */
  addSheetOpen: boolean;
  /** One transient message; session-only, never persisted. */
  notice: Notice | null;
  /** A just-joined group to select once it appears in the group list; session-only. */
  pendingGroupId: string | null;
  setGroup: (id: string) => void;
  /** A group the user picked: selects it and drops any pending joined group. */
  chooseGroup: (id: string) => void;
  selectGroupWhenReady: (id: string) => void;
  clearPendingGroup: () => void;
  setMonth: (month: string) => void;
  setTheme: (theme: ThemePref) => void;
  openAddSheet: () => void;
  closeAddSheet: () => void;
  showNotice: (notice: Omit<Notice, 'id'>) => void;
  clearNotice: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selectedGroupId: null,
      selectedMonth: monthKey(new Date()),
      theme: 'system',
      addSheetOpen: false,
      notice: null,
      pendingGroupId: null,
      setGroup: (id) => set({ selectedGroupId: id }),
      chooseGroup: (id) => set({ selectedGroupId: id, pendingGroupId: null }),
      selectGroupWhenReady: (id) => set({ pendingGroupId: id }),
      clearPendingGroup: () => set({ pendingGroupId: null }),
      setMonth: (month) => set({ selectedMonth: month }),
      setTheme: (theme) => set({ theme }),
      openAddSheet: () => set({ addSheetOpen: true }),
      closeAddSheet: () => set({ addSheetOpen: false }),
      showNotice: (notice) => set({ notice: { ...notice, id: ++noticeSeq } }),
      clearNotice: () => set({ notice: null }),
    }),
    {
      name: 'spendshare-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ selectedGroupId: state.selectedGroupId, theme: state.theme }),
    },
  ),
);
