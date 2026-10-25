import { CreditCard, Gift } from 'lucide-react';
import Chip from '../../components/ui/Chip';
import { computeAdjustment } from '../../lib/adjustment';
import { plainSigned } from '../../lib/money';
import { isRefund } from '../../lib/refund';
import { memberName } from '../../lib/balance';
import type { ExpenseDoc, GroupDoc, ItemDoc } from '../../types/models';

interface Props {
  expense: ExpenseDoc;
  items: ItemDoc[];
  group: GroupDoc;
  viewerUid: string;
}

const plain = (cents: number) => (cents / 100).toFixed(2);

function Line({ label, value, strong = false }: { label: React.ReactNode; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
      <dt className="flex items-center gap-1.5">{label}</dt>
      <dd className="money text-ink">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-line pt-3.5">
      <h3 className="text-xs font-medium text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

/** Items, adjustments and the split for one expense: the expanded row and the detail pane. */
export default function ExpenseBreakdown({ expense, items, group, viewerUid }: Props) {
  const adj = computeAdjustment(expense);
  const shared = items.filter((it) => it.shared).reduce((s, it) => s + it.amount, 0);
  const personal = items.filter((it) => !it.shared).reduce((s, it) => s + it.amount, 0);
  const n = group.memberUids.length;
  // A refund's split is money coming back, so it reads negative.
  const split = (cents: number) => plainSigned(isRefund(expense) ? -cents : cents);
  let shareLabel = "Each person's share";
  if (n === 2) {
    const other = group.memberUids.find((u) => u !== viewerUid);
    shareLabel = expense.payerUid === viewerUid && other ? `${memberName(group, other)}'s half` : 'Your half';
  }

  return (
    <div className="space-y-3.5 text-sm">
      <Section title="Items">
        <ul className="space-y-2">
          {items.map((it) => {
            const qty = it.quantity ?? 1;
            return (
              <li key={it.id} className="flex items-baseline justify-between gap-3 text-ink-muted">
                <span className="min-w-0">
                  <span className="text-ink">{it.name}</span>
                  {!it.shared && <span className="ml-1.5"><Chip>Personal</Chip></span>}
                  {it.remark && <span data-testid="item-remark" className="block text-xs text-ink-muted">{it.remark}</span>}
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  {qty > 1 && (
                    <span className="money text-xs">{plain(it.unitAmount ?? Math.round(it.amount / qty))} × {qty}</span>
                  )}
                  <span className="money text-ink">{plain(it.amount)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Section>
      {adj.hasAdjustment && (
        <Section title="Adjustments">
          <dl className="space-y-2">
            <Line label="Receipt total" value={plain(adj.total)} />
            {adj.giftCard > 0 && (
              <Line
                label={<><Gift size={14} strokeWidth={1.75} aria-hidden="true" />Gift card</>}
                value={`−${plain(adj.giftCard)}`}
              />
            )}
            {adj.discount > 0 && (
              <Line
                label={<><CreditCard size={14} strokeWidth={1.75} aria-hidden="true" />{`Card discount (${adj.discountPct}%)`}</>}
                value={`−${plain(adj.discount)}`}
              />
            )}
            <Line label="Paid" value={plain(adj.net)} strong />
          </dl>
        </Section>
      )}
      <Section title="Split">
        <dl className="space-y-2">
          <Line label="Shared" value={split(shared)} />
          {personal > 0 && <Line label="Personal" value={split(personal)} />}
          <Line label={shareLabel} value={split(n > 0 ? Math.round(shared / n) : 0)} strong />
        </dl>
      </Section>
    </div>
  );
}
