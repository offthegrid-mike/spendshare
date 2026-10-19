import { useUIStore } from '../../stores/uiStore';

// Firestore's write promise resolves only when the server acknowledges the write,
// never while offline, even though the write is queued in the local cache at once
// and every listener already shows it. Spec 8.2a: the UI must not wait on it. So
// a Work write is awaited only while the device is online, where a rejection can
// still be shown next to the form that made it. Offline the caller carries on
// straight away, and a write the server rejects later raises a notice instead.

const SYNC_FAILED = "Couldn't sync a Work change. Check your connection and try again.";

/** The promise to await for a Work write: the write itself online, an already-resolved one offline. */
export function settleWrite(write: Promise<void>): Promise<void> {
  if (navigator.onLine !== false) return write;
  write.catch(() => {
    useUIStore.getState().showNotice({ message: SYNC_FAILED });
  });
  return Promise.resolve();
}
