import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { handoversCol, topUpsCol, walletsCol } from '../lib/converters';
import type { HandoverDoc, TopUpDoc, WalletDoc } from '../types/models';

/** A trip's cash wallets, the cash put into them, and cash handed between members. Loading is derived from stored keys, as in useTripExpenses. */
export function useTripWallets(tripId: string | null): {
  wallets: WalletDoc[];
  topUps: TopUpDoc[];
  handovers: HandoverDoc[];
  loading: boolean;
  error: boolean;
  /** Listens again after an error (Firestore stops a listener once it fails). */
  retry: () => void;
} {
  const [wallets, setWallets] = useState<WalletDoc[]>([]);
  const [topUps, setTopUps] = useState<TopUpDoc[]>([]);
  const [walletsKey, setWalletsKey] = useState<string | null>(null);
  const [topUpsKey, setTopUpsKey] = useState<string | null>(null);
  const [handovers, setHandovers] = useState<HandoverDoc[]>([]);
  const [handoversKey, setHandoversKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = tripId ? `${tripId}#${attempt}` : null;

  useEffect(() => {
    if (!tripId) return;
    const k = `${tripId}#${attempt}`;
    const unsubWallets = onSnapshot(
      walletsCol(tripId),
      (snap) => {
        setWallets(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setWalletsKey(k);
      },
      () => { setErrorKey(k); setWalletsKey(k); },
    );
    const unsubTopUps = onSnapshot(
      topUpsCol(tripId),
      (snap) => {
        setTopUps(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setTopUpsKey(k);
      },
      () => { setErrorKey(k); setTopUpsKey(k); },
    );
    const unsubHandovers = onSnapshot(
      handoversCol(tripId),
      (snap) => {
        setHandovers(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        setHandoversKey(k);
      },
      () => { setErrorKey(k); setHandoversKey(k); },
    );
    return () => {
      unsubWallets();
      unsubTopUps();
      unsubHandovers();
    };
  }, [tripId, attempt]);

  const current = key !== null && walletsKey === key && topUpsKey === key && handoversKey === key;
  return {
    wallets: current ? wallets : [],
    topUps: current ? topUps : [],
    handovers: current ? handovers : [],
    loading: key !== null && !current,
    error: key !== null && errorKey === key,
    retry: () => setAttempt((a) => a + 1),
  };
}
