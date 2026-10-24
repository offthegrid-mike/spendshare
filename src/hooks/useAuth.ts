import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { usersCol } from '../lib/converters';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        if (u) {
          const userRef = doc(usersCol, u.uid);
          const base = {
            uid: u.uid,
            email: (u.email ?? '').toLowerCase(),
            displayName: u.displayName ?? u.email ?? '',
            ...(u.photoURL ? { photoURL: u.photoURL } : {}),
          };
          // fire-and-forget: create with createdAt+memberOf on first sign-in, update mutable fields on repeat
          void getDoc(userRef)
            .then((snap) =>
              snap.exists()
                ? setDoc(userRef, base, { merge: true })
                : setDoc(userRef, { ...base, memberOf: [], createdAt: serverTimestamp() }),
            )
            // The rules refuse anyone off the allowlist or unverified; the app
            // shows them NotAllowed, so a failed profile write is expected.
            .catch(() => {});
        }
        setUser(u);
        setLoading(false);
      }),
    [],
  );
  return { user, loading };
}
