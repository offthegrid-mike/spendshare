import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { User } from 'firebase/auth';
import HomeScreen from './HomeScreen';
import { makeGroup } from '../../test/fixtures';
import type { GroupDoc } from '../../types/models';

vi.mock('../../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('../../lib/features', () => ({ DARK_MODE_ENABLED: true }));
vi.mock('./SpendTile', () => ({
  default: ({ groups, group, viewerUid }: { groups: unknown[]; group: { id: string } | null; viewerUid: string }) => (
    <div data-testid="spend-tile" data-viewer={viewerUid} data-groups={groups.length} data-group={group?.id ?? ''} />
  ),
}));
vi.mock('../invites/PendingInvites', () => ({ default: () => <div data-testid="pending-invites" /> }));
vi.mock('../../components/Notice', () => ({ default: () => <div data-testid="notice" /> }));

const household = makeGroup('g1', 'The Smiths');
const mike = { uid: 'mike', displayName: 'Mike Smith', email: 'mike@example.com' } as User;

function renderHome(props: { user?: User; groups?: GroupDoc[]; group?: GroupDoc | null } = {}) {
  const { user = mike, groups = [household], group = household } = props;
  return render(
    <MemoryRouter>
      <HomeScreen user={user} groups={groups} group={group} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 19, 9)); // Monday 19 October 2026, 09:00
});

afterEach(() => vi.useRealTimers());

describe('HomeScreen', () => {
  it('greets the user by first name, with today in words', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Good morning, Mike' })).toBeInTheDocument();
    expect(screen.getByText('Monday 19 October')).toBeInTheDocument();
  });

  it('changes the greeting with the time of day', () => {
    vi.setSystemTime(new Date(2026, 9, 19, 19));
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Good evening, Mike' })).toBeInTheDocument();
  });

  it('falls back to the email name when there is no display name', () => {
    renderHome({ user: { uid: 'p', displayName: null, email: 'priya@example.com' } as User });
    expect(screen.getByRole('heading', { level: 1, name: 'Good morning, priya' })).toBeInTheDocument();
  });

  it('shows the Home mark, the pending invites, the SpendShare tile and the notice', () => {
    renderHome();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByTestId('pending-invites')).toBeInTheDocument();
    expect(screen.getByTestId('spend-tile')).toBeInTheDocument();
    expect(screen.getByTestId('notice')).toBeInTheDocument();
  });

  it('hands the tile the groups, the selected group and the viewer', () => {
    renderHome({ groups: [household, makeGroup('g2', 'Flat')], group: household });
    const tile = screen.getByTestId('spend-tile');
    expect(tile).toHaveAttribute('data-viewer', 'mike');
    expect(tile).toHaveAttribute('data-groups', '2');
    expect(tile).toHaveAttribute('data-group', 'g1');
  });

  it('still shows the tile with no groups', () => {
    renderHome({ groups: [], group: null });
    expect(screen.getByTestId('spend-tile')).toHaveAttribute('data-groups', '0');
  });

  it('has an account menu with the name, email, appearance and sign out, but no manage links', async () => {
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const menu = screen.getByRole('menu');
    expect(menu).toHaveTextContent('Mike Smith');
    expect(menu).toHaveTextContent('mike@example.com');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Categories' })).toBeNull();
  });
});
