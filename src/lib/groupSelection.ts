/**
 * Which group the app should select, if it should change. A pending group (one
 * just joined) is selected once it shows up in `groups`; until then a valid
 * selection is left alone instead of bouncing, and an invalid one falls back
 * to the first group.
 */
export function resolveSelection(
  groups: { id: string }[],
  selectedId: string | null,
  pendingId: string | null,
): { select: string | null; clearPending: boolean } {
  if (pendingId && groups.some((g) => g.id === pendingId)) {
    return { select: pendingId, clearPending: true };
  }
  if (groups.length > 0 && !groups.some((g) => g.id === selectedId)) {
    return { select: groups[0].id, clearPending: false };
  }
  return { select: null, clearPending: false };
}
