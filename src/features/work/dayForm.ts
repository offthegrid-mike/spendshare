import type { WorkDayDoc, WorkDayType } from '../../types/models';
import type { WorkAction } from '../../lib/work/workDay';
import { finishFromStart, minutesBetween, parseHm } from '../../lib/work/workTime';

// The state machine behind the day form. It is pure, so the editor only wires
// inputs to events. The start, finish and hours are tied together: typing a start
// moves the finish (or the hours, once the finish has been typed), typing a finish
// sets the hours, and typing hours moves the finish. Whenever `formError` is null
// the three agree, which is what `planWorkDayWrite` insists on for a confirm.

export interface DayFormState {
  type: WorkDayType;
  startTime: string;
  finishTime: string;
  minutes: number;
  /** The finish was typed, so a new start changes the hours and keeps the finish. */
  finishEdited: boolean;
}

export type FormEvent =
  | { kind: 'type'; type: WorkDayType }
  | { kind: 'start'; value: string }
  | { kind: 'finish'; value: string }
  | { kind: 'minutes'; value: number };

const MINUTES_IN_DAY = 1440;

/** The form for a day: its saved Home times if it has any, otherwise a blank day of `defaultMinutes`. */
export function initialForm(defaultMinutes: number, existing: WorkDayDoc | null): DayFormState {
  const home = existing?.type === 'home' ? existing : null;
  return {
    type: existing?.type ?? 'home',
    startTime: home?.startTime ?? '',
    finishTime: home?.finishTime ?? '',
    minutes: home?.minutes ?? defaultMinutes,
    finishEdited: false,
  };
}

export function reduceForm(state: DayFormState, event: FormEvent): DayFormState {
  switch (event.kind) {
    case 'type':
      return { ...state, type: event.type };
    case 'start': {
      const next = { ...state, startTime: event.value };
      if (parseHm(event.value) === null) return next;
      if (!state.finishEdited) {
        return { ...next, finishTime: finishFromStart(event.value, state.minutes) ?? '' };
      }
      // A typed finish stays; the hours follow unless it is no longer after the start.
      const minutes = minutesBetween(event.value, state.finishTime);
      return minutes === null ? next : { ...next, minutes };
    }
    case 'finish': {
      const next = { ...state, finishTime: event.value, finishEdited: true };
      const minutes = minutesBetween(state.startTime, event.value);
      return minutes === null ? next : { ...next, minutes };
    }
    case 'minutes': {
      const next = { ...state, minutes: event.value, finishEdited: false };
      if (parseHm(state.startTime) === null) return next;
      return { ...next, finishTime: finishFromStart(state.startTime, event.value) ?? '' };
    }
  }
}

/** Why the form cannot be saved, or null if it can. Only Home has times to get wrong. */
export function formError(state: DayFormState): string | null {
  if (state.type !== 'home') return null;
  const start = parseHm(state.startTime);
  if (start === null) return 'Enter a start time';
  if (!Number.isInteger(state.minutes) || state.minutes <= 0) return 'Enter hours greater than 0';
  if (state.minutes > MINUTES_IN_DAY) return "Hours can't be more than 24";
  const finish = parseHm(state.finishTime);
  if (finish === null) return 'Enter a finish time';
  if (finish <= start) return 'Finish must be after start';
  return null;
}

/** The save for a valid form. Office and Leave carry no times, so the keys are left out. */
export function formToAction(state: DayFormState): Extract<WorkAction, { kind: 'save' }> {
  if (state.type !== 'home') return { kind: 'save', type: state.type };
  return {
    kind: 'save',
    type: 'home',
    startTime: state.startTime,
    finishTime: state.finishTime,
    minutes: state.minutes,
  };
}

/** Confirming a saved Home day with the finish and hours the form now shows. */
export function confirmAction(state: DayFormState): Extract<WorkAction, { kind: 'confirm' }> {
  return { kind: 'confirm', finishTime: state.finishTime, minutes: state.minutes };
}
