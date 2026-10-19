import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc, WorkDayType, WorkSettingsDoc } from '../../types/models';
import type { Clock } from '../../lib/work/workDates';
import { DEFAULT_WORK_SETTINGS } from '../../lib/work/workSettings';
import MonthCalendar from './MonthCalendar';

// Monday 19 October 2026, 09:00, with tracking from Monday 12 October.
const CLOCK: Clock = { today: '2026-10-19', nowMinutes: 540 };
const SETTINGS: WorkSettingsDoc = { ...DEFAULT_WORK_SETTINGS, trackingStartDate: '2026-10-12' };

// A Home day finishing 16:06 that is counted in the claim and not yet confirmed.
function day(date: string, overrides: Partial<WorkDayDoc> = {}): WorkDayDoc {
  return {
    date,
    incomeYear: '2026-27',
    type: 'home',
    startTime: '08:30',
    finishTime: '16:06',
    minutes: 456,
    addedLater: false,
    countedInClaim: true,
    finishConfirmed: true,
    firstRecordedAt: {} as Timestamp,
    recordedAt: {} as Timestamp,
    syncedAt: {} as Timestamp,
    revisions: [],
    ...overrides,
  };
}

// An Office or Leave day: no times and not in the claim, as Firestore stores it.
function dayWithoutTimes(date: string, type: Exclude<WorkDayType, 'home'>): WorkDayDoc {
  const doc = day(date, { type, countedInClaim: false });
  delete doc.startTime;
  delete doc.finishTime;
  delete doc.minutes;
  return doc;
}

const DAYS = [day('2026-10-12'), dayWithoutTimes('2026-10-13', 'office'), dayWithoutTimes('2026-10-14', 'leave')];

function renderCalendar(props: Partial<ComponentProps<typeof MonthCalendar>> = {}) {
  const onSelect = vi.fn();
  const view = render(
    <MonthCalendar
      month="2026-10"
      days={DAYS}
      settings={SETTINGS}
      clock={CLOCK}
      selectedDate={null}
      onSelect={onSelect}
      {...props}
    />,
  );
  return { onSelect, ...view };
}

// The border colour utilities among a button's classes: every `border-*` class that
// is not a border style or width.
function borderColours(button: HTMLElement): string[] {
  return Array.from(button.classList).filter(
    (name) => name.startsWith('border-') && !/^border-(solid|dashed|dotted|double|hidden|none|\d+|\[.*\]|[xytrbl]|[xytrbl]-\d+)$/.test(name),
  );
}

describe('MonthCalendar cell borders', () => {
  // Tailwind orders same-property utilities by name in its CSS, not by the order in
  // a class attribute, so two border colours on one cell leave the winner to the
  // alphabet and can hide the dashed or dotted border. Each status sets exactly one.
  const CASES: [string, string][] = [
    ['home', 'Mon 12 Oct, home'],
    ['office', 'Tue 13 Oct, office'],
    ['leave', 'Wed 14 Oct, leave'],
    ['missing', 'Thu 15 Oct, not filled in'],
    ['empty', 'Sat 17 Oct, no record'],
    ['future', 'Tue 20 Oct, no record'],
  ];

  it.each(CASES)('gives a %s day exactly one border colour', (_status, name) => {
    renderCalendar();
    expect(borderColours(screen.getByRole('button', { name }))).toHaveLength(1);
  });

  it('draws a leave day with a dashed border in a visible colour', () => {
    renderCalendar();
    const leave = screen.getByRole('button', { name: 'Wed 14 Oct, leave' });
    expect(leave).toHaveClass('border', 'border-dashed');
    expect(borderColours(leave)).not.toContain('border-transparent');
  });

  it('draws a missing day with a dotted border in a visible colour', () => {
    renderCalendar();
    const missing = screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' });
    expect(missing).toHaveClass('border', 'border-dotted');
    expect(borderColours(missing)).not.toContain('border-transparent');
  });
});

describe('MonthCalendar', () => {
  it('shows the weekday headers Monday first', () => {
    renderCalendar();
    const headers = screen.getByTestId('calendar-weekdays');
    expect(Array.from(headers.children).map((c) => c.textContent)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });

  it('names each day button by its date and status', () => {
    renderCalendar();
    expect(screen.getByRole('button', { name: 'Mon 12 Oct, home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tue 13 Oct, office' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wed 14 Oct, leave' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' })).toBeInTheDocument();
  });

  it('shows the day number as the visible content of a day', () => {
    renderCalendar();
    expect(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' })).toHaveTextContent('15');
  });

  it('calls onSelect with the date of a clicked day', () => {
    const { onSelect } = renderCalendar();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('2026-10-15');
  });

  it('lets a day with no record be selected', () => {
    const { onSelect } = renderCalendar();
    // Saturday 17 October is a past non-working day: empty, not missing.
    fireEvent.click(screen.getByRole('button', { name: 'Sat 17 Oct, no record' }));
    expect(onSelect).toHaveBeenCalledWith('2026-10-17');
  });

  it('lets today be selected, named as no record until it has one', () => {
    const { onSelect } = renderCalendar();
    const today = screen.getByRole('button', { name: 'Mon 19 Oct, no record' });
    expect(today).toBeEnabled();
    fireEvent.click(today);
    expect(onSelect).toHaveBeenCalledWith('2026-10-19');
  });

  it('disables a future day and ignores a click on it', () => {
    const { onSelect } = renderCalendar();
    const future = screen.getByRole('button', { name: 'Tue 20 Oct, no record' });
    expect(future).toBeDisabled();
    fireEvent.click(future);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks only today with aria-current', () => {
    renderCalendar();
    expect(screen.getByRole('button', { name: 'Mon 19 Oct, no record' })).toHaveAttribute('aria-current', 'date');
    expect(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' })).not.toHaveAttribute('aria-current');
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(1);
  });

  it('adds "added later" to the name of a late day', () => {
    renderCalendar({ days: [day('2026-10-14', { addedLater: true })] });
    expect(screen.getByRole('button', { name: 'Wed 14 Oct, home, added later' })).toBeInTheDocument();
  });

  it('adds "finish not confirmed" to the name of an unconfirmed day', () => {
    renderCalendar({ days: [day('2026-10-14', { finishConfirmed: false })] });
    expect(screen.getByRole('button', { name: 'Wed 14 Oct, home, finish not confirmed' })).toBeInTheDocument();
  });

  it('names a day that is both late and unconfirmed with both, late first', () => {
    renderCalendar({ days: [day('2026-10-14', { addedLater: true, finishConfirmed: false })] });
    expect(
      screen.getByRole('button', { name: 'Wed 14 Oct, home, added later, finish not confirmed' }),
    ).toBeInTheDocument();
  });

  it('presses only the selected day', () => {
    renderCalendar({ selectedDate: '2026-10-15' });
    expect(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mon 12 Oct, home' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
  });

  it('presses nothing when no date is selected', () => {
    renderCalendar({ selectedDate: null });
    expect(document.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
  });

  it('renders the padding cells as hidden blanks, not buttons', () => {
    const { container } = renderCalendar();
    // October 2026 has 31 days and 35 cells: three blanks before the 1st and one after the 31st.
    expect(screen.getAllByRole('button')).toHaveLength(31);
    expect(container.querySelectorAll('div[aria-hidden="true"]:empty')).toHaveLength(4);
  });

  it('shows another month from the month it is given', () => {
    renderCalendar({ month: '2026-09', days: [day('2026-09-30')] });
    expect(screen.getByRole('button', { name: 'Wed 30 Sep, home' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(30);
  });
});
