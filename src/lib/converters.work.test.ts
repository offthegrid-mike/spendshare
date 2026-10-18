import { describe, it, expect, vi } from 'vitest';

vi.mock('./firebase', () => ({ db: 'DB' }));
vi.mock('firebase/firestore', () => ({
  collection: (db: unknown, path: string) => ({ db, path }),
  doc: (db: unknown, path: string) => ({ db, path }),
}));

import { workDaysCol, workDayRef, workSettingsRef } from './converters';

describe('Work path helpers', () => {
  it('workDaysCol points at users/{uid}/workDays', () => {
    expect(workDaysCol('u1')).toEqual({ db: 'DB', path: 'users/u1/workDays' });
  });

  it('workDayRef points at users/{uid}/workDays/{date}', () => {
    expect(workDayRef('u1', '2026-10-19')).toEqual({
      db: 'DB',
      path: 'users/u1/workDays/2026-10-19',
    });
  });

  it('workSettingsRef points at users/{uid}/workSettings/main', () => {
    expect(workSettingsRef('u1')).toEqual({
      db: 'DB',
      path: 'users/u1/workSettings/main',
    });
  });
});
