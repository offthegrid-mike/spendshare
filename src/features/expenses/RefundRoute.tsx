import ExpenseEditor from './ExpenseEditor';
import { RouteSkeleton } from '../../components/AppSkeletons';
import { useExpense } from '../../hooks/useExpense';
import { useRefunds } from '../../hooks/useRefunds';
import { isRefund, remainingToRefund } from '../../lib/refund';
import type { ExpenseDoc, GroupDoc, ItemDoc } from '../../types/models';

interface Props {
  group: GroupDoc;
  currentUserUid: string;
  /** The expense being refunded. */
  originalId: string;
  /** An existing refund of it, to edit; otherwise a new refund. */
  refund?: ExpenseDoc;
  refundItems?: ItemDoc[];
}

/**
 * The expense editor as a refund of `originalId`, capped at what is left to
 * refund: what was paid for it, less its other refunds.
 */
export default function RefundRoute({ group, currentUserUid, originalId, refund, refundItems }: Props) {
  const { expense: original, items, loading } = useExpense(group.id, originalId);
  const { refunds, loading: refundsLoading, error } = useRefunds(group.id, originalId);

  if (loading || refundsLoading) return <RouteSkeleton />;
  if (!original) return <div className="text-sm text-ink-muted">Expense not found.</div>;
  if (isRefund(original)) return <div className="text-sm text-ink-muted">A refund can't be refunded.</div>;
  if (error) {
    return <p className="text-sm text-negative">Could not load this expense's refunds. Please try again.</p>;
  }

  return (
    <ExpenseEditor
      key={refund?.id ?? `refund-of-${original.id}`}
      group={group}
      currentUserUid={currentUserUid}
      expense={refund}
      items={refundItems}
      refundOf={{ expense: original, items, remaining: remainingToRefund(original, refunds, refund?.id) }}
    />
  );
}
