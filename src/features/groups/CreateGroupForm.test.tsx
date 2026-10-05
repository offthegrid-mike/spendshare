import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import CreateGroupForm from './CreateGroupForm';

const { createGroup } = vi.hoisted(() => ({ createGroup: vi.fn() }));
vi.mock('../../lib/createGroup', () => ({ createGroup, CURRENCIES: ['AUD', 'USD', 'EUR', 'GBP'] }));

const user = { uid: 'mike', displayName: 'Mike', email: 'mike@example.com' } as unknown as User;

beforeEach(() => {
  createGroup.mockReset().mockResolvedValue('g-new');
});

describe('CreateGroupForm', () => {
  it('creates the group with the trimmed name and chosen currency', async () => {
    const onCreated = vi.fn();
    render(<CreateGroupForm user={user} onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText('Group name'), '  Tasmania trip ');
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'USD');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('g-new', 'Tasmania trip'));
    expect(createGroup).toHaveBeenCalledWith(user, { name: 'Tasmania trip', currency: 'USD' });
  });

  it('rejects a whitespace-only name without writing anything', async () => {
    const onCreated = vi.fn();
    render(<CreateGroupForm user={user} onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText('Group name'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));

    expect(screen.getByText('Enter a group name.')).toBeInTheDocument();
    expect(createGroup).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('shows an inline error when the write fails', async () => {
    createGroup.mockRejectedValue(new Error('offline'));
    const onCreated = vi.fn();
    render(<CreateGroupForm user={user} onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText('Group name'), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));

    expect(await screen.findByText("Couldn't create the group. Try again.")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('defaults the currency to defaultCurrency when it is a known currency', () => {
    render(<CreateGroupForm user={user} defaultCurrency="GBP" onCreated={vi.fn()} />);
    expect(screen.getByLabelText('Currency')).toHaveValue('GBP');
  });

  it('falls back to AUD for an unknown defaultCurrency', () => {
    render(<CreateGroupForm user={user} defaultCurrency="JPY" onCreated={vi.fn()} />);
    expect(screen.getByLabelText('Currency')).toHaveValue('AUD');
  });

  it('stays disabled after a successful create so a second tap cannot create it twice', async () => {
    render(<CreateGroupForm user={user} onCreated={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Group name'), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));

    await waitFor(() => expect(createGroup).toHaveBeenCalledTimes(1));
    const button = screen.getByRole('button', { name: 'Creating…' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(createGroup).toHaveBeenCalledTimes(1);
  });

  it('re-enables submit after a failed create', async () => {
    createGroup.mockRejectedValue(new Error('offline'));
    render(<CreateGroupForm user={user} onCreated={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Group name'), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: 'Create group' }));
    await screen.findByText("Couldn't create the group. Try again.");
    expect(screen.getByRole('button', { name: 'Create group' })).toBeEnabled();
  });

  it('disables submit while the host is busy', () => {
    render(<CreateGroupForm user={user} busy onCreated={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Create group' })).toBeDisabled();
  });
});
