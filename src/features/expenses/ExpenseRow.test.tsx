import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ExpenseRow from './ExpenseRow';

vi.mock('./RefundLinks', () => ({ default: () => <p>Refund links</p> }));
vi.mock('../../hooks/useRefunds', () => ({ useRefunds: () => ({ refunds: [], loading: false, error: false }) }));
import { makeExpense, makeGroup, makeItem } from '../../test/fixtures';
import { paths } from '../../lib/paths';

const pair = makeGroup('g1', 'Home');
const exp = makeExpense('e1', { shopName: 'Woolworths', total: 4250, itemCount: 2, payerUid: 'priya' });
const items = [makeItem('i1', 'e1', { name: 'Milk', amount: 2500 }), makeItem('i2', 'e1', { name: 'Bread', amount: 1750 })];

type RowProps = React.ComponentProps<typeof ExpenseRow>;

function renderRow(overrides: Record<string, unknown> = {}) {
  const props = {
    expense: exp,
    items,
    group: pair,
    viewerUid: 'mike',
    mode: 'disclosure',
    expanded: false,
    onToggle: () => {},
    onDelete: () => {},
    ...overrides,
  } as RowProps;
  return render(
    <MemoryRouter>
      <ExpenseRow {...props} />
    </MemoryRouter>,
  );
}

describe('ExpenseRow (disclosure)', () => {
  it('shows shop, category, item count, payer and amount', () => {
    renderRow();
    expect(screen.getByText('Woolworths')).toBeInTheDocument();
    expect(screen.getByText('Groceries · 2 items')).toBeInTheDocument();
    expect(screen.getByTitle('Paid by Priya')).toHaveTextContent('P');
    expect(screen.getByText('42.50')).toBeInTheDocument();
  });

  it('shows a given category in place of the first item’s', () => {
    renderRow({ category: 'Household' });
    expect(screen.getByText('Household · 2 items')).toBeInTheDocument();
    expect(screen.queryByText('Groceries · 2 items')).toBeNull();
  });

  it('shows a given category on a desktop option row too', () => {
    renderRow({ mode: 'option', selected: false, onSelect: () => {}, category: 'Household' });
    expect(screen.getByText('Household · 2 items')).toBeInTheDocument();
  });

  it('is a collapsed disclosure that reports a toggle', async () => {
    const onToggle = vi.fn();
    renderRow({ onToggle });
    const button = screen.getByRole('button', { name: /Woolworths/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows refund links only when expanded', () => {
    renderRow();
    expect(screen.queryByText('Refund links')).toBeNull();
  });

  it('reveals the items, Edit and Delete when expanded', async () => {
    const onDelete = vi.fn();
    renderRow({ expanded: true, onDelete });
    expect(screen.getByText('Refund links')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Woolworths/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', paths.editExpense('e1'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('shows the net amount with the struck-through receipt total after a gift card', () => {
    renderRow({ expense: { ...exp, giftCardAmount: 2000 } });
    expect(screen.getByText('22.50')).toBeInTheDocument();
    expect(screen.getByText('42.50').tagName).toBe('S');
  });

  it('copes with a payer who has left the group', () => {
    renderRow({ expense: { ...exp, payerUid: 'ghost' } });
    expect(screen.getByTitle('Paid by ghost')).toHaveTextContent('G');
  });

  it('shows just the item count when there is no category', () => {
    renderRow({ items: [] , expense: { ...exp, itemCount: 1 } });
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });
});

describe('ExpenseRow (option)', () => {
  it('is a selectable option', async () => {
    const onSelect = vi.fn();
    renderRow({ mode: 'option', selected: true, onSelect });
    const option = screen.getByRole('option', { name: /Woolworths/ });
    expect(option).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(option);
    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
  });
});

describe('ExpenseRow for a refund', () => {
  const refund = makeExpense('r1', { shopName: 'Woolworths', total: 1200, itemCount: 1, payerUid: 'mike', kind: 'refund', refundOf: 'e1' });
  const refundItems = [makeItem('i9', 'r1', { name: 'Milk', amount: 1200, refund: true })];

  it('marks it as a refund and shows the amount coming back', () => {
    renderRow({ expense: refund, items: refundItems });
    expect(screen.getByText('Refund')).toBeInTheDocument();
    expect(screen.getByText('−12.00')).toBeInTheDocument();
  });
});
