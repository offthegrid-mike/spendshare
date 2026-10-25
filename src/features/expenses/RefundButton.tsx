import { Link } from 'react-router-dom';
import { Undo2 } from 'lucide-react';
import { paths } from '../../lib/paths';
import { isRefund } from '../../lib/refund';
import type { ExpenseDoc } from '../../types/models';

/** The Refund… action for a purchase; nothing for a refund. */
export default function RefundButton({ expense }: { expense: ExpenseDoc }) {
  if (isRefund(expense)) return null;
  return (
    <Link to={paths.refundExpense(expense.id)} className="btn-outline w-full">
      <Undo2 size={15} strokeWidth={1.75} aria-hidden="true" />
      Refund…
    </Link>
  );
}
