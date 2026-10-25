import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RefundButton from './RefundButton';
import { makeExpense, makeGroup } from '../../test/fixtures';
import { paths } from '../../lib/paths';
import type { ExpenseDoc } from '../../types/models';

const { state } = vi.hoisted(() => ({ state: { refunds: [] as ExpenseDoc[], loading: false } }));
vi.mock('../../hooks/useRefunds', () => ({
  useRefunds: () => ({ refunds: state.refunds, loading: state.loading, error: false }),
}));

const group = makeGroup('g1', 'Home');
const purchase = makeExpense('e1', { total: 5000 });
const refund = (id: string, total: number) => makeExpense(id, { total, kind: 'refund', refundOf: 'e1' });

function renderButton(expense: ExpenseDoc) {
  return render(
    <MemoryRouter>
      <RefundButton group={group} expense={expense} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.refunds = [];
  state.loading = false;
});

describe('RefundButton', () => {
  it('offers to refund a purchase with something left to refund', () => {
    state.refunds = [refund('r1', 2000)];
    renderButton(purchase);
    expect(screen.getByRole('link', { name: 'Refund…' })).toHaveAttribute('href', paths.refundExpense('e1'));
  });

  it('hides once the whole receipt has been refunded', () => {
    state.refunds = [refund('r1', 3000), refund('r2', 2000)];
    renderButton(purchase);
    expect(screen.queryByRole('link', { name: 'Refund…' })).toBeNull();
  });

  it('waits for the refunds before offering it', () => {
    state.loading = true;
    renderButton(purchase);
    expect(screen.queryByRole('link', { name: 'Refund…' })).toBeNull();
  });

  it('never offers to refund a refund', () => {
    renderButton(refund('r1', 1000));
    expect(screen.queryByRole('link', { name: 'Refund…' })).toBeNull();
  });
});
