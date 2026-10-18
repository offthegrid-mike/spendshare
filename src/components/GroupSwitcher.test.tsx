import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { User } from 'firebase/auth';
import GroupSwitcher from './GroupSwitcher';
import { useUIStore } from '../stores/uiStore';
import { makeGroup } from '../test/fixtures';
import { paths } from '../lib/paths';

const { createGroup } = vi.hoisted(() => ({ createGroup: vi.fn() }));
vi.mock('../lib/createGroup', () => ({ createGroup, CURRENCIES: ['AUD', 'USD', 'EUR', 'GBP'] }));

const home = makeGroup('g1', 'Hartley House');
const trip = makeGroup('g2', 'Ski trip', ['Mike', 'Sam']);
const asUser = (uid: string) => ({ uid, displayName: uid, email: `${uid}@example.com` }) as unknown as User;

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderSwitcher({ groups = [home, trip], uid = 'mike', mode = 'popover' as 'sheet' | 'popover', path = paths.spend } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GroupSwitcher groups={groups} user={asUser(uid)} mode={mode} />
      <Routes>
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>,
  );
}

const trigger = () => screen.getByRole('button', { name: /switch group/i });

beforeEach(() => {
  useUIStore.setState({ selectedGroupId: 'g1', notice: null, pendingGroupId: null });
  createGroup.mockReset().mockResolvedValue('g-new');
});

describe('GroupSwitcher', () => {
  it('shows the selected group name and its members, viewer first', () => {
    renderSwitcher({ uid: 'priya' });
    expect(screen.getByText('Hartley House', { selector: 'span' })).toBeInTheDocument();
    const initials = screen.getAllByTitle(/Mike|Priya/).map((el) => el.textContent);
    expect(initials).toEqual(['P', 'M']);
  });

  it('opens with a single group so a new group can be made', async () => {
    renderSwitcher({ groups: [home] });
    await userEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: 'Your groups' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New group' })).toBeInTheDocument();
  });

  it('switches group from the popover and closes it', async () => {
    renderSwitcher();
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('option', { name: /Ski trip/ }));
    expect(useUIStore.getState().selectedGroupId).toBe('g2');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('just closes when the current group is picked', async () => {
    renderSwitcher();
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('option', { name: /Hartley House/ }));
    expect(useUIStore.getState().selectedGroupId).toBe('g1');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes the popover on Escape and returns focus to the trigger', async () => {
    renderSwitcher();
    await userEvent.click(trigger());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('closes the popover on Escape from the create view', async () => {
    renderSwitcher();
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'New group' }));
    expect(screen.getByLabelText('Group name')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByLabelText('Group name')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('shows the picker in a sheet titled by its view on mobile', async () => {
    renderSwitcher({ mode: 'sheet' });
    await userEvent.click(trigger());
    expect(screen.getByRole('dialog', { name: 'Your groups' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New group' }));
    expect(screen.getByRole('dialog', { name: 'New group' })).toBeInTheDocument();
  });

  it('switches to a new group and offers to invite people', async () => {
    renderSwitcher();
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'New group' }));
    await userEvent.type(screen.getByLabelText('Group name'), 'Studio rent');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));

    await waitFor(() => expect(useUIStore.getState().selectedGroupId).toBe('g-new'));
    expect(useUIStore.getState().notice).toMatchObject({
      message: 'Studio rent created',
      action: { label: 'Invite people', to: paths.groupInvites },
    });
  });

  it('leaves an expense being edited for the list when the group changes', async () => {
    renderSwitcher({ path: paths.editExpense('e1') });
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('option', { name: /Ski trip/ }));
    expect(screen.getByTestId('location').textContent).toBe(paths.spend);
  });

  it('drops a pending joined group when the user picks a group', async () => {
    useUIStore.setState({ pendingGroupId: 'g9' });
    renderSwitcher();
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('option', { name: /Ski trip/ }));
    expect(useUIStore.getState().pendingGroupId).toBeNull();
  });

  it('closes the popover when focus tabs out of it', async () => {
    render(
      <MemoryRouter>
        <GroupSwitcher groups={[home, trip]} user={asUser('mike')} mode="popover" />
        <button type="button">After</button>
      </MemoryRouter>,
    );
    await userEvent.click(trigger());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.tab(); // option -> New group
    await userEvent.tab(); // New group -> After
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('stays on other pages when the group changes', async () => {
    renderSwitcher({ path: paths.summary });
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('option', { name: /Ski trip/ }));
    expect(screen.getByTestId('location').textContent).toBe(paths.summary);
  });
});
