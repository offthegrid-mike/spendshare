import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';

// Mock firebase auth
vi.mock('../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));

// Mock child components that hit Firestore
vi.mock('./GroupSwitcher', () => ({ default: () => <div data-testid="group-switcher" /> }));
vi.mock('./MonthPicker', () => ({ default: () => <div data-testid="month-picker" /> }));
vi.mock('../features/invites/PendingInvites', () => ({ default: () => null }));
vi.mock('./MobileHeader', () => ({ default: () => <div data-testid="mobile-header" /> }));
vi.mock('./BottomNav', () => ({ default: () => <nav data-testid="bottom-nav" /> }));
vi.mock('./BottomSheet', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="bottom-sheet">{children}</div> : null,
}));
vi.mock('../features/expenses/ExpenseEditor', () => ({
  default: () => <div data-testid="expense-editor" />,
}));
vi.mock('../hooks/useGroup', () => ({
  useGroup: () => ({ group: { id: 'g1', name: 'Family', currency: 'AUD', ownerUid: 'u1', members: {}, memberUids: [] } }),
}));
vi.mock('../stores/uiStore', () => ({
  useUIStore: () => ({ selectedGroupId: 'g1', selectedMonth: '2026-06' }),
}));

import type { GroupDoc } from '../types/models';
import type { User } from 'firebase/auth';

const mockGroups: GroupDoc[] = [{ id: 'g1', name: 'Family', currency: 'AUD', ownerUid: 'u1', members: {}, memberUids: [], createdAt: null as unknown as GroupDoc['createdAt'] }];
const mockUser = { uid: 'u1', displayName: 'Alice', email: 'alice@example.com' } as unknown as User;

function renderLayout(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Layout groups={mockGroups} user={mockUser} />
    </MemoryRouter>
  );
}

describe('Layout', () => {
  it('renders the SpendShare brand', () => {
    renderLayout();
    expect(screen.getByText('SpendShare')).toBeTruthy();
  });

  it('renders all navigation links', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: /expenses/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /income/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /summary/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /categories/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /invite/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /settings/i })).toBeTruthy();
  });

  it('renders the + Expense CTA button', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: /^\+?\s*expense$/i })).toBeTruthy();
  });

  it('renders sign out button', () => {
    renderLayout();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy();
  });

  it('header has gradient class', () => {
    renderLayout();
    const header = document.querySelector('header');
    expect(header?.className).toContain('bg-brand-gradient');
  });

  it('renders mobile header', () => {
    renderLayout();
    expect(screen.getByTestId('mobile-header')).toBeTruthy();
  });

  it('renders bottom nav', () => {
    renderLayout();
    expect(screen.getByTestId('bottom-nav')).toBeTruthy();
  });

  it('bottom sheet is closed by default', () => {
    renderLayout();
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });
});
