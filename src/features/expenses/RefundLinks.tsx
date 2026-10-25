import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { useRefunds } from '../../hooks/useRefunds';
import { formatMoney } from '../../lib/money';
import { paths } from '../../lib/paths';
import { isRefund, refundedTotal } from '../../lib/refund';
import type { ExpenseDoc, GroupDoc } from '../../types/models';

/**
 * Where an expense stands with refunds: a purchase lists the refunds made from
 * it (they can be in other months), a refund links back to what it refunds.
 */
export default function RefundLinks({ group, expense }: { group: GroupDoc; expense: ExpenseDoc }) {
  const refund = isRefund(expense);
  const { refunds, error } = useRefunds(group.id, refund ? undefined : expense.id);

  if (refund) {
    return expense.refundOf ? (
      <Link to={paths.editExpense(expense.refundOf)} className="text-sm font-medium text-accent-ink hover:underline">
        Refund of an earlier expense
      </Link>
    ) : null;
  }
  if (error) return <p className="text-sm text-ink-muted">Couldn't load this expense's refunds.</p>;
  if (refunds.length === 0) return null;

  const total = refundedTotal(refunds);
  const oldestFirst = [...refunds].sort((a, b) => a.date.toMillis() - b.date.toMillis());
  return (
    <div className="space-y-1 rounded-[10px] bg-recessed px-3.5 py-2.5 text-sm">
      <p className="font-medium text-ink">Refunded {formatMoney(total, group.currency)}</p>
      <ul className="space-y-0.5">
        {oldestFirst.map((r) => (
          <li key={r.id}>
            <Link to={paths.editExpense(r.id)} className="text-accent-ink hover:underline">
              {format(r.date.toDate(), 'd MMM')} · {formatMoney(r.total, group.currency)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
