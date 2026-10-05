import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from './Layout';
import { useUIStore } from '../stores/uiStore';
import { makeGroup } from '../test/fixtures';
import type { User } from 'firebase/auth';

vi.mock('../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('../features/invites/PendingInvites', () => ({ default: () => null }));
vi.mock('./HouseholdHeader', () => ({
  default: ({ startMonth }: { startMonth: string | null }) => (
    <div data-testid="household-header" data-start-month={startMonth ?? ''} />
  ),
}));
vi.mock('./TopBar', () => ({ default: () => <div data-testid="top-bar" /> }));
vi.mock('./Dock', () => ({ default: () => <nav data-testid="dock" /> }));
vi.mock('./MonthRail', () => ({ default: () => <nav data-testid="month-rail" /> }));
const { desktop } = vi.hoisted(() => ({ desktop: { value: false } }));
vi.mock('../hooks/useMediaQuery', () => ({ useIsDesktop: () => desktop.value }));
vi.mock('./BottomSheet', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="bottom-sheet">{children}</div> : null,
}));
vi.mock('../features/expenses/ExpenseEditor', () => ({
  default: ({ onSuccess }: { onSuccess?: () => void }) => (
    <button type="button" onClick={onSuccess}>Save expense</button>
  ),
}));

const group = {
  ...makeGroup('g1', 'Family'),
  createdAt: { toDate: () => new Date(2026, 2, 15) } as unknown as ReturnType<typeof makeGroup>['createdAt'],
};
vi.mock('../hooks/useGroup', () => ({ useGroup: () => ({ group }) }));

const mockUser = { uid: 'mike', displayName: 'Mike', email: 'mike@example.com' } as unknown as User;

function renderLayout(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout groups={[group]} user={mockUser} />}>
          <Route path="*" element={<p>Page content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  desktop.value = false;
  useUIStore.setState({ selectedGroupId: 'g1', addSheetOpen: false, notice: null });
});

describe('Layout', () => {
  it('renders both shells around the page', () => {
    renderLayout();
    expect(screen.getByTestId('household-header')).toBeInTheDocument();
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByTestId('dock')).toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it("passes the group's first month to the shells", () => {
    renderLayout();
    expect(screen.getByTestId('household-header')).toHaveAttribute('data-start-month', '2026-03');
  });

  it('keeps the Add Expense sheet closed by default', () => {
    renderLayout();
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  it('opens the sheet when the store says so and closes it after a save', async () => {
    renderLayout();
    act(() => useUIStore.getState().openAddSheet());
    expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(useUIStore.getState().addSheetOpen).toBe(false);
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  it.each(['/', '/summary', '/income'])('shows the month rail on desktop at %s', (path) => {
    desktop.value = true;
    renderLayout(path);
    expect(screen.getByTestId('month-rail')).toBeInTheDocument();
  });

  it('has no month rail on desktop pages that are not month-scoped', () => {
    desktop.value = true;
    renderLayout('/categories');
    expect(screen.queryByTestId('month-rail')).toBeNull();
  });

  it('has no month rail on mobile', () => {
    renderLayout('/');
    expect(screen.queryByTestId('month-rail')).toBeNull();
  });

  it('renders the current notice', () => {
    useUIStore.setState({ notice: { id: 1, message: 'Trip created' } });
    renderLayout();
    expect(screen.getByText('Trip created')).toBeInTheDocument();
  });
});
