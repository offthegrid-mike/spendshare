import { monthName } from '../../lib/month';
import { formatHours } from '../../lib/work/workTime';
import type { MonthTotal } from '../../lib/work/workYear';

// The income year month by month. "Home days" counts every Home day in the month,
// including late ones not in the claim, while "Counted hours" adds up only the
// Home days in the claim, so the two columns are labelled to say so.

const HEAD = 'px-2 py-2 text-right font-medium first:pl-0 first:text-left last:pr-0';
const CELL = 'px-2 py-2 text-right tabular-nums first:pl-0 first:text-left last:pr-0';

export default function MonthlyTotals({ totals }: { totals: MonthTotal[] }) {
  if (totals.length === 0) return null;

  return (
    <section className="card p-4">
      <table aria-label="Totals per month" className="w-full text-[13px]">
        <thead className="text-ink-muted">
          <tr className="border-b border-line">
            <th scope="col" className={HEAD}>Month</th>
            <th scope="col" className={HEAD}>Counted hours</th>
            <th scope="col" className={HEAD}>Home days</th>
            <th scope="col" className={HEAD}>Office</th>
            <th scope="col" className={HEAD}>Leave</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line text-ink">
          {totals.map((total) => (
            <tr key={total.month}>
              <td className={`${CELL} font-medium`}>{monthName(total.month)}</td>
              <td className={CELL}>{formatHours(total.countedMinutes)}</td>
              <td className={CELL}>{total.homeDays}</td>
              <td className={CELL}>{total.officeDays}</td>
              <td className={CELL}>{total.leaveDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
