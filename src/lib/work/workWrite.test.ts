import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc, WorkSettingsDoc } from '../../types/models';
import { DEFAULT_WORK_SETTINGS } from './workSettings';

const { setDoc, batch, writeBatch } = vi.hoisted(() => {
  const batch = { set: vi.fn(), commit: vi.fn() };
  return { setDoc: vi.fn(), batch, writeBatch: vi.fn() };
});
vi.mock('firebase/firestore', () => ({
  setDoc,
  writeBatch,
  serverTimestamp: () => 'SERVER_TS',
  arrayUnion: (...v: unknown[]) => ({ union: v }),
  deleteField: () => 'DELETE',
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
}));
vi.mock('../firebase', () => ({ db: 'DB' }));
vi.mock('../converters', () => ({
  workDayRef: (uid: string, date: string) => `DAY_REF:${uid}:${date}`,
  workSettingsRef: (uid: string) => `SETTINGS_REF:${uid}`,
}));

import { writeWorkDay, saveWorkSettings } from './workWrite';

// Monday 19 October 2026, 9:00 local time: the day being recorded is "today".
const NOW = new Date(2026, 9, 19, 9, 0).getTime();
const TODAY = '2026-10-19';
const LATE = '2026-10-17'; // a past day, so a change to it is "added later"

const ts = (ms: number) => ({ ms }) as unknown as Timestamp;

const NEW_SETTINGS: WorkSettingsDoc = { ...DEFAULT_WORK_SETTINGS, trackingStartDate: null };
const STARTED_SETTINGS: WorkSettingsDoc = { ...DEFAULT_WORK_SETTINGS, trackingStartDate: '2026-10-01' };

function homeDay(date: string, over: Partial<WorkDayDoc> = {}): WorkDayDoc {
  return {
    date,
    incomeYear: '2026-27',
    type: 'home',
    startTime: '08:30',
    finishTime: '16:30',
    minutes: 480,
    addedLater: false,
    countedInClaim: true,
    finishConfirmed: false,
    firstRecordedAt: ts(1),
    recordedAt: ts(1),
    syncedAt: ts(1),
    revisions: [],
    ...over,
  };
}

/** The data argument of the nth batch.set call. */
const dataOfSet = (n: number) => batch.set.mock.calls[n][1] as Record<string, unknown>;

beforeEach(() => {
  setDoc.mockReset().mockResolvedValue(undefined);
  writeBatch.mockReset().mockReturnValue(batch);
  batch.set.mockReset();
  batch.commit.mockReset().mockResolvedValue(undefined);
});

describe('writeWorkDay', () => {
  it('writes a new Home day as one batch set with the plan, timestamps and a revision', async () => {
    await writeWorkDay(
      'u1',
      TODAY,
      { kind: 'save', type: 'home', startTime: '08:30', finishTime: '16:30', minutes: 480 },
      null,
      STARTED_SETTINGS,
      NOW,
    );

    expect(writeBatch).toHaveBeenCalledTimes(1);
    expect(writeBatch).toHaveBeenCalledWith('DB');
    expect(batch.set).toHaveBeenCalledTimes(1);
    expect(batch.set.mock.calls[0][0]).toBe(`DAY_REF:u1:${TODAY}`);
    expect(batch.set.mock.calls[0][2]).toEqual({ merge: true });
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(setDoc).not.toHaveBeenCalled();
    expect(dataOfSet(0)).toStrictEqual({
      date: TODAY,
      incomeYear: '2026-27',
      type: 'home',
      startTime: '08:30',
      finishTime: '16:30',
      minutes: 480,
      addedLater: false,
      countedInClaim: true,
      finishConfirmed: false,
      finishConfirmedAt: 'DELETE',
      firstRecordedAt: { ms: NOW },
      recordedAt: { ms: NOW },
      syncedAt: 'SERVER_TS',
      revisions: {
        union: [
          {
            kind: 'save',
            type: 'home',
            startTime: '08:30',
            finishTime: '16:30',
            minutes: 480,
            addedLater: false,
            countedInClaim: true,
            finishConfirmed: false,
            at: { ms: NOW },
          },
        ],
      },
    });
  });

  it('creates no batch and writes nothing, not even the settings, when the plan is null', async () => {
    // Clearing a day that was never recorded has nothing to write.
    await writeWorkDay('u1', TODAY, { kind: 'save', type: null }, null, NEW_SETTINGS, NOW);

    expect(writeBatch).not.toHaveBeenCalled();
    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('sets the tracking start date in the same batch when it is not set yet', async () => {
    await writeWorkDay('u1', LATE, { kind: 'save', type: 'office' }, null, NEW_SETTINGS, NOW);

    // One batch, so the day and the start date land together (or not at all), even offline.
    expect(writeBatch).toHaveBeenCalledTimes(1);
    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.set.mock.calls[0][0]).toBe(`DAY_REF:u1:${LATE}`);
    expect(batch.set).toHaveBeenNthCalledWith(2, 'SETTINGS_REF:u1', { trackingStartDate: LATE }, { merge: true });
    expect(batch.commit).toHaveBeenCalledTimes(1);
    const commitOrder = batch.commit.mock.invocationCallOrder[0];
    expect(batch.set.mock.invocationCallOrder.every((order) => order < commitOrder)).toBe(true);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('leaves the tracking start date alone when the settings are not loaded yet', async () => {
    // null means "settings not loaded yet": the defaults a hook returns while loading
    // have a null start date, and writing it would replace the user's real one.
    await writeWorkDay('u1', LATE, { kind: 'save', type: 'office' }, null, null, NOW);

    expect(writeBatch).toHaveBeenCalledTimes(1);
    expect(batch.set).toHaveBeenCalledTimes(1);
    expect(batch.set.mock.calls[0][0]).toBe(`DAY_REF:u1:${LATE}`);
    expect(batch.set.mock.calls.some((call) => call[0] === 'SETTINGS_REF:u1')).toBe(false);
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('does not write the settings when the tracking start date is already set', async () => {
    await writeWorkDay('u1', TODAY, { kind: 'save', type: 'office' }, null, STARTED_SETTINGS, NOW);

    expect(batch.set).toHaveBeenCalledTimes(1);
    expect(batch.set.mock.calls[0][0]).toBe(`DAY_REF:u1:${TODAY}`);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('rejects when the batch commit fails', async () => {
    batch.commit.mockRejectedValueOnce(new Error('denied'));

    await expect(
      writeWorkDay('u1', TODAY, { kind: 'save', type: 'office' }, null, NEW_SETTINGS, NOW),
    ).rejects.toThrow('denied');

    // Nothing is written outside the batch, so a failed commit leaves no settings write behind.
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('deletes the Home times when a Home day changes to Office', async () => {
    await writeWorkDay(
      'u1',
      TODAY,
      { kind: 'save', type: 'office' },
      homeDay(TODAY),
      STARTED_SETTINGS,
      NOW,
    );

    const data = dataOfSet(0);
    expect(data.type).toBe('office');
    expect(data.startTime).toBe('DELETE');
    expect(data.finishTime).toBe('DELETE');
    expect(data.minutes).toBe('DELETE');
    expect(data.countedInClaim).toBe(false);
    // An existing day keeps its first recorded time but this is a change of record.
    expect(data).not.toHaveProperty('firstRecordedAt');
    expect(data.recordedAt).toEqual({ ms: NOW });
  });

  it('deletes only the times a Home save leaves out', async () => {
    await writeWorkDay(
      'u1',
      TODAY,
      { kind: 'save', type: 'home', startTime: '08:30' },
      null,
      STARTED_SETTINGS,
      NOW,
    );

    const data = dataOfSet(0);
    expect(data.startTime).toBe('08:30');
    expect(data.finishTime).toBe('DELETE');
    expect(data.minutes).toBe('DELETE');
  });

  it('removes the confirmation time when a change unconfirms a confirmed day', async () => {
    const confirmed = homeDay(TODAY, { finishConfirmed: true, finishConfirmedAt: ts(2) });

    await writeWorkDay(
      'u1',
      TODAY,
      { kind: 'save', type: 'home', startTime: '08:30', finishTime: '15:00', minutes: 390 },
      confirmed,
      STARTED_SETTINGS,
      NOW,
    );

    const data = dataOfSet(0);
    expect(data.finishConfirmed).toBe(false);
    expect(data.finishConfirmedAt).toBe('DELETE');
    expect(data.recordedAt).toEqual({ ms: NOW });
  });

  it('stamps the confirmation time on a confirm, without touching recordedAt', async () => {
    await writeWorkDay('u1', TODAY, { kind: 'confirm' }, homeDay(TODAY), STARTED_SETTINGS, NOW);

    const data = dataOfSet(0);
    expect(data.finishConfirmed).toBe(true);
    expect(data.finishConfirmedAt).toEqual({ ms: NOW });
    expect(data).not.toHaveProperty('recordedAt');
    expect(data).not.toHaveProperty('firstRecordedAt');
    expect((data.revisions as { union: unknown[] }).union).toEqual([
      expect.objectContaining({ kind: 'confirm', finishConfirmed: true, at: { ms: NOW } }),
    ]);
  });

  it('stamps both recordedAt and the confirmation time when a confirm also changes the finish', async () => {
    await writeWorkDay(
      'u1',
      TODAY,
      { kind: 'confirm', finishTime: '15:00', minutes: 390 },
      homeDay(TODAY),
      STARTED_SETTINGS,
      NOW,
    );

    const data = dataOfSet(0);
    expect(data.finishTime).toBe('15:00');
    expect(data.finishConfirmedAt).toEqual({ ms: NOW });
    expect(data.recordedAt).toEqual({ ms: NOW });
  });

  it.each(['include', 'exclude'] as const)(
    'does not send recordedAt or the confirmation time on an %s of a confirmed day',
    async (kind) => {
      const late = homeDay(LATE, {
        addedLater: true,
        countedInClaim: kind === 'exclude',
        finishConfirmed: true,
        finishConfirmedAt: ts(2),
      });

      await writeWorkDay('u1', LATE, { kind }, late, STARTED_SETTINGS, NOW);

      const data = dataOfSet(0);
      expect(data.countedInClaim).toBe(kind === 'include');
      expect(data.finishConfirmed).toBe(true);
      expect(data).not.toHaveProperty('recordedAt');
      expect(data).not.toHaveProperty('firstRecordedAt');
      expect(data).not.toHaveProperty('finishConfirmedAt');
      expect(data.syncedAt).toBe('SERVER_TS');
      expect((data.revisions as { union: unknown[] }).union).toEqual([
        expect.objectContaining({ kind, at: { ms: NOW } }),
      ]);
    },
  );
});

describe('saveWorkSettings', () => {
  it('merges the patch into the settings document', async () => {
    const patch = { ratesCentsPerHour: { '2026-27': 72 } };

    await saveWorkSettings('u1', patch);

    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith('SETTINGS_REF:u1', patch, { merge: true });
    expect(writeBatch).not.toHaveBeenCalled();
  });
});
