import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RefundLinks from './RefundLinks';
import { makeExpense, makeGroup } from '../../test/fixtures';
import { paths } from '../../lib/paths';
import type { ExpenseDoc } from '../../types/models';

const { state } = vi.hoisted(() => ({ state: { refunds: [] as ExpenseDoc[], calledWith: [] as unknown[] } }));
vi.mock('../../hooks/useRefunds', () => ({
  useRefunds: (_gid: string, id: string | undefined) => {
    state.calledWith.push(id);
    return { refunds: state.refunds, loading: false, error: false };
  },
}));

const group = makeGroup('g1', 'Home');

function renderLinks(expense: ExpenseDoc) {
  return render(
    <MemoryRouter>
      <RefundLinks group={group} expense={expense} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.refunds = [];
  state.calledWith = [];
});

describe('RefundLinks', () => {
  it('shows nothing for a purchase without refunds', () => {
    const { container } = renderLinks(makeExpense('e1'));
    expect(container).toBeEmptyDOMElement();
  });

  it("totals a purchase's refunds and links to each one", () => {
    state.refunds = [
      makeExpense('r1', { total: 1500, day: '2026-10-05', kind: 'refund', refundOf: 'e1' }),
      makeExpense('r2', { total: 500, day: '2026-10-09', kind: 'refund', refundOf: 'e1' }),
    ];
    renderLinks(makeExpense('e1'));
    expect(screen.getByText('Refunded A$20.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '5 Oct · A$15.00' })).toHaveAttribute('href', paths.editExpense('r1'));
    expect(screen.getByRole('link', { name: '9 Oct · A$5.00' })).toHaveAttribute('href', paths.editExpense('r2'));
  });

  it('links a refund back to the expense it refunds, without looking up refunds of it', () => {
    renderLinks(makeExpense('r1', { kind: 'refund', refundOf: 'e1' }));
    expect(screen.getByRole('link', { name: 'Refund of an earlier expense' })).toHaveAttribute('href', paths.editExpense('e1'));
    expect(state.calledWith.every((id) => id === undefined)).toBe(true);
  });
});
