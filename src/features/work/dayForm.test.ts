import { describe, it, expect } from 'vitest';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc } from '../../types/models';
import { parseHm, minutesBetween } from '../../lib/work/workTime';
import { planWorkDayWrite } from '../../lib/work/workDay';
import {
  initialForm,
  reduceForm,
  formError,
  formToAction,
  confirmAction,
  type DayFormState,
  type FormEvent,
} from './dayForm';

const DAY = '2026-10-19';

function day(overrides: Partial<WorkDayDoc> = {}): WorkDayDoc {
  return {
    date: DAY,
    incomeYear: '2026-27',
    type: 'home',
    startTime: '08:30',
    finishTime: '16:06',
    minutes: 456,
    addedLater: false,
    countedInClaim: true,
    finishConfirmed: false,
    firstRecordedAt: {} as Timestamp,
    recordedAt: {} as Timestamp,
    syncedAt: {} as Timestamp,
    revisions: [],
    ...overrides,
  };
}

function form(overrides: Partial<DayFormState> = {}): DayFormState {
  return { type: 'home', startTime: '', finishTime: '', minutes: 456, finishEdited: false, ...overrides };
}

function run(state: DayFormState, ...events: FormEvent[]): DayFormState {
  return events.reduce(reduceForm, state);
}

describe('initialForm', () => {
  it('starts a new day as Home with the default hours and no times', () => {
    expect(initialForm(456, null)).toEqual({
      type: 'home',
      startTime: '',
      finishTime: '',
      minutes: 456,
      finishEdited: false,
    });
  });

  it('carries the times of an existing Home day', () => {
    expect(initialForm(450, day())).toEqual({
      type: 'home',
      startTime: '08:30',
      finishTime: '16:06',
      minutes: 456,
      finishEdited: false,
    });
  });

  it('opens an existing Office day with empty times and the default hours', () => {
    const office = day({ type: 'office', startTime: undefined, finishTime: undefined, minutes: undefined });
    expect(initialForm(456, office)).toEqual({
      type: 'office',
      startTime: '',
      finishTime: '',
      minutes: 456,
      finishEdited: false,
    });
  });

  it('opens an existing Leave day with empty times and the default hours', () => {
    const leave = day({ type: 'leave', startTime: undefined, finishTime: undefined, minutes: undefined });
    expect(initialForm(450, leave)).toEqual({
      type: 'leave',
      startTime: '',
      finishTime: '',
      minutes: 450,
      finishEdited: false,
    });
  });

  it('opens a cleared day as Home with empty times and the default hours', () => {
    const cleared = day({ type: null, startTime: undefined, finishTime: undefined, minutes: undefined });
    expect(initialForm(456, cleared)).toEqual({
      type: 'home',
      startTime: '',
      finishTime: '',
      minutes: 456,
      finishEdited: false,
    });
  });
});

describe('reduceForm', () => {
  describe('start', () => {
    it('fills the finish from the start and the hours', () => {
      const next = run(initialForm(456, null), { kind: 'start', value: '08:30' });
      expect(next.startTime).toBe('08:30');
      expect(next.finishTime).toBe('16:06');
      expect(next.minutes).toBe(456);
      expect(next.finishEdited).toBe(false);
    });

    it('leaves the finish empty when the day would run past midnight', () => {
      const next = run(initialForm(456, null), { kind: 'start', value: '20:00' });
      expect(next.startTime).toBe('20:00');
      expect(next.finishTime).toBe('');
      expect(next.minutes).toBe(456);
    });

    it('moves a finish that was not edited along with the start', () => {
      const next = run(initialForm(456, null), { kind: 'start', value: '08:30' }, { kind: 'start', value: '09:00' });
      expect(next.finishTime).toBe('16:36');
      expect(next.minutes).toBe(456);
    });

    it('keeps an edited finish and changes the hours', () => {
      const next = run(
        initialForm(456, null),
        { kind: 'start', value: '08:30' },
        { kind: 'finish', value: '17:00' },
        { kind: 'start', value: '09:00' },
      );
      expect(next.startTime).toBe('09:00');
      expect(next.finishTime).toBe('17:00');
      expect(next.minutes).toBe(480);
      expect(next.finishEdited).toBe(true);
    });

    it('changes only the start when it is malformed', () => {
      const before = run(initialForm(456, null), { kind: 'start', value: '08:30' });
      expect(run(before, { kind: 'start', value: '8' })).toEqual({ ...before, startTime: '8' });
    });

    it('changes only the start when it is cleared after the finish was edited', () => {
      const before = run(
        initialForm(456, null),
        { kind: 'start', value: '08:30' },
        { kind: 'finish', value: '17:00' },
      );
      expect(run(before, { kind: 'start', value: '' })).toEqual({ ...before, startTime: '' });
    });

    it('keeps the hours when an edited finish is no longer after the start', () => {
      const before = run(
        initialForm(456, null),
        { kind: 'start', value: '08:30' },
        { kind: 'finish', value: '17:00' },
      );
      const next = run(before, { kind: 'start', value: '18:00' });
      expect(next.startTime).toBe('18:00');
      expect(next.finishTime).toBe('17:00');
      expect(next.minutes).toBe(510);
      expect(formError(next)).toBe('Finish must be after start');
    });
  });

  describe('finish', () => {
    it('sets the finish, marks it edited and works out the hours', () => {
      const next = run(
        initialForm(456, null),
        { kind: 'start', value: '08:30' },
        { kind: 'finish', value: '17:00' },
      );
      expect(next.finishTime).toBe('17:00');
      expect(next.minutes).toBe(510);
      expect(next.finishEdited).toBe(true);
    });

    it('marks the finish edited before there is a start and keeps the hours', () => {
      const next = run(initialForm(456, null), { kind: 'finish', value: '17:00' });
      expect(next.finishTime).toBe('17:00');
      expect(next.minutes).toBe(456);
      expect(next.finishEdited).toBe(true);
    });

    it('works out the hours once the start arrives after an edited finish', () => {
      const next = run(initialForm(456, null), { kind: 'finish', value: '17:00' }, { kind: 'start', value: '08:30' });
      expect(next.finishTime).toBe('17:00');
      expect(next.minutes).toBe(510);
    });

    it('keeps the hours when the finish is malformed or empty', () => {
      const before = run(initialForm(456, null), { kind: 'start', value: '08:30' });
      expect(run(before, { kind: 'finish', value: '1' })).toEqual({
        ...before,
        finishTime: '1',
        finishEdited: true,
      });
      expect(run(before, { kind: 'finish', value: '' })).toEqual({
        ...before,
        finishTime: '',
        finishEdited: true,
      });
    });

    it('keeps the hours when the finish is not after the start', () => {
      const before = run(initialForm(456, null), { kind: 'start', value: '08:30' });
      expect(run(before, { kind: 'finish', value: '08:00' })).toEqual({
        ...before,
        finishTime: '08:00',
        finishEdited: true,
      });
      expect(run(before, { kind: 'finish', value: '08:30' }).minutes).toBe(456);
    });
  });

  describe('minutes', () => {
    it('moves the finish and clears the edited flag', () => {
      const next = run(
        initialForm(456, null),
        { kind: 'start', value: '08:30' },
        { kind: 'finish', value: '17:00' },
        { kind: 'minutes', value: 450 },
      );
      expect(next.minutes).toBe(450);
      expect(next.finishTime).toBe('16:00');
      expect(next.finishEdited).toBe(false);
    });

    it('empties the finish when the day would run past midnight', () => {
      const next = run(form({ startTime: '20:00' }), { kind: 'minutes', value: 456 });
      expect(next.finishTime).toBe('');
    });

    it('leaves the finish alone until there is a start', () => {
      const next = run(form({ finishTime: '17:00', finishEdited: true }), { kind: 'minutes', value: 450 });
      expect(next).toEqual(form({ finishTime: '17:00', minutes: 450, finishEdited: false }));
    });
  });

  describe('type', () => {
    it('changes only the type', () => {
      const before = run(initialForm(456, null), { kind: 'start', value: '08:30' }, { kind: 'finish', value: '17:00' });
      expect(run(before, { kind: 'type', type: 'leave' })).toEqual({ ...before, type: 'leave' });
    });

    it('keeps the times when switching back to Home', () => {
      const before = run(initialForm(456, null), { kind: 'start', value: '08:30' });
      const back = run(before, { kind: 'type', type: 'office' }, { kind: 'type', type: 'home' });
      expect(back).toEqual(before);
    });
  });
});

describe('formError', () => {
  it('asks for a start time when it is empty', () => {
    expect(formError(form())).toBe('Enter a start time');
  });

  it('asks for a start time when it is not a valid time', () => {
    expect(formError(form({ startTime: '8' }))).toBe('Enter a start time');
  });

  it('asks for a finish time when it is empty', () => {
    expect(formError(form({ startTime: '08:30' }))).toBe('Enter a finish time');
  });

  it('asks for a finish time when the day would run past midnight', () => {
    expect(formError(run(form(), { kind: 'start', value: '20:00' }))).toBe('Enter a finish time');
  });

  it('asks for a finish time when it is not a valid time', () => {
    expect(formError(form({ startTime: '08:30', finishTime: '1' }))).toBe('Enter a finish time');
  });

  it('asks for the finish to be after the start', () => {
    expect(formError(form({ startTime: '08:30', finishTime: '08:00', finishEdited: true }))).toBe(
      'Finish must be after start',
    );
  });

  it('asks for the finish to be after the start when they are equal', () => {
    expect(formError(form({ startTime: '08:30', finishTime: '08:30', finishEdited: true }))).toBe(
      'Finish must be after start',
    );
  });

  it('asks for hours greater than 0', () => {
    expect(formError(form({ startTime: '08:30', finishTime: '16:06', minutes: 0 }))).toBe(
      'Enter hours greater than 0',
    );
  });

  it('asks for hours greater than 0 when the hours are not a whole number of minutes', () => {
    expect(formError(form({ startTime: '08:30', finishTime: '16:06', minutes: 455.5 }))).toBe(
      'Enter hours greater than 0',
    );
  });

  it('checks the hours before the finish', () => {
    expect(formError(form({ startTime: '08:30', minutes: 0 }))).toBe('Enter hours greater than 0');
  });

  it("says hours can't be more than 24", () => {
    const next = run(form({ startTime: '08:30' }), { kind: 'minutes', value: 1500 });
    expect(next.finishTime).toBe('');
    expect(formError(next)).toBe("Hours can't be more than 24");
  });

  it('accepts a valid Home form', () => {
    expect(formError(run(form(), { kind: 'start', value: '08:30' }))).toBeNull();
  });

  it('accepts a Home form with an edited finish', () => {
    const next = run(form(), { kind: 'start', value: '08:30' }, { kind: 'finish', value: '17:00' });
    expect(formError(next)).toBeNull();
  });

  it('accepts an Office or Leave form whatever the times say', () => {
    expect(formError(form({ type: 'office' }))).toBeNull();
    expect(formError(form({ type: 'leave', startTime: '8', finishTime: '07:00', minutes: 0 }))).toBeNull();
  });
});

describe('formToAction', () => {
  it('saves the times of a Home day', () => {
    const state = run(form(), { kind: 'start', value: '08:30' });
    expect(formToAction(state)).toEqual({
      kind: 'save',
      type: 'home',
      startTime: '08:30',
      finishTime: '16:06',
      minutes: 456,
    });
  });

  it('saves a Leave day with no time keys at all', () => {
    const state = form({ type: 'leave', startTime: '08:30', finishTime: '16:06' });
    expect(formToAction(state)).toStrictEqual({ kind: 'save', type: 'leave' });
  });

  it('saves an Office day with no time keys at all', () => {
    const state = form({ type: 'office', startTime: '08:30', finishTime: '16:06' });
    expect(formToAction(state)).toStrictEqual({ kind: 'save', type: 'office' });
  });
});

describe('confirmAction', () => {
  it('confirms the finish and hours', () => {
    const state = form({ startTime: '08:30', finishTime: '17:00', minutes: 510, finishEdited: true });
    expect(confirmAction(state)).toStrictEqual({ kind: 'confirm', finishTime: '17:00', minutes: 510 });
  });
});

// planWorkDayWrite throws on times that disagree, so every state the form calls
// valid must carry a finish and hours that agree with the start.
describe('a valid form always agrees with itself', () => {
  const events: FormEvent[] = [
    { kind: 'start', value: '' },
    { kind: 'start', value: '08:30' },
    { kind: 'start', value: '09:15' },
    { kind: 'start', value: '18:00' },
    { kind: 'start', value: '8' },
    { kind: 'finish', value: '' },
    { kind: 'finish', value: '08:00' },
    { kind: 'finish', value: '16:06' },
    { kind: 'finish', value: '17:00' },
    { kind: 'minutes', value: 0 },
    { kind: 'minutes', value: 300 },
    { kind: 'minutes', value: 456 },
    { kind: 'minutes', value: 1500 },
  ];

  // Every sequence of up to four events from the list above.
  function* sequences(depth: number): Generator<FormEvent[]> {
    yield [];
    if (depth === 0) return;
    for (const event of events) {
      for (const rest of sequences(depth - 1)) yield [event, ...rest];
    }
  }

  it('has hours that match the start and finish and that the writer accepts', () => {
    let valid = 0;
    for (const sequence of sequences(3)) {
      const state = run(initialForm(456, null), ...sequence);
      if (formError(state) !== null) continue;
      valid += 1;
      const start = parseHm(state.startTime);
      expect(start).not.toBeNull();
      expect(minutesBetween(state.startTime, state.finishTime)).toBe(state.minutes);
      const saved = planWorkDayWrite(DAY, formToAction(state), null, DAY);
      expect(saved?.fields.minutes).toBe(state.minutes);
      const confirmed = planWorkDayWrite(DAY, confirmAction(state), day({ startTime: state.startTime }), DAY);
      expect(confirmed?.fields.minutes).toBe(state.minutes);
    }
    expect(valid).toBeGreaterThan(0);
  });
});
