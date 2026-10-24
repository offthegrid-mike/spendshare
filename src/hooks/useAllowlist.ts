import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../lib/firebase';

export type AllowlistStatus = 'signed-out' | 'loading' | 'allowed' | 'denied' | 'unverified';

/**
 * Whether the signed-in user may use the app. The Firestore rules are the real
 * gate (a verified email with a document at allowlist/{email}); this mirrors
 * them so the app can explain a refusal instead of failing every read.
 */
export function useAllowlist(user: User | null): AllowlistStatus {
  const [result, setResult] = useState<{ key: string; allowed: boolean } | null>(null);

  const email = user?.email?.toLowerCase() ?? null;
  const key = user && email && user.emailVerified ? email : null;

  useEffect(() => {
    if (!key) {
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'allowlist', key),
      (snap) => setResult({ key, allowed: snap.exists() }),
      () => setResult({ key, allowed: false }),
    );

    return () => {
      unsub();
      setResult(null);
    };
  }, [key]);

  if (!user) return 'signed-out';
  if (!email) return 'denied';
  if (!user.emailVerified) return 'unverified';
  if (result?.key !== key) return 'loading';
  return result.allowed ? 'allowed' : 'denied';
}
