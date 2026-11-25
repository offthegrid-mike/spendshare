import { useMemo } from 'react';
import { TRIP_SETTLEMENT_MONTH } from '../lib/travel/valueTrip';
import { useSettlements } from './useSettlements';
import { useTripData } from './useTripData';
import type { TripRecords } from '../features/travel/TripSettings';

/**
 * Whether anything is on a trip yet (expenses, cash, hand-overs or settle-ups),
 * and its wallets, for deciding if its home currency may still change.
 * Undefined while it loads.
 */
export function useTripRecords(tripId: string | null): TripRecords | undefined {
  const { expenses, topUps, wallets, cash, loading } = useTripData(tripId);
  const { settlements, loading: settling } = useSettlements(tripId, TRIP_SETTLEMENT_MONTH);
  return useMemo(() => {
    if (!tripId || loading || settling) return undefined;
    const empty = expenses.length === 0 && topUps.length === 0 && settlements.length === 0
      && cash.wallets.every((w) => w.handovers.length === 0);
    return { empty, walletIds: wallets.map((w) => w.id) };
  }, [tripId, loading, settling, expenses, topUps, settlements, wallets, cash]);
}
