import { memberName } from '../../lib/balance';
import type { Summary } from '../../lib/settlement';
import type { GroupDoc } from '../../types/models';

interface Props {
  summary: Summary;
  viewerUid: string;
  group: GroupDoc;
}

const plain = (cents: number) => (cents / 100).toFixed(2);

/** Shared spending split by payer, with ticks where an even split would fall. */
export default function TugBar({ summary, viewerUid, group }: Props) {
  const total = summary.sharedTotal;
  if (total <= 0) return null;

  const payers = Object.entries(summary.paidShared)
    .filter(([, cents]) => cents > 0)
    .sort(([a], [b]) => Number(b === viewerUid) - Number(a === viewerUid));
  const n = group.memberUids.length;
  const ticks = Array.from({ length: Math.max(n - 1, 0) }, (_, i) => ((i + 1) / n) * 100);
  const paidBy = (uid: string) => summary.paidShared[uid] ?? 0;
  const other = n === 2 ? group.memberUids.find((u) => u !== viewerUid) : undefined;

  return (
    <div>
      <div
        role="img"
        aria-label="Shared spending by payer. The tick marks an even split."
        className="relative flex h-2 gap-[3px]"
      >
        {payers.map(([uid, cents], i) => (
          <div
            key={uid}
            data-segment={uid}
            style={{ width: `${(cents / total) * 100}%` }}
            className={`min-w-[2px] motion-safe:transition-[width] motion-safe:duration-[400ms] ${
              uid === viewerUid ? 'bg-accent' : 'bg-ink/85'
            } ${i === 0 ? 'rounded-l-full' : 'rounded-l-sm'} ${i === payers.length - 1 ? 'rounded-r-full' : 'rounded-r-sm'}`}
          />
        ))}
        {ticks.map((left) => (
          <span
            key={left}
            data-tick
            style={{ left: `${left}%` }}
            className="absolute -bottom-[5px] -top-[5px] w-0.5 -translate-x-1/2 rounded-full bg-ink-muted"
          />
        ))}
      </div>
      {other !== undefined ? (
        <div className="mt-2 flex justify-between gap-2 text-xs text-ink-muted">
          <span>
            <span>You paid</span> <span className="money text-ink">{plain(paidBy(viewerUid))}</span>
          </span>
          <span>even split</span>
          <span>
            <span>{memberName(group, other)} paid</span> <span className="money text-ink">{plain(paidBy(other))}</span>
          </span>
        </div>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {payers.map(([uid, cents]) => (
            <li key={uid} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${uid === viewerUid ? 'bg-accent' : 'bg-ink/85'}`} />
              <span>{uid === viewerUid ? 'You' : memberName(group, uid)}</span>
              <span className="money text-ink">{plain(cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
