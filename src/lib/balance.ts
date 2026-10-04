import { format } from 'date-fns';
import { formatMoney } from './money';
import type { Summary } from './settlement';
import type { GroupDoc, SettlementDoc } from '../types/models';

export type BalanceTone = 'owed' | 'owe' | 'settled';

export function memberName(group: GroupDoc, uid: string): string {
  const m = group.members[uid];
  return m?.displayName || m?.email || uid;
}

function viewerBalance(summary: Summary, viewerUid: string): number {
  return summary.balance[viewerUid] ?? 0;
}

function toneOf(balance: number): BalanceTone {
  if (balance > 0) return 'owed';
  if (balance < 0) return 'owe';
  return 'settled';
}

/** In a two-person group, the member who isn't the viewer. */
function otherMember(group: GroupDoc, viewerUid: string): string | null {
  if (group.memberUids.length !== 2) return null;
  return group.memberUids.find((u) => u !== viewerUid) ?? null;
}

/** The balance hero's headline, from the viewer's side. */
export function describeBalance(
  summary: Summary,
  viewerUid: string,
  group: GroupDoc,
  monthLabel: string,
): { label: string; amount: number; tone: BalanceTone } {
  const balance = viewerBalance(summary, viewerUid);
  const tone = toneOf(balance);
  if (tone === 'settled') return { label: `All settled for ${monthLabel}`, amount: 0, tone };
  const other = otherMember(group, viewerUid);
  const label =
    tone === 'owed'
      ? other ? `${memberName(group, other)} owes you` : "You're owed"
      : other ? `You owe ${memberName(group, other)}` : 'You owe';
  return { label, amount: Math.abs(balance), tone };
}

/** The month rail's one-line status, e.g. "Priya owes 88.29". */
export function railStatus(summary: Summary, viewerUid: string, group: GroupDoc): { text: string; tone: BalanceTone } {
  const balance = viewerBalance(summary, viewerUid);
  const tone = toneOf(balance);
  if (tone === 'settled') return { text: 'Settled', tone };
  const amount = (Math.abs(balance) / 100).toFixed(2);
  if (tone === 'owe') return { text: `You owe ${amount}`, tone };
  const other = otherMember(group, viewerUid);
  return { text: other ? `${memberName(group, other)} owes ${amount}` : `You're owed ${amount}`, tone };
}

/** "Settled 2 Nov: Priya paid you A$88.29", from the viewer's side. */
export function settlementEventText(s: SettlementDoc, viewerUid: string, group: GroupDoc, currency: string): string {
  const from = s.fromUid === viewerUid ? 'You' : memberName(group, s.fromUid);
  const to = s.toUid === viewerUid ? 'you' : memberName(group, s.toUid);
  // paidAt is a pending server timestamp until the write is acknowledged.
  const when = s.paidAt?.toDate ? ` ${format(s.paidAt.toDate(), 'd MMM')}` : '';
  return `Settled${when}: ${from} paid ${to} ${formatMoney(s.amount, currency)}`;
}
