import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import CategoryTile from '../../components/ui/CategoryTile';
import ExpenseBreakdown from './ExpenseBreakdown';
import { computeAdjustment } from '../../lib/adjustment';
import { memberName } from '../../lib/balance';
import { iconForCategory } from '../../lib/categoryIcons';
import { formatMoney } from '../../lib/money';
import { paths } from '../../lib/paths';
import type { ExpenseDoc, GroupDoc, ItemDoc } from '../../types/models';

interface Props {
  expense: ExpenseDoc | null;
  items: ItemDoc[];
  group: GroupDoc;
  viewerUid: string;
  /** Shown in place of the first item's category, e.g. the one the list is filtered to. */
  category?: string;
  onDelete: () => void;
  deleting?: boolean;
}

/** Desktop detail pane for the selected expense. */
export default function ExpenseDetail({ expense, items, group, viewerUid, category: given, onDelete, deleting = false }: Props) {
  if (!expense) {
    return <p className="m-auto text-center text-xs text-ink-muted">Select an expense to see its items.</p>;
  }
  const category = given ?? items[0]?.category ?? '';
  const date = expense.date?.toDate?.();
  const payer = expense.payerUid === viewerUid ? 'you' : memberName(group, expense.payerUid);
  const meta = [date ? format(date, 'EEE d MMM') : null, `paid by ${payer}`].filter(Boolean).join(' · ');

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <CategoryTile icon={iconForCategory(category)} label={category || expense.shopName} size="lg" selected />
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold text-ink">{expense.shopName}</h2>
          <p className="text-xs text-ink-muted">{meta}</p>
        </div>
      </div>
      <p className="money text-[32px] font-semibold tracking-[-0.03em] text-ink">
        {formatMoney(computeAdjustment(expense).net, group.currency)}
      </p>
      <ExpenseBreakdown expense={expense} items={items} group={group} viewerUid={viewerUid} />
      <div className="mt-auto flex gap-2 pt-2">
        <Link to={paths.editExpense(expense.id)} aria-keyshortcuts="E" title="Edit (E)" className="btn-outline flex-1">
          <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
          Edit
        </Link>
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="btn-ghost flex-1 text-negative hover:bg-negative/10 hover:text-negative"
        >
          <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
          Delete
        </button>
      </div>
      <p className="text-center text-xs text-ink-muted">Use ↑ ↓ to move between expenses · ? for all shortcuts</p>
    </div>
  );
}
