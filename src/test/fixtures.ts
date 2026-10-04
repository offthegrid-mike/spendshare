import type { GroupDoc, GroupMember } from '../types/models';

function member(displayName: string, role: GroupMember['role'] = 'member'): GroupMember {
  return { role, displayName, email: `${displayName.toLowerCase()}@example.com`, joinedAt: null as unknown as GroupMember['joinedAt'] };
}

/** A group whose members are keyed by lowercase name as uid ('mike', 'priya'). */
export function makeGroup(id: string, name: string, memberNames: string[] = ['Mike', 'Priya']): GroupDoc {
  const members = Object.fromEntries(memberNames.map((n, i) => [n.toLowerCase(), member(n, i === 0 ? 'owner' : 'member')]));
  return {
    id, name, currency: 'AUD', ownerUid: memberNames[0].toLowerCase(),
    members, memberUids: Object.keys(members),
    createdAt: null as unknown as GroupDoc['createdAt'],
  };
}
