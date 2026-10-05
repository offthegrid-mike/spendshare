import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import GroupPicker, { type GroupPickerView } from './GroupPicker';
import { makeGroup } from '../../test/fixtures';

const { createGroup } = vi.hoisted(() => ({ createGroup: vi.fn() }));
vi.mock('../../lib/createGroup', () => ({ createGroup, CURRENCIES: ['AUD', 'USD', 'EUR', 'GBP'] }));

const user = { uid: 'mike', displayName: 'Mike', email: 'mike@example.com' } as unknown as User;
const home = makeGroup('g1', 'Hartley House');
const trip = { ...makeGroup('g2', 'Tasmania trip', ['Mike', 'Priya', 'Tomas', 'Ana']), currency: 'USD' };

function renderPicker(over: Partial<{ view: GroupPickerView; busy: boolean; selectedId: string }> = {}) {
  const onPick = vi.fn();
  const onViewChange = vi.fn();
  render(
    <GroupPicker
      groups={[home, trip]} user={user} selectedId={over.selectedId ?? 'g1'}
      view={over.view ?? 'list'} onViewChange={onViewChange} onPick={onPick} busy={over.busy}
    />,
  );
  return { onPick, onViewChange };
}

beforeEach(() => {
  createGroup.mockReset().mockResolvedValue('g-new');
});

describe('GroupPicker', () => {
  it('lists groups as options with member count and currency, marking the selected one', () => {
    renderPicker();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('2 people, AUD')).toBeInTheDocument();
    expect(screen.getByText('4 people, USD')).toBeInTheDocument();
  });

  it('focuses the selected group when the list opens', () => {
    renderPicker({ selectedId: 'g2' });
    expect(screen.getByRole('option', { name: /Tasmania trip/ })).toHaveFocus();
  });

  it('focuses the group name field in the create view', () => {
    renderPicker({ view: 'create' });
    expect(screen.getByLabelText('Group name')).toHaveFocus();
  });

  it('keeps the list reachable by keyboard when the selected id is unknown', () => {
    renderPicker({ selectedId: 'gone' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('tabindex', '0');
  });

  it('picks a group on click', async () => {
    const { onPick } = renderPicker();
    await userEvent.click(screen.getByRole('option', { name: /Tasmania trip/ }));
    expect(onPick).toHaveBeenCalledWith('g2', { created: false, name: 'Tasmania trip' });
  });

  it('moves with arrow keys and picks with Enter', async () => {
    const { onPick } = renderPicker();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onPick).toHaveBeenCalledWith('g2', { created: false, name: 'Tasmania trip' });
  });

  it('ignores picks while busy', async () => {
    const { onPick } = renderPicker({ busy: true });
    await userEvent.click(screen.getByRole('option', { name: /Tasmania trip/ }));
    expect(onPick).not.toHaveBeenCalled();
  });

  it('asks to switch to the create view', async () => {
    const { onViewChange } = renderPicker();
    await userEvent.click(screen.getByRole('button', { name: 'New group' }));
    expect(onViewChange).toHaveBeenCalledWith('create');
  });

  it('goes back to the list from the create view', async () => {
    const { onViewChange } = renderPicker({ view: 'create' });
    await userEvent.click(screen.getByRole('button', { name: 'Back to groups' }));
    expect(onViewChange).toHaveBeenCalledWith('list');
  });

  it('defaults a new group to the selected group currency', () => {
    renderPicker({ view: 'create', selectedId: 'g2' });
    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
  });

  it('picks a newly created group', async () => {
    const { onPick } = renderPicker({ view: 'create' });
    await userEvent.type(screen.getByLabelText('Group name'), 'Studio rent');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith('g-new', { created: true, name: 'Studio rent' }));
  });

  it('names an option by its group, size and currency, without the avatar initials', () => {
    renderPicker();
    // The two lines are block spans: jsdom joins them without a space, browsers add one.
    expect(screen.getByRole('option', { name: /^Hartley House\s?2 people, AUD$/ })).toBeInTheDocument();
  });

  it('disables creating while busy', () => {
    renderPicker({ view: 'create', busy: true });
    expect(screen.getByRole('button', { name: 'Create group' })).toBeDisabled();
  });
});
