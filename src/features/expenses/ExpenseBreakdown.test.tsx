import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExpenseBreakdown from './ExpenseBreakdown';
import { makeExpense, makeGroup, makeItem } from '../../test/fixtures';

const pair = makeGroup('g1', 'Home');
const trio = makeGroup('g2', 'Flat', ['Mike', 'Priya', 'Sam']);

const exp = makeExpense('e1', { total: 3780 });
const items = [
  makeItem('i1', 'e1', { name: 'Oat milk', amount: 1300, quantity: 2, unitAmount: 650, remark: 'Barista edition' }),
  makeItem('i2', 'e1', { name: 'Sourdough', amount: 780 }),
  makeItem('i3', 'e1', { name: 'Razors', amount: 1700, shared: false }),
];

describe('ExpenseBreakdown', () => {
  it('lists each item with its remark, quantity and line total', () => {
    render(<ExpenseBreakdown expense={exp} items={items} group={pair} viewerUid="mike" />);
    expect(screen.getByText('Oat milk')).toBeInTheDocument();
    expect(screen.getByText('Barista edition')).toBeInTheDocument();
    expect(screen.getByText('6.50 × 2')).toBeInTheDocument();
    expect(screen.getByText('13.00')).toBeInTheDocument();
  });

  it('marks personal items', () => {
    render(<ExpenseBreakdown expense={exp} items={items} group={pair} viewerUid="mike" />);
    const razors = screen.getByText('Razors').closest('li')!;
    expect(razors).toHaveTextContent('Personal');
    expect(screen.getByText('Sourdough').closest('li')).not.toHaveTextContent('Personal');
  });

  it('splits shared spending and names whose half it is', () => {
    render(<ExpenseBreakdown expense={exp} items={items} group={pair} viewerUid="mike" />);
    expect(screen.getByText('Shared').nextSibling).toHaveTextContent('20.80');
    expect(screen.getByText('Personal', { selector: 'dt' }).nextSibling).toHaveTextContent('17.00');
    expect(screen.getByText("Priya's half").nextSibling).toHaveTextContent('10.40');
  });

  it('says "Your half" when the other person paid', () => {
    render(<ExpenseBreakdown expense={{ ...exp, payerUid: 'priya' }} items={items} group={pair} viewerUid="mike" />);
    expect(screen.getByText('Your half')).toBeInTheDocument();
  });

  it("uses \"Each person's share\" for three or more", () => {
    render(<ExpenseBreakdown expense={exp} items={items} group={trio} viewerUid="mike" />);
    expect(screen.getByText("Each person's share").nextSibling).toHaveTextContent('6.93');
  });

  it('shows adjustments only when there is a gift card or discount', () => {
    const { rerender } = render(<ExpenseBreakdown expense={exp} items={items} group={pair} viewerUid="mike" />);
    expect(screen.queryByText('Receipt total')).toBeNull();
    rerender(
      <ExpenseBreakdown
        expense={{ ...exp, giftCardAmount: 2000, discountPercent: 2 }}
        items={items}
        group={pair}
        viewerUid="mike"
      />,
    );
    expect(screen.getByText('Receipt total').nextSibling).toHaveTextContent('37.80');
    expect(screen.getByText('Gift card').closest('div')).toHaveTextContent('−20.00');
    expect(screen.getByText('Card discount (2%)').closest('div')).toHaveTextContent('−0.36');
    expect(screen.getByText('Paid').nextSibling).toHaveTextContent('17.44');
  });
});

describe('ExpenseBreakdown for a refund', () => {
  it('shows the split coming back, with a minus sign', () => {
    const refund = makeExpense('r1', { total: 1650, payerUid: 'priya', kind: 'refund', refundOf: 'e1' });
    render(
      <ExpenseBreakdown
        expense={refund}
        items={[makeItem('i9', 'r1', { name: 'Sunscreen', amount: 1650, refund: true })]}
        group={pair}
        viewerUid="mike"
      />,
    );
    expect(screen.getByText('Shared').nextElementSibling).toHaveTextContent('−16.50');
    expect(screen.getByText('Your half').nextElementSibling).toHaveTextContent('−8.25');
  });
});

describe('ExpenseBreakdown tags', () => {
  it("shows each item's tags, linking to the tag's page", () => {
    render(
      <MemoryRouter>
        <ExpenseBreakdown
          expense={makeExpense('e1', { total: 3000 })}
          items={[makeItem('i1', 'e1', { name: 'Paint', amount: 3000, tags: ['Renovation'] })]}
          group={pair}
          viewerUid="mike"
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Renovation' })).toHaveAttribute('href', '/spend/tags/Renovation');
  });
});
