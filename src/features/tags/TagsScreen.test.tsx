import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TagsScreen from './TagsScreen';
import TagScreen from './TagScreen';
import { makeExpense, makeGroup, makeItem } from '../../test/fixtures';
import { paths } from '../../lib/paths';
import type { ExpenseDoc, ItemDoc } from '../../types/models';

const { history } = vi.hoisted(() => ({
  history: {
    expenses: [] as ExpenseDoc[],
    itemsByExpense: {} as Record<string, ItemDoc[]>,
    loading: false,
    error: null as string | null,
  },
}));
vi.mock('../../hooks/useAllExpenses', () => ({ useAllExpenses: () => history }));
vi.mock('../../components/AppSkeletons', () => ({ RouteSkeleton: () => <p>Loading</p> }));

const group = makeGroup('g1', 'Home');
const trip = makeExpense('e1', { shopName: 'Qantas', day: '2026-09-02', total: 50000 });
const shop = makeExpense('e2', { shopName: 'Coles', day: '2026-10-05', total: 5000 });
const refund = makeExpense('r1', { shopName: 'Qantas', day: '2026-10-08', total: 10000, kind: 'refund', refundOf: 'e1' });

beforeEach(() => {
  history.expenses = [refund, shop, trip];
  history.itemsByExpense = {
    e1: [makeItem('i1', 'e1', { amount: 50000, tags: ['Holiday 2026'] })],
    e2: [
      makeItem('i2', 'e2', { amount: 3000, tags: ['Holiday 2026', 'Snacks'] }),
      makeItem('i3', 'e2', { amount: 2000 }),
    ],
    r1: [makeItem('i4', 'r1', { amount: 10000, refund: true, tags: ['Holiday 2026'] })],
  };
  history.loading = false;
  history.error = null;
});

describe('TagsScreen', () => {
  const renderTags = () => render(<MemoryRouter><TagsScreen group={group} /></MemoryRouter>);

  it('lists every tag with what it adds up to, refunds taken off, linking to each', () => {
    renderTags();
    expect(screen.getByRole('heading', { name: 'Tags' })).toBeInTheDocument();
    const holiday = screen.getByRole('link', { name: /Holiday 2026/ });
    expect(holiday).toHaveAttribute('href', paths.tag('Holiday 2026'));
    expect(holiday).toHaveTextContent('A$430.00');
    expect(holiday).toHaveTextContent('3 expenses');
    expect(screen.getByRole('link', { name: /Snacks/ })).toHaveTextContent('1 expense');
  });

  it('explains how to tag when there are none', () => {
    history.itemsByExpense = { e1: [makeItem('i1', 'e1')] };
    renderTags();
    expect(screen.getByText(/No tags yet/)).toBeInTheDocument();
  });

  it('shows loading and errors', () => {
    history.loading = true;
    const { unmount } = renderTags();
    expect(screen.getByText('Loading')).toBeInTheDocument();
    unmount();
    history.loading = false;
    history.error = 'Could not load expenses. Please try again.';
    renderTags();
    expect(screen.getByText('Could not load expenses. Please try again.')).toBeInTheDocument();
  });
});

describe('TagScreen', () => {
  const renderTag = (tag: string) => render(<MemoryRouter><TagScreen group={group} tag={tag} /></MemoryRouter>);

  it("totals the tag and lists its expenses by month, each with what it spent on the tag", () => {
    renderTag('Holiday 2026');
    expect(screen.getByRole('heading', { name: 'Holiday 2026' })).toBeInTheDocument();
    expect(screen.getByText('A$430.00')).toBeInTheDocument();

    const october = screen.getByRole('region', { name: 'October 2026' });
    const rows = within(october).getAllByRole('link');
    expect(rows.map((r) => r.getAttribute('href'))).toEqual([paths.editExpense('r1'), paths.editExpense('e2')]);
    expect(rows[0]).toHaveTextContent('Refund');
    expect(rows[0]).toHaveTextContent('−A$100.00');
    expect(rows[1]).toHaveTextContent('A$30.00');

    const september = screen.getByRole('region', { name: 'September 2026' });
    expect(within(september).getByRole('link')).toHaveTextContent('A$500.00');
  });

  it('says so when nothing has the tag', () => {
    renderTag('Nope');
    expect(screen.getByText('Nothing is tagged “Nope”.')).toBeInTheDocument();
  });
});
