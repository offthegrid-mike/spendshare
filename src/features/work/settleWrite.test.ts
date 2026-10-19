import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUIStore } from '../../stores/uiStore';
import { settleWrite } from './settleWrite';

const SYNC_FAILED = "Couldn't sync a Work change. Check your connection and try again.";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

beforeEach(() => {
  useUIStore.setState({ notice: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('settleWrite', () => {
  describe('online', () => {
    it('hands back the write itself, so the caller waits for it', async () => {
      setOnline(true);
      const write = Promise.resolve();
      const settled = settleWrite(write);

      expect(settled).toBe(write);
      await expect(settled).resolves.toBeUndefined();
    });

    it('passes a rejection through to the caller and raises no notice', async () => {
      setOnline(true);
      const write = Promise.reject(new Error('denied'));

      await expect(settleWrite(write)).rejects.toThrow('denied');
      expect(useUIStore.getState().notice).toBeNull();
    });
  });

  describe('offline', () => {
    it('resolves at once for a write the server will not acknowledge yet', async () => {
      setOnline(false);
      const never = new Promise<void>(() => {});

      await expect(settleWrite(never)).resolves.toBeUndefined();
    });

    it('raises a notice when the write is rejected later', async () => {
      setOnline(false);
      const write = deferred();
      await settleWrite(write.promise);
      expect(useUIStore.getState().notice).toBeNull();

      write.reject(new Error('permission-denied'));
      await vi.waitFor(() => expect(useUIStore.getState().notice?.message).toBe(SYNC_FAILED));
    });

    it('raises no notice when the write goes through later', async () => {
      setOnline(false);
      const write = deferred();
      await settleWrite(write.promise);

      write.resolve();
      await write.promise;
      await Promise.resolve();
      expect(useUIStore.getState().notice).toBeNull();
    });
  });
});
