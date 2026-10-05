import type { GroupDoc } from '../types/models';

/** A group's members for an avatar stack, the viewer first. */
export function membersOf(group: GroupDoc, currentUid: string) {
  return Object.entries(group.members)
    .map(([uid, m]) => ({ name: m.displayName || m.email || '?', isMe: uid === currentUid }))
    .sort((a, b) => Number(b.isMe) - Number(a.isMe));
}
