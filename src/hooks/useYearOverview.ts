import { useEffect, useMemo, useState } from 'react';
import { onSnapshot, query, where } from 'firebase/firestore';
import { settlementsCol } from '../lib/converters';
import { computeSummary, type Summary } from '../lib/settlement';
import { useYearItems } from './useYearItems';
import type { SettlementDoc } from '../types/models';

export interface MonthOverview {
  /** Everything bought that month, shared or not, in cents. */
  spent: number;
  /** Balances after the month's paid settlements, as Summary computes them. */
  summary: Summary;
}

/**
 * One year of the month rail: per-month spend and balance. Reuses the
 * year's items query and adds the year's settlements (single-field range on
 * `month`, so no extra index).
 */
export function useYearOverview(
  gid: string | null,
  year: string,
  memberUids: string[],
): { months: Record<string, MonthOverview>; total: number; loading: boolean } {
  const { items, loading: itemsLoading } = useYearItems(gid, year);
  const [settlements, setSettlements] = useState<SettlementDoc[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = gid ? `${gid}:${year}` : null;

  useEffect(() => {
    if (!gid) return;
    const q = query(
      settlementsCol(gid),
      where('month', '>=', `${year}-01`),
      where('month', '<=', `${year}-12`),
    );
    const unsub = onSnapshot(q, (snap) => {
      setSettlements(snap.docs.map((d) => d.data()));
      setLoadedKey(`${gid}:${year}`);
    }, () => {
      // Transient permission-denied can occur while membership propagates;
      // unblock loading and let the next snapshot resolve it.
      setLoadedKey(`${gid}:${year}`);
    });
    return () => {
      unsub();
      setSettlements([]);
    };
  }, [gid, year]);

  const { months, total } = useMemo(() => {
    const itemsByMonth = new Map<string, typeof items>();
    for (const it of items) itemsByMonth.set(it.month, [...(itemsByMonth.get(it.month) ?? []), it]);
    const settlementsByMonth = new Map<string, SettlementDoc[]>();
    for (const s of settlements) settlementsByMonth.set(s.month, [...(settlementsByMonth.get(s.month) ?? []), s]);

    const out: Record<string, MonthOverview> = {};
    let sum = 0;
    for (const month of new Set([...itemsByMonth.keys(), ...settlementsByMonth.keys()])) {
      const monthItems = itemsByMonth.get(month) ?? [];
      const spent = monthItems.reduce((s, it) => s + Math.round(it.amount), 0);
      out[month] = { spent, summary: computeSummary(memberUids, monthItems, settlementsByMonth.get(month) ?? []) };
      sum += spent;
    }
    return { months: out, total: sum };
  }, [items, settlements, memberUids]);

  const loading = gid !== null && (itemsLoading || loadedKey !== key);
  return { months, total, loading };
}
