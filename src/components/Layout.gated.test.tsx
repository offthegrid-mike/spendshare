import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from './Layout';
import { useUIStore } from '../stores/uiStore';
import { makeGroup } from '../test/fixtures';
import type { User } from 'firebase/auth';
import { paths } from '../lib/paths';

vi.mock('../lib/features', () => ({ WORK_ENABLED: true, DARK_MODE_ENABLED: true }));
vi.mock('../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('../features/invites/PendingInvites', () => ({ default: () => null }));
vi.mock('./HouseholdHeader', () => ({
  default: ({ showHome }: { showHome?: boolean }) => (
    <div data-testid="household-header" data-show-home={String(showHome)} />
  ),
}));
vi.mock('./TopBar', () => ({
  default: ({ showHome }: { showHome?: boolean }) => <div data-testid="top-bar" data-show-home={String(showHome)} />,
}));
vi.mock('./Dock', () => ({ default: () => <nav data-testid="dock" /> }));
vi.mock('./MonthRail', () => ({ default: () => <nav data-testid="month-rail" /> }));
vi.mock('../hooks/useMediaQuery', () => ({ useIsDesktop: () => false }));
vi.mock('./BottomSheet', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="bottom-sheet">{children}</div> : null,
}));
vi.mock('../features/expenses/ExpenseEditor', () => ({ default: () => <div /> }));

const group = makeGroup('g1', 'Family');
vi.mock('../hooks/useGroup', () => ({ useGroup: () => ({ group }) }));

const mockUser = { uid: 'mike', displayName: 'Mike', email: 'mike@example.com' } as unknown as User;

beforeEach(() => {
  useUIStore.setState({ selectedGroupId: 'g1', addSheetOpen: false, notice: null });
});

describe('Layout with the work flag enabled', () => {
  it('turns the Home link on in both shells', () => {
    render(
      <MemoryRouter initialEntries={[paths.spend]}>
        <Routes>
          <Route element={<Layout groups={[group]} user={mockUser} />}>
            <Route path="*" element={<p>Page content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('household-header')).toHaveAttribute('data-show-home', 'true');
    expect(screen.getByTestId('top-bar')).toHaveAttribute('data-show-home', 'true');
  });
});
