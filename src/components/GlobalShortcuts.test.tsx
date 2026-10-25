import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import GlobalShortcuts from './GlobalShortcuts';
import { useUIStore } from '../stores/uiStore';
import { paths } from '../lib/paths';
import { prevMonthKey, todayMonthKey } from '../lib/month';

const { desktop } = vi.hoisted(() => ({ desktop: { value: true } }));
vi.mock('../hooks/useMediaQuery', () => ({ useIsDesktop: () => desktop.value }));

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GlobalShortcuts />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  });

const location = () => screen.getByTestId('location').textContent;
const lastMonth = prevMonthKey(todayMonthKey());

beforeEach(() => {
  desktop.value = true;
  useUIStore.setState({ selectedMonth: lastMonth });
});

describe('GlobalShortcuts', () => {
  it('opens New expense with N', () => {
    renderAt(paths.spend);
    press('n');
    expect(location()).toBe(paths.newExpense);
  });

  it('ignores N on the expense editor itself', () => {
    renderAt(paths.newExpense);
    press('n');
    expect(location()).toBe(paths.newExpense);
  });

  it.each([paths.spend, paths.summary, paths.income])('changes month with ← and → on %s', (path) => {
    renderAt(path);
    press('ArrowLeft');
    expect(useUIStore.getState().selectedMonth).toBe(prevMonthKey(lastMonth));
    press('ArrowRight');
    press('ArrowRight');
    expect(useUIStore.getState().selectedMonth).toBe(todayMonthKey());
  });

  it('never moves past the current month', () => {
    useUIStore.setState({ selectedMonth: todayMonthKey() });
    renderAt(paths.spend);
    press('ArrowRight');
    expect(useUIStore.getState().selectedMonth).toBe(todayMonthKey());
  });

  it('leaves ← and → alone on pages without a month', () => {
    renderAt(paths.search);
    press('ArrowLeft');
    expect(useUIStore.getState().selectedMonth).toBe(lastMonth);
  });

  it('opens the shortcuts help with ? and closes it with Esc', () => {
    renderAt(paths.spend);
    press('?', { shiftKey: true });
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toHaveTextContent('New expense');
    expect(dialog).toHaveTextContent('Previous month');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the shortcuts help with its Close button', () => {
    renderAt(paths.spend);
    press('?', { shiftKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ignores shortcuts while the help is open', () => {
    renderAt(paths.spend);
    press('?', { shiftKey: true });
    press('n');
    expect(location()).toBe(paths.spend);
  });

  it('does nothing on mobile', () => {
    desktop.value = false;
    renderAt(paths.spend);
    press('n');
    press('ArrowLeft');
    press('?', { shiftKey: true });
    expect(location()).toBe(paths.spend);
    expect(useUIStore.getState().selectedMonth).toBe(lastMonth);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
