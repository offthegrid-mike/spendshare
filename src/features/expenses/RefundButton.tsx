import { Link } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import { useRefunds } from '../../hooks/useRefunds';
import { paths } from '../../lib/paths';
import { isRefund, remainingToRefund } from '../../lib/refund';
import type { ExpenseDoc, GroupDoc } from '../../types/models';

/** The Refund… action for a purchase with something left to refund; nothing otherwise. */
export default function RefundButton({ group, expense }: { group: GroupDoc; expense: ExpenseDoc }) {
  const refund = isRefund(expense);
  const { refunds, loading } = useRefunds(group.id, refund ? undefined : expense.id);
  if (refund || loading || remainingToRefund(expense, refunds) === 0) return null;
  return (
    <Link to={paths.refundExpense(expense.id)} className="btn-outline w-full">
      <Undo2 size={15} strokeWidth={1.75} aria-hidden="true" />
      Refund…
    </Link>
  );
}
