import { describe, it, expect, vi } from 'vitest';
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
});
