import type { WorkDayDoc } from '../../types/models';
import type { Clock } from './workDates';
import { parseHm } from './workTime';

// Pure totals for one income year of Work days (spec 7.2a and 7.5): how many hours
// count toward the fixed rate working-from-home claim, which late days are still
// waiting to be included, which counted days have an unconfirmed finish, and the
// claim itself. Only Home days carry hours. Days are local 'YYYY-MM-DD' strings,
// which compare in date order as plain strings, and the clock is passed in.

export interface Tally {
  days: number;
  minutes: number;
}

export interface WorkYearSummary {
  /** Home days in the claim. */
  counted: Tally;
  /** Home days added after the day and not (yet) included in the claim. */
  addedLater: Tally;
  /** Counted Home days whose finish has passed without being confirmed. They still count. */
  notConfirmed: Tally;
  officeDays: number;
  leaveDays: number;
  claimCents: number;
  /** Whole dollars: the ATO drops the cents rather than rounding them. */
  claimDollars: number;
}

export interface MonthTotal {
  /** 'YYYY-MM'. */
  month: string;
  homeDays: number;
  /** Minutes of the Home days in the claim. */
  countedMinutes: number;
  officeDays: number;
  leaveDays: number;
}

/** The claim in cents for `minutes` at `rateCentsPerHour`, dropping any fraction of a cent. */
export function claimCentsFor(minutes: number, rateCentsPerHour: number): number {
  return Math.floor((minutes * rateCentsPerHour) / 60);
}

/**
 * Whether the day's recorded finish time has been reached: any earlier day, or
 * today once the clock is at or past the finish. False for a day with no finish
 * time (or one that does not parse) and for a later day.
 */
export function isFinishPassed(day: WorkDayDoc, clock: Clock): boolean {
  if (day.finishTime === undefined) return false;
  const finish = parseHm(day.finishTime);
  if (finish === null) return false;
  if (day.date < clock.today) return true;
  return day.date === clock.today && finish <= clock.nowMinutes;
}

/** A Home day whose finish has passed and was never confirmed. */
export function isUnconfirmed(day: WorkDayDoc, clock: Clock): boolean {
  return day.type === 'home' && !day.finishConfirmed && isFinishPassed(day, clock);
}

function tally(days: WorkDayDoc[]): Tally {
  return { days: days.length, minutes: days.reduce((sum, day) => sum + (day.minutes ?? 0), 0) };
}

/**
 * The totals for the days of one income year at one hourly rate. The claim is
 * worked out from the counted minutes only.
 */
export function summariseYear(days: WorkDayDoc[], rateCentsPerHour: number, clock: Clock): WorkYearSummary {
  const home = days.filter((day) => day.type === 'home');
  const counted = home.filter((day) => day.countedInClaim);
  const addedLater = home.filter((day) => day.addedLater && !day.countedInClaim);
  const notConfirmed = counted.filter((day) => isUnconfirmed(day, clock));
  const claimCents = claimCentsFor(tally(counted).minutes, rateCentsPerHour);
  return {
    counted: tally(counted),
    addedLater: tally(addedLater),
    notConfirmed: tally(notConfirmed),
    officeDays: days.filter((day) => day.type === 'office').length,
    leaveDays: days.filter((day) => day.type === 'leave').length,
    claimCents,
    claimDollars: Math.floor(claimCents / 100),
  };
}

/**
 * Totals per calendar month, ascending, for the months that have at least one
 * recorded day (a cleared day records nothing).
 */
export function monthlyTotals(days: WorkDayDoc[]): MonthTotal[] {
  const byMonth = new Map<string, WorkDayDoc[]>();
  for (const day of days) {
    if (day.type === null) continue;
    const month = day.date.slice(0, 7);
    const inMonth = byMonth.get(month);
    if (inMonth) inMonth.push(day);
    else byMonth.set(month, [day]);
  }
  return [...byMonth.keys()].sort().map((month) => {
    const inMonth = byMonth.get(month) ?? [];
    const home = inMonth.filter((day) => day.type === 'home');
    return {
      month,
      homeDays: home.length,
      countedMinutes: tally(home.filter((day) => day.countedInClaim)).minutes,
      officeDays: inMonth.filter((day) => day.type === 'office').length,
      leaveDays: inMonth.filter((day) => day.type === 'leave').length,
    };
  });
}
