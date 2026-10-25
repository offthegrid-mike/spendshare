import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import RefundRoute from './RefundRoute';
import { makeExpense, makeGroup, makeItem } from '../../test/fixtures';
import type { ExpenseDoc, ItemDoc } from '../../types/models';

const { state, editorProps } = vi.hoisted(() => ({
  state: {
    original: null as ExpenseDoc | null,
    originalItems: [] as ItemDoc[],
    originalLoading: false,
    refunds: [] as ExpenseDoc[],
    refundsLoading: false,
    refundsError: false,
  },
  editorProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../hooks/useExpense', () => ({
  useExpense: () => ({ expense: state.original, items: state.originalItems, loading: state.originalLoading }),
}));
vi.mock('../../hooks/useRefunds', () => ({
  useRefunds: () => ({ refunds: state.refunds, loading: state.refundsLoading, error: state.refundsError }),
}));
vi.mock('./ExpenseEditor', () => ({
  default: (props: Record<string, unknown>) => {
    editorProps.push(props);
    return <p>Editor</p>;
  },
}));
vi.mock('../../components/AppSkeletons', () => ({ RouteSkeleton: () => <p>Loading</p> }));

const group = makeGroup('g1', 'Home');
const original = makeExpense('e1', { shopName: 'Woolworths', total: 5000 });
const originalItems = [makeItem('i1', 'e1', { amount: 5000 })];
const earlier = makeExpense('r0', { total: 1500, kind: 'refund', refundOf: 'e1' });

beforeEach(() => {
  editorProps.length = 0;
  state.original = original;
  state.originalItems = originalItems;
  state.originalLoading = false;
  state.refunds = [earlier];
  state.refundsLoading = false;
  state.refundsError = false;
});

const lastEditor = () => editorProps[editorProps.length - 1];

describe('RefundRoute', () => {
  it('opens the editor as a new refund of the original, capped at what is left', () => {
    render(<RefundRoute group={group} currentUserUid="mike" originalId="e1" />);
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(lastEditor().expense).toBeUndefined();
    expect(lastEditor().refundOf).toEqual({ expense: original, items: originalItems, remaining: 3500 });
  });

  it('edits an existing refund, leaving it out of what is already refunded', () => {
    const refund = makeExpense('r0', { total: 1500, kind: 'refund', refundOf: 'e1' });
    const refundItems = [makeItem('i9', 'r0', { amount: 1500, refund: true })];
    render(<RefundRoute group={group} currentUserUid="mike" originalId="e1" refund={refund} refundItems={refundItems} />);
    expect(lastEditor().expense).toBe(refund);
    expect(lastEditor().items).toBe(refundItems);
    expect((lastEditor().refundOf as { remaining: number }).remaining).toBe(5000);
  });

  it('waits for the original and its refunds', () => {
    state.refundsLoading = true;
    render(<RefundRoute group={group} currentUserUid="mike" originalId="e1" />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(editorProps).toHaveLength(0);
  });

  it('says so when the original is gone', () => {
    state.original = null;
    render(<RefundRoute group={group} currentUserUid="mike" originalId="e1" />);
    expect(screen.getByText('Expense not found.')).toBeInTheDocument();
  });

  it("says a refund's original is gone, rather than that the refund isn't found", () => {
    state.original = null;
    const refund = makeExpense('r0', { total: 1500, kind: 'refund', refundOf: 'e1' });
    render(<RefundRoute group={group} currentUserUid="mike" originalId="e1" refund={refund} refundItems={[]} />);
    expect(screen.getByText('The expense this refunds has been deleted. You can still delete this refund.')).toBeInTheDocument();
  });

  it('will not refund a refund', () => {
    state.original = earlier;
    render(<RefundRoute group={group} currentUserUid="mike" originalId="r0" />);
    expect(screen.getByText("A refund can't be refunded.")).toBeInTheDocument();
    expect(editorProps).toHaveLength(0);
  });

  it('will not guess what is left when the refunds fail to load', () => {
    state.refundsError = true;
    render(<RefundRoute group={group} currentUserUid="mike" originalId="e1" />);
    expect(screen.getByText(/Could not load this expense's refunds/)).toBeInTheDocument();
    expect(editorProps).toHaveLength(0);
  });
});
