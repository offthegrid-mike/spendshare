import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

beforeEach(() => {
  localStorage.clear();
  useUIStore.setState({ theme: 'system', addSheetOpen: false });
});

describe('uiStore theme', () => {
  it('defaults to following the system', () => {
    expect(useUIStore.getInitialState().theme).toBe('system');
  });

  it('persists the theme preference', () => {
    useUIStore.getState().setTheme('dark');
    const saved = JSON.parse(localStorage.getItem('spendshare-ui')!).state;
    expect(saved.theme).toBe('dark');
  });
});

describe('uiStore add-expense sheet', () => {
  it('opens and closes', () => {
    useUIStore.getState().openAddSheet();
    expect(useUIStore.getState().addSheetOpen).toBe(true);
    useUIStore.getState().closeAddSheet();
    expect(useUIStore.getState().addSheetOpen).toBe(false);
  });

  it('is never persisted', () => {
    useUIStore.getState().openAddSheet();
    const saved = JSON.parse(localStorage.getItem('spendshare-ui')!).state;
    expect(saved).not.toHaveProperty('addSheetOpen');
  });
});
