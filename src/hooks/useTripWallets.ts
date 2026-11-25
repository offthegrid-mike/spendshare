import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { topUpsCol, walletsCol } from '../lib/converters';
import type { TopUpDoc, WalletDoc } from '../types/models';

/** A trip's cash wallets and the cash put into them. Loading is derived from stored keys, as in useTripExpenses. */
export function useTripWallets(tripId: string | null): {
  wallets: WalletDoc[];
  topUps: TopUpDoc[];
  loading: boolean;
  error: boolean;
} {
  const [wallets, setWallets] = useState<WalletDoc[]>([]);
  const [topUps, setTopUps] = useState<TopUpDoc[]>([]);
  const [walletsKey, setWalletsKey] = useState<string | null>(null);
  const [topUpsKey, setTopUpsKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    const unsubWallets = onSnapshot(
      walletsCol(tripId),
      (snap) => {
        setWallets(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setWalletsKey(tripId);
      },
      () => { setErrorKey(tripId); setWalletsKey(tripId); },
    );
    const unsubTopUps = onSnapshot(
      topUpsCol(tripId),
      (snap) => {
        setTopUps(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setTopUpsKey(tripId);
      },
      () => { setErrorKey(tripId); setTopUpsKey(tripId); },
    );
    return () => {
      unsubWallets();
      unsubTopUps();
    };
  }, [tripId]);

  const current = tripId !== null && walletsKey === tripId && topUpsKey === tripId;
  return {
    wallets: current ? wallets : [],
    topUps: current ? topUps : [],
    loading: tripId !== null && !current,
    error: tripId !== null && errorKey === tripId,
  };
}
