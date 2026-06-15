import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileHeader from './MobileHeader';
import type { User } from 'firebase/auth';
import type { GroupDoc } from '../types/models';

vi.mock('../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('./GroupSwitcher', () => ({ default: () => <div data-testid="group-switcher" /> }));
vi.mock('./MonthPicker', () => ({ default: () => <div data-testid="month-picker" /> }));

const mockGroups: GroupDoc[] = [{
  id: 'g1', name: 'Family', currency: 'AUD', ownerUid: 'u1',
  members: {}, memberUids: [], createdAt: null as unknown as GroupDoc['createdAt'],
}];
const mockUser = { uid: 'u1', displayName: 'Alice' } as unknown as User;

function renderHeader(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MobileHeader groups={mockGroups} user={mockUser} />
    </MemoryRouter>
  );
}

describe('MobileHeader', () => {
  it.each([
    ['/', 'Expenses'],
    ['/income', 'Income'],
    ['/summary', 'Summary'],
    ['/more', 'More'],
    ['/expense/new', 'New Expense'],
    ['/expense/abc123/edit', 'Edit Expense'],
    ['/categories', 'Categories'],
    ['/group/settings', 'Settings'],
    ['/group/invites', 'Invites'],
  ])('route %s → title "%s"', (path, expectedTitle) => {
    renderHeader(path);
    expect(screen.getByRole('heading', { level: 1, name: expectedTitle })).toBeTruthy();
  });

  it('renders group switcher', () => {
    renderHeader();
    expect(screen.getByTestId('group-switcher')).toBeTruthy();
  });

  it('renders month picker', () => {
    renderHeader();
    expect(screen.getByTestId('month-picker')).toBeTruthy();
  });

  it('renders sign out button', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy();
  });
});
