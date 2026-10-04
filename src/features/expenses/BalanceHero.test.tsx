import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { makeGroup } from '../../test/fixtures';
import type { SettlementDoc } from '../../types/models';

const { markSettlementPaid, undoSettlement } = vi.hoisted(() => ({
  markSettlementPaid: vi.fn().mockResolvedValue(undefined),
  undoSettlement: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/settle', () => ({ markSettlementPaid, undoSettlement }));

import BalanceHero from './BalanceHero';

const pair = makeGroup('g1', 'Home');
const trio = makeGroup('g2', 'Flat', ['Mike', 'Priya', 'Sam']);
const item = (amount: number, payerUid: string, shared = true) => ({ amount, payerUid, shared });

// Mike paid 245.42 shared, Priya 68.83 shared, plus Mike's 15.99 personal item.
const october = [item(24542, 'mike'), item(6883, 'priya'), item(1599, 'mike', false)];

function renderHero(props: Partial<React.ComponentProps<typeof BalanceHero>> = {}) {
  return render(
    <MemoryRouter>
      <BalanceHero group={pair} viewerUid="mike" month="2026-10" items={october} settlements={[]} {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('BalanceHero', () => {
  it('shows what the other person owes you', () => {
    renderHero();
    expect(screen.getByText('Priya owes you')).toBeInTheDocument();
    expect(screen.getByText('88.29')).toBeInTheDocument();
  });

  it('shows what you owe from the other side', () => {
    renderHero({ viewerUid: 'priya' });
    expect(screen.getByText('You owe Mike')).toBeInTheDocument();
    expect(screen.getByText('88.29')).toBeInTheDocument();
  });

  it('summarises the month in one line', () => {
    renderHero();
    expect(screen.getByText(/^Spent/)).toHaveTextContent('Spent A$330.24 in October, A$314.25 shared, your share A$157.13');
  });

  it('settles up after confirming', async () => {
    renderHero();
    await userEvent.click(screen.getByRole('button', { name: 'Settle up' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent("Mark Priya's A$88.29 as paid?");
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark paid' }));
    expect(markSettlementPaid).toHaveBeenCalledWith('g1', '2026-10', { fromUid: 'priya', toUid: 'mike', amount: 8829 }, 'mike', []);
  });

  it('does not settle when the dialog is cancelled', async () => {
    renderHero();
    await userEvent.click(screen.getByRole('button', { name: 'Settle up' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(markSettlementPaid).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('offers Undo once the month is settled', async () => {
    const paid: SettlementDoc = { id: '2026-10_priya_mike', month: '2026-10', fromUid: 'priya', toUid: 'mike', amount: 8829, paid: true };
    renderHero({ settlements: [paid] });
    expect(screen.getByText('All settled for October')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Settle up' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undoSettlement).toHaveBeenCalledWith('g1', '2026-10_priya_mike');
  });

  it('shows an inline error when settling fails', async () => {
    markSettlementPaid.mockRejectedValueOnce(new Error('offline'));
    renderHero();
    await userEvent.click(screen.getByRole('button', { name: 'Settle up' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mark paid' }));
    expect(await screen.findByText("Couldn't update the settlement. Try again.")).toBeInTheDocument();
  });

  it('links to Summary to settle up in a group of three or more', () => {
    render(
      <MemoryRouter>
        <BalanceHero group={trio} viewerUid="mike" month="2026-10" items={[item(900, 'mike')]} settlements={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText("You're owed")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settle up' })).toHaveAttribute('href', '/summary');
  });

  it('says there is nothing to settle in an empty month', () => {
    renderHero({ items: [] });
    expect(screen.getByText('Nothing to settle')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /shared spending/i })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/^Spent/)).toBeNull();
  });

  it('is all settled with no tug bar when nothing was shared', () => {
    renderHero({ items: [item(1599, 'mike', false)] });
    expect(screen.getByText('All settled for October')).toBeInTheDocument();
    expect(screen.getByText('0.00')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /shared spending/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settle up' })).toBeNull();
  });

  it('passes the month settlements so a second settle-up adds to the first', async () => {
    const paid: SettlementDoc = { id: '2026-10_priya_mike', month: '2026-10', fromUid: 'priya', toUid: 'mike', amount: 5000, paid: true };
    renderHero({ settlements: [paid] });
    await userEvent.click(screen.getByRole('button', { name: 'Settle up' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mark paid' }));
    expect(markSettlementPaid).toHaveBeenCalledWith('g1', '2026-10', { fromUid: 'priya', toUid: 'mike', amount: 3829 }, 'mike', [paid]);
  });

  it('offers no Settle up in an empty month even if a paid settlement is left over', () => {
    const paid: SettlementDoc = { id: '2026-10_priya_mike', month: '2026-10', fromUid: 'priya', toUid: 'mike', amount: 8829, paid: true };
    renderHero({ items: [], settlements: [paid] });
    expect(screen.getByText('Nothing to settle')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Settle up' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Settle up' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });
});
