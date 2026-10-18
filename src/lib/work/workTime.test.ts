import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MINUTES,
  parseHm,
  formatHm,
  finishFromStart,
  minutesBetween,
  formatHours,
} from './workTime';

describe('DEFAULT_MINUTES', () => {
  it('is a 7.6 hour day', () => {
    expect(DEFAULT_MINUTES).toBe(456);
  });
});

describe('parseHm', () => {
  it('reads HH:mm as minutes since midnight', () => {
    expect(parseHm('08:30')).toBe(510);
    expect(parseHm('00:00')).toBe(0);
    expect(parseHm('23:59')).toBe(1439);
  });
  it('rejects an hour past 23', () => {
    expect(parseHm('24:00')).toBeNull();
  });
  it('rejects a one digit hour', () => {
    expect(parseHm('8:30')).toBeNull();
  });
  it('rejects minutes past 59', () => {
    expect(parseHm('08:60')).toBeNull();
  });
  it('rejects an empty string', () => {
    expect(parseHm('')).toBeNull();
  });
  it('rejects text that is not a time', () => {
    expect(parseHm('bad')).toBeNull();
  });
  it('rejects a time with extra characters around it', () => {
    expect(parseHm(' 08:30')).toBeNull();
    expect(parseHm('08:30:00')).toBeNull();
  });
});

describe('formatHm', () => {
  it('zero-pads hours and minutes', () => {
    expect(formatHm(510)).toBe('08:30');
    expect(formatHm(0)).toBe('00:00');
  });
  it('formats the last minute of the day', () => {
    expect(formatHm(1439)).toBe('23:59');
  });
  it('round-trips with parseHm', () => {
    expect(parseHm(formatHm(965))).toBe(965);
  });
});

describe('finishFromStart', () => {
  it('adds the length to the start', () => {
    expect(finishFromStart('08:30', 456)).toBe('16:06');
  });
  it('allows a finish of exactly 23:59', () => {
    expect(finishFromStart('15:59', 480)).toBe('23:59');
  });
  it('is null when the finish would be past 23:59', () => {
    expect(finishFromStart('16:00', 480)).toBeNull();
    expect(finishFromStart('20:00', 456)).toBeNull();
  });
  it('is null when the start is invalid', () => {
    expect(finishFromStart('bad', 456)).toBeNull();
  });
  it('is null unless the length is a positive whole number of minutes', () => {
    expect(finishFromStart('08:30', 0)).toBeNull();
    expect(finishFromStart('08:30', -30)).toBeNull();
    expect(finishFromStart('08:30', 7.5)).toBeNull();
    expect(finishFromStart('08:30', NaN)).toBeNull();
  });
});

describe('minutesBetween', () => {
  it('is the length from start to finish', () => {
    expect(minutesBetween('08:30', '16:06')).toBe(456);
  });
  it('is null when the finish is before the start', () => {
    expect(minutesBetween('16:06', '08:30')).toBeNull();
  });
  it('is null when the finish equals the start', () => {
    expect(minutesBetween('08:30', '08:30')).toBeNull();
  });
  it('is null when either time is invalid', () => {
    expect(minutesBetween('bad', '09:00')).toBeNull();
    expect(minutesBetween('09:00', 'bad')).toBeNull();
  });
});

describe('formatHours', () => {
  it('shows one decimal for an exact tenth of an hour', () => {
    expect(formatHours(456)).toBe('7.6');
    expect(formatHours(450)).toBe('7.5');
    expect(formatHours(60)).toBe('1.0');
    expect(formatHours(0)).toBe('0.0');
  });
  it('shows two decimals otherwise', () => {
    expect(formatHours(457)).toBe('7.62');
  });
});
