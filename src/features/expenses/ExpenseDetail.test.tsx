import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ExpenseDetail from './ExpenseDetail';

vi.mock('./RefundLinks', () => ({ default: () => <p>Refund links</p> }));
import { makeExpense, makeGroup, makeItem } from '../../test/fixtures';
import { paths } from '../../lib/paths';

const pair = makeGroup('g1', 'Home');
const exp = makeExpense('e1', { shopName: 'Woolworths', total: 4250, day: '2026-10-03' });
const items = [makeItem('i1', 'e1', { name: 'Milk', amount: 4250 })];

describe('ExpenseDetail', () => {
  it('shows the selected expense with its items and actions', async () => {
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <ExpenseDetail expense={exp} items={items} group={pair} viewerUid="mike" onDelete={onDelete} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Woolworths' })).toBeInTheDocument();
    expect(screen.getByText('Sat 3 Oct · paid by you')).toBeInTheDocument();
    expect(screen.getByText('A$42.50')).toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Refund links')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', paths.editExpense('e1'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
    expect(screen.getByText('Use ↑ ↓ to move between expenses · ? for all shortcuts')).toBeInTheDocument();
  });

  it('shows a given category’s tile in place of the first item’s', () => {
    render(
      <MemoryRouter>
        <ExpenseDetail expense={exp} items={items} group={pair} viewerUid="mike" onDelete={() => {}} category="Kids" />
      </MemoryRouter>,
    );
    // Kids has no icon, so its tile shows its initial; Groceries would show a basket.
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(document.querySelector('.lucide-shopping-basket')).toBeNull();
  });

  it('names the payer when it is someone else', () => {
    render(
      <MemoryRouter>
        <ExpenseDetail expense={{ ...exp, payerUid: 'priya' }} items={items} group={pair} viewerUid="mike" onDelete={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Sat 3 Oct · paid by Priya')).toBeInTheDocument();
  });

  it('asks for a selection when nothing is selected', () => {
    render(
      <MemoryRouter>
        <ExpenseDetail expense={null} items={[]} group={pair} viewerUid="mike" onDelete={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Select an expense to see its items.')).toBeInTheDocument();
  });
});

describe('ExpenseDetail for a refund', () => {
  it('marks it as a refund, refunded to its payer, with the amount coming back', () => {
    const refund = makeExpense('r1', { shopName: 'Woolworths', total: 1200, day: '2026-10-05', kind: 'refund', refundOf: 'e1' });
    render(
      <MemoryRouter>
        <ExpenseDetail
          expense={refund}
          items={[makeItem('i9', 'r1', { name: 'Milk', amount: 1200, refund: true })]}
          group={pair}
          viewerUid="mike"
          onDelete={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Refund')).toBeInTheDocument();
    expect(screen.getByText('Mon 5 Oct · refunded to you')).toBeInTheDocument();
    expect(screen.getByText('−A$12.00')).toBeInTheDocument();
  });
});

describe('ExpenseDetail refund action', () => {
  it('offers to refund a purchase', () => {
    render(
      <MemoryRouter>
        <ExpenseDetail expense={exp} items={items} group={pair} viewerUid="mike" onDelete={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Refund…' })).toHaveAttribute('href', paths.refundExpense('e1'));
  });

  it('does not offer to refund a refund', () => {
    const refund = makeExpense('r1', { total: 1200, kind: 'refund', refundOf: 'e1' });
    render(
      <MemoryRouter>
        <ExpenseDetail expense={refund} items={[]} group={pair} viewerUid="mike" onDelete={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: 'Refund…' })).toBeNull();
  });
});
