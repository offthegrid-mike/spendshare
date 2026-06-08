import { useEffect, useRef, useState } from 'react';
import {
  collectionGroup,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  doc,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  type DocumentReference,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { invitesCol, usersCol } from '../lib/converters';
import type { InviteDoc, GroupMember } from '../types/models';

export type OutgoingInvite = InviteDoc & { id: string };
export type IncomingInvite = InviteDoc & { id: string; ref: DocumentReference };

export function useOutgoingInvites(gid: string | null) {
  const [invites, setInvites] = useState<OutgoingInvite[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (!gid) {
      // Intentionally do NOT reset invites to [] here: that would be a
      // set-state-in-effect lint error (react-hooks/set-state-in-effect),
      // matching the pattern in useGroup.ts. Do not "fix" this back.
      return;
    }
    unsubRef.current = onSnapshot(invitesCol(gid), (snap) => {
      setInvites(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    });
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [gid]);

  return { invites };
}

export function useIncomingInvites(email: string | undefined) {
  const [invites, setInvites] = useState<IncomingInvite[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (!email) {
      // Intentionally do NOT reset invites to [] here: that would be a
      // set-state-in-effect lint error (react-hooks/set-state-in-effect),
      // matching the pattern in useGroup.ts. Do not "fix" this back.
      return;
    }
    const q = query(
      collectionGroup(db, 'invites'),
      where('email', '==', email),
      where('status', '==', 'pending'),
    );
    unsubRef.current = onSnapshot(q, (snap) => {
      setInvites(
        snap.docs.map((d) => ({
          ...(d.data() as InviteDoc),
          id: d.id,
          ref: d.ref,
        })),
      );
    });
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [email]);

  return { invites };
}

export function sendInvite({
  gid,
  email,
  invitedByUid,
  invitedByName,
  groupName,
}: {
  gid: string;
  email: string;
  invitedByUid: string;
  invitedByName: string;
  groupName: string;
}) {
  return setDoc(doc(invitesCol(gid), email.toLowerCase()), {
    email: email.toLowerCase(),
    invitedByUid,
    invitedByName,
    groupName,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export function revokeInvite(gid: string, email: string) {
  return updateDoc(doc(invitesCol(gid), email.toLowerCase()), {
    status: 'revoked',
  });
}

export async function acceptInvite(invite: IncomingInvite, user: User) {
  const groupRef = invite.ref.parent.parent;
  if (!groupRef) return;
  const batch = writeBatch(db);
  const member: GroupMember = {
    role: 'member',
    displayName: user.displayName ?? user.email ?? '',
    email: (user.email ?? '').toLowerCase(),
    joinedAt: serverTimestamp() as GroupMember['joinedAt'],
  };
  batch.update(groupRef, {
    ['members.' + user.uid]: member,
    memberUids: arrayUnion(user.uid),
  });
  batch.update(invite.ref, { status: 'accepted' });
  batch.update(doc(usersCol, user.uid), { memberOf: arrayUnion(groupRef.id) });
  await batch.commit();
}

export function declineInvite(invite: IncomingInvite) {
  return updateDoc(invite.ref, { status: 'declined' });
}
