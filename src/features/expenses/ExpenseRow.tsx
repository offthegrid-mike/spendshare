import { Link } from 'react-router-dom';
import { CreditCard, Gift, Pencil, Trash2 } from 'lucide-react';
import Avatar from '../../components/ui/Avatar';
import Chip from '../../components/ui/Chip';
import CategoryTile from '../../components/ui/CategoryTile';
import ExpenseBreakdown from './ExpenseBreakdown';
import RefundButton from './RefundButton';
import RefundLinks from './RefundLinks';
import { computeAdjustment } from '../../lib/adjustment';
import { isRefund, signedNet } from '../../lib/refund';
import { plainSigned } from '../../lib/money';
import { memberName } from '../../lib/balance';
import { iconForCategory } from '../../lib/categoryIcons';
import { paths } from '../../lib/paths';
import type { ExpenseDoc, GroupDoc, ItemDoc } from '../../types/models';

interface Common {
  expense: ExpenseDoc;
  items: ItemDoc[];
  group: GroupDoc;
  viewerUid: string;
  /** Shown in place of the first item's category, e.g. the one the list is filtered to. */
  category?: string;
}

type Props = Common &
  (
    | { mode: 'disclosure'; expanded: boolean; onToggle: () => void; onDelete: () => void; deleting?: boolean }
    | { mode: 'option'; selected: boolean; onSelect: () => void }
  );

const plain = (cents: number) => (cents / 100).toFixed(2);

function RowContent({ expense, items, group, viewerUid, category: given, selected = false }: Common & { selected?: boolean }) {
  const category = given ?? items[0]?.category ?? '';
  const count = `${expense.itemCount} item${expense.itemCount === 1 ? '' : 's'}`;
  const adj = computeAdjustment(expense);
  const refund = isRefund(expense);
  const payer = memberName(group, expense.payerUid);
  const AdjIcon = adj.giftCard > 0 ? Gift : CreditCard;

  return (
    <>
      <CategoryTile
        icon={iconForCategory(category)}
        label={category || expense.shopName}
        selected={selected}
        badge={
          <span title={`Paid by ${payer}`} className="block">
            <Avatar name={payer} tone={expense.payerUid === viewerUid ? 'me' : 'them'} size="sm" ring />
          </span>
        }
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-ink">{expense.shopName}</span>
          {refund && <Chip>Refund</Chip>}
        </span>
        <span className="block truncate text-xs text-ink-muted">{category ? `${category} · ${count}` : count}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`money block font-semibold ${refund ? 'text-accent' : 'text-ink'}`}>
          {plainSigned(signedNet(expense))}
        </span>
        {adj.hasAdjustment && !refund && (
          <span className="money flex items-center justify-end gap-1 text-[11px] text-ink-faint">
            <AdjIcon size={12} strokeWidth={1.75} aria-hidden="true" />
            <s>{plain(adj.total)}</s>
          </span>
        )}
      </span>
    </>
  );
}

/** One expense: a tap-to-expand disclosure on mobile, a selectable option on desktop. */
export default function ExpenseRow(props: Props) {
  const { expense, items, group, viewerUid, category } = props;
  const rowClass = 'flex w-full items-center gap-3 px-3.5 py-[11px] text-left transition-colors';

  if (props.mode === 'option') {
    return (
      <div
        role="option"
        aria-selected={props.selected}
        tabIndex={props.selected ? 0 : -1}
        data-expense-id={expense.id}
        onClick={props.onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            props.onSelect();
          }
        }}
        className={`${rowClass} cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 ${
          props.selected ? 'bg-accent-soft shadow-[inset_3px_0_0_rgb(var(--accent))]' : 'hover:bg-recessed/55'
        }`}
      >
        <RowContent {...{ expense, items, group, viewerUid, category }} selected={props.selected} />
      </div>
    );
  }

  const regionId = `expense-${expense.id}-details`;
  return (
    <div>
      <button
        type="button"
        aria-expanded={props.expanded}
        aria-controls={regionId}
        onClick={props.onToggle}
        className={`${rowClass} hover:bg-recessed/55`}
      >
        <RowContent {...{ expense, items, group, viewerUid, category }} />
      </button>
      {props.expanded && (
        <div id={regionId} className="grid motion-safe:animate-expand">
          <div className="space-y-3 overflow-hidden px-3.5 pb-3.5">
            <ExpenseBreakdown expense={expense} items={items} group={group} viewerUid={viewerUid} />
            <RefundLinks group={group} expense={expense} />
            <RefundButton group={group} expense={expense} />
            <div className="flex gap-2">
              <Link to={paths.editExpense(expense.id)} className="btn-outline flex-1">
                <Pencil size={15} strokeWidth={1.75} aria-hidden="true" />
                Edit
              </Link>
              <button
                type="button"
                disabled={props.deleting}
                onClick={props.onDelete}
                className="btn-ghost flex-1 text-negative hover:bg-negative/10 hover:text-negative"
              >
                <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
