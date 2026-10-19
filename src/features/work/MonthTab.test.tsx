import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc, WorkDayType, WorkSettingsDoc } from '../../types/models';
import type { Clock } from '../../lib/work/workDates';
import { DEFAULT_WORK_SETTINGS } from '../../lib/work/workSettings';
import { useWorkDays } from '../../hooks/useWorkDays';
import MonthTab from './MonthTab';

const state = vi.hoisted(() => ({
  work: null as unknown,
  byYear: {} as Record<string, { days: unknown[]; loading: boolean; error: boolean }>,
  desktop: false,
  mounts: 0,
  // The latest onSaved each date's editor was given, for calling one late.
  saved: {} as Record<string, () => void>,
}));

const NO_DAYS = vi.hoisted(() => ({ days: [] as unknown[], loading: false, error: false }));
vi.mock('../../hooks/useWorkDays', () => ({
  useWorkDays: vi.fn((uid: string | undefined, year: string) => (uid ? (state.byYear[year] ?? NO_DAYS) : NO_DAYS)),
}));
vi.mock('./WorkContext', () => ({ useWork: () => state.work }));
vi.mock('../../hooks/useMediaQuery', () => ({ useIsDesktop: () => state.desktop }));
vi.mock('./DayEditor', async () => {
  const { useEffect, useState } = await import('react');
  function DayEditorStub({
    date,
    existing,
    settingsLoaded,
    daysLoaded,
    onSaved,
  }: {
    date: string;
    existing: { date: string } | null;
    settingsLoaded: boolean;
    daysLoaded: boolean;
    onSaved: () => void;
  }) {
    const [mount] = useState(() => ++state.mounts);
    useEffect(() => {
      state.saved[date] = onSaved;
    });
    return (
      <div
        data-testid="day-editor"
        data-date={date}
        data-existing={existing?.date ?? ''}
        data-settings-loaded={String(settingsLoaded)}
        data-days-loaded={String(daysLoaded)}
        data-mount={mount}
      >
        <button type="button" onClick={onSaved}>
          {`Saved ${date}`}
        </button>
      </div>
    );
  }
  return { default: DayEditorStub };
});

const TODAY = '2026-10-19';
const CLOCK: Clock = { today: TODAY, nowMinutes: 540 };
const SETTINGS: WorkSettingsDoc = { ...DEFAULT_WORK_SETTINGS, trackingStartDate: '2026-10-12' };

// A Home day of 7.6 h; its times are dropped by dayWithoutTimes for the other types.
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
    finishConfirmed: false,
    firstRecordedAt: {} as Timestamp,
    recordedAt: {} as Timestamp,
    syncedAt: {} as Timestamp,
    revisions: [],
    ...overrides,
  };
}

function dayWithoutTimes(date: string, type: Exclude<WorkDayType, 'home'> | null): WorkDayDoc {
  const doc = day(date, { type, countedInClaim: false });
  delete doc.startTime;
  delete doc.finishTime;
  delete doc.minutes;
  return doc;
}

// Ascending, as the hook returns them: Thu 8 Oct was cleared, Fri 9 is Leave,
// Mon 12 is Home, Tue 13 Office and Wed 14 Home at 7.75 h; Fri 25 Sep is in September.
const DAYS = [
  day('2026-09-25', { minutes: 300 }),
  dayWithoutTimes('2026-10-08', null),
  dayWithoutTimes('2026-10-09', 'leave'),
  day('2026-10-12', { finishConfirmed: true }),
  dayWithoutTimes('2026-10-13', 'office'),
  day('2026-10-14', { minutes: 465 }),
];

function setWork(overrides: Record<string, unknown> = {}) {
  state.work = {
    uid: 'mike',
    settings: SETTINGS,
    settingsLoading: false,
    settingsLoaded: true,
    clock: CLOCK,
    ...overrides,
  };
}

function setYear(year: string, days: WorkDayDoc[], loading = false, error = false) {
  state.byYear[year] = { days, loading, error };
}

const renderTab = () => render(<MonthTab />);

const previous = () => screen.getByRole('button', { name: 'Previous month' });
const next = () => screen.getByRole('button', { name: 'Next month' });
const heading = (name: string) => screen.getByRole('heading', { level: 2, name });
const list = () => screen.getByRole('list', { name: 'Recorded days' });
const rows = () => within(list()).getAllByRole('button');
const rowTexts = () => rows().map((row) => Array.from(row.children).map((child) => child.textContent));
const editors = () => screen.queryAllByTestId('day-editor');
const sheet = () => screen.getByRole('dialog');

beforeEach(() => {
  setWork();
  state.byYear = {};
  setYear('2026-27', DAYS);
  state.desktop = false;
  state.mounts = 0;
  state.saved = {};
  vi.mocked(useWorkDays).mockClear();
});

describe('MonthTab month navigation', () => {
  it('opens on the current month', () => {
    renderTab();
    expect(heading('October 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon 12 Oct, home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon 19 Oct, no record' })).toHaveAttribute('aria-current', 'date');
  });

  it('steps back to the month before and forward again', () => {
    renderTab();
    fireEvent.click(previous());
    expect(heading('September 2026')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'October 2026' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Fri 25 Sep, home, finish not confirmed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Oct/ })).toBeNull();

    fireEvent.click(next());
    expect(heading('October 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon 12 Oct, home' })).toBeInTheDocument();
  });

  it('disables Next month in the current month and enables it after stepping back', () => {
    renderTab();
    expect(next()).toBeDisabled();
    fireEvent.click(next());
    expect(heading('October 2026')).toBeInTheDocument();

    fireEvent.click(previous());
    expect(next()).toBeEnabled();
    fireEvent.click(next());
    expect(heading('October 2026')).toBeInTheDocument();
    expect(next()).toBeDisabled();
  });

  it('does not bound Previous month', () => {
    renderTab();
    for (let i = 0; i < 14; i++) fireEvent.click(previous());
    expect(heading('August 2025')).toBeInTheDocument();
    expect(previous()).toBeEnabled();
  });

  it('measures “the current month” by the clock, across a year end', () => {
    setWork({ clock: { today: '2027-01-15', nowMinutes: 540 } });
    renderTab();
    expect(heading('January 2027')).toBeInTheDocument();
    expect(next()).toBeDisabled();
    fireEvent.click(previous());
    expect(heading('December 2026')).toBeInTheDocument();
    expect(next()).toBeEnabled();
  });

  it('draws the controls as labelled icon buttons', () => {
    renderTab();
    for (const button of [previous(), next()]) {
      expect(button).toHaveAttribute('type', 'button');
      expect(button.textContent).toBe('');
      expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
  });
});

describe('MonthTab days subscription', () => {
  it('subscribes to the income year of the viewed month for the user', () => {
    renderTab();
    expect(useWorkDays).toHaveBeenCalledWith('mike', '2026-27');
  });

  it('keeps the one subscription while stepping within an income year', () => {
    renderTab();
    // October back to July 2026: all in 2026-27.
    for (let i = 0; i < 3; i++) fireEvent.click(previous());
    expect(heading('July 2026')).toBeInTheDocument();
    const years = vi.mocked(useWorkDays).mock.calls.map(([, year]) => year);
    expect(years.length).toBeGreaterThan(3);
    expect(new Set(years)).toEqual(new Set(['2026-27']));
  });

  it('asks for the previous income year from June 2026 on', () => {
    renderTab();
    for (let i = 0; i < 3; i++) fireEvent.click(previous());
    expect(useWorkDays).toHaveBeenLastCalledWith('mike', '2026-27');
    fireEvent.click(previous());
    expect(heading('June 2026')).toBeInTheDocument();
    expect(useWorkDays).toHaveBeenLastCalledWith('mike', '2025-26');
    fireEvent.click(previous());
    expect(heading('May 2026')).toBeInTheDocument();
    expect(useWorkDays).toHaveBeenLastCalledWith('mike', '2025-26');
  });

  it('goes back to the later income year when stepping forward over the June and July boundary', () => {
    setWork({ clock: { today: '2026-07-10', nowMinutes: 540 } });
    renderTab();
    expect(heading('July 2026')).toBeInTheDocument();
    expect(useWorkDays).toHaveBeenLastCalledWith('mike', '2026-27');
    fireEvent.click(previous());
    expect(heading('June 2026')).toBeInTheDocument();
    expect(useWorkDays).toHaveBeenLastCalledWith('mike', '2025-26');
    fireEvent.click(next());
    expect(heading('July 2026')).toBeInTheDocument();
    expect(useWorkDays).toHaveBeenLastCalledWith('mike', '2026-27');
  });

  it('shows the days of the income year it asked for', () => {
    setWork({ clock: { today: '2026-07-10', nowMinutes: 540 } });
    setYear('2026-27', []);
    setYear('2025-26', [day('2026-06-30', { incomeYear: '2025-26' })]);
    renderTab();
    expect(screen.getByText('Nothing recorded this month.')).toBeInTheDocument();
    fireEvent.click(previous());
    expect(screen.getByRole('button', { name: 'Tue 30 Jun, home, finish not confirmed' })).toBeInTheDocument();
    expect(rowTexts()).toEqual([['Tue 30 Jun', 'Home', '7.6 h']]);
  });

  it('subscribes for no one without a uid', () => {
    setWork({ uid: undefined });
    renderTab();
    expect(useWorkDays).toHaveBeenCalledWith(undefined, '2026-27');
  });
});

describe('MonthTab loading', () => {
  it('keeps the heading and controls, and shows a skeleton in place of the calendar, while days load', () => {
    setYear('2026-27', [], true);
    renderTab();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(heading('October 2026')).toBeInTheDocument();
    expect(previous()).toBeEnabled();
    expect(next()).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Oct/ })).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText('Nothing recorded this month.')).toBeNull();
    expect(editors()).toHaveLength(0);
  });

  it('shows the same while the settings load', () => {
    setWork({ settingsLoading: true, settingsLoaded: false });
    renderTab();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(heading('October 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Oct/ })).toBeNull();
    expect(screen.queryByText('Nothing recorded this month.')).toBeNull();
    expect(editors()).toHaveLength(0);
  });

  it('shows the calendar and list, and no skeleton, once everything has loaded', () => {
    renderTab();
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mon 12 Oct, home' })).toBeInTheDocument();
    expect(list()).toBeInTheDocument();
  });

  it('keeps the controls working while another income year loads, and shows its calendar once loaded', () => {
    setWork({ clock: { today: '2026-07-10', nowMinutes: 540 } });
    setYear('2025-26', [], true);
    renderTab();
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();

    fireEvent.click(previous());
    expect(heading('June 2026')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
    expect(editors()).toHaveLength(0);
    expect(next()).toBeEnabled();
    expect(previous()).toBeEnabled();

    setYear('2025-26', [day('2026-06-30', { incomeYear: '2025-26' })]);
    fireEvent.click(previous());
    expect(heading('May 2026')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    fireEvent.click(next());
    expect(screen.getByRole('button', { name: 'Tue 30 Jun, home, finish not confirmed' })).toBeInTheDocument();
  });

  it('shows no load error once the days have loaded', () => {
    renderTab();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // After a listener error the days are an empty list that only looks like a
  // month with nothing recorded, so nothing may be written from it.
  it('says the days could not load in place of the list, and tells the editor they have not loaded', () => {
    setYear('2026-27', [], false, true);
    renderTab();
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your Work days.");
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText('Nothing recorded this month.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' }));
    expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-days-loaded', 'false');
  });

  it('mounts no editor while loading, even with a date open before', () => {
    setWork({ clock: { today: '2026-07-10', nowMinutes: 540 } });
    setYear('2026-27', [day('2026-07-02')]);
    setYear('2025-26', [], true);
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 2 Jul, home, finish not confirmed' }));
    expect(editors()).toHaveLength(1);
    fireEvent.click(previous());
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(editors()).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('MonthTab recorded days list', () => {
  it('lists the month’s recorded days newest first, with the type and, for Home, the hours', () => {
    renderTab();
    expect(rowTexts()).toEqual([
      ['Wed 14 Oct', 'Home', '7.75 h'],
      ['Tue 13 Oct', 'Office'],
      ['Mon 12 Oct', 'Home', '7.6 h'],
      ['Fri 9 Oct', 'Leave'],
    ]);
  });

  it('orders by date however the days arrive', () => {
    setYear('2026-27', [...DAYS].reverse());
    renderTab();
    expect(rows().map((row) => row.firstElementChild?.textContent)).toEqual([
      'Wed 14 Oct',
      'Tue 13 Oct',
      'Mon 12 Oct',
      'Fri 9 Oct',
    ]);
  });

  it('leaves out a cleared record', () => {
    renderTab();
    expect(within(list()).queryByText('Thu 8 Oct')).toBeNull();
    // It is still a day on the calendar.
    expect(screen.getByRole('button', { name: 'Thu 8 Oct, no record' })).toBeInTheDocument();
  });

  it('lists only the viewed month’s days', () => {
    renderTab();
    expect(within(list()).queryByText('Fri 25 Sep')).toBeNull();
    fireEvent.click(previous());
    expect(rowTexts()).toEqual([['Fri 25 Sep', 'Home', '5.0 h']]);
  });

  it('shows no hours for a Home record that has none', () => {
    setYear('2026-27', [{ ...day('2026-10-12'), minutes: undefined }]);
    renderTab();
    expect(rowTexts()).toEqual([['Mon 12 Oct', 'Home']]);
  });

  it('names each row by its day, type and hours', () => {
    renderTab();
    expect(within(list()).getByRole('button', { name: 'Mon 12 Oct, Home, 7.6 h' })).toBeInTheDocument();
    expect(within(list()).getByRole('button', { name: 'Tue 13 Oct, Office' })).toBeInTheDocument();
    expect(within(list()).getByRole('button', { name: 'Fri 9 Oct, Leave' })).toBeInTheDocument();
  });

  it('says so when the month has no recorded days, and shows no list', () => {
    renderTab();
    for (let i = 0; i < 2; i++) fireEvent.click(previous());
    expect(heading('August 2026')).toBeInTheDocument();
    expect(screen.getByText('Nothing recorded this month.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('treats a month with only cleared records as empty', () => {
    setYear('2026-27', [dayWithoutTimes('2026-10-08', null)]);
    renderTab();
    expect(screen.getByText('Nothing recorded this month.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('does not say it when there are rows', () => {
    renderTab();
    expect(screen.queryByText('Nothing recorded this month.')).toBeNull();
  });

  // The list clips its corners (overflow-hidden), which would clip an outline too.
  it('draws each row’s keyboard focus as a ring inside the row', () => {
    renderTab();
    for (const row of rows()) {
      expect(row).toHaveClass(
        'focus-visible:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-inset',
        'focus-visible:ring-accent',
      );
    }
  });

  it('lists the calendar and then the list in that order', () => {
    renderTab();
    const calendar = screen.getByRole('button', { name: 'Mon 12 Oct, home' });
    expect(calendar.compareDocumentPosition(list()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('MonthTab day sheet', () => {
  it('opens for a day picked from the calendar and marks it selected', () => {
    renderTab();
    expect(screen.queryByRole('dialog')).toBeNull();
    const cell = screen.getByRole('button', { name: 'Tue 13 Oct, office' });
    expect(cell).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(cell);
    expect(within(sheet()).getByRole('heading', { name: 'Tue 13 Oct' })).toBeInTheDocument();
    const editor = within(sheet()).getByTestId('day-editor');
    expect(editor).toHaveAttribute('data-date', '2026-10-13');
    expect(editor).toHaveAttribute('data-existing', '2026-10-13');
    expect(editor).toHaveAttribute('data-days-loaded', 'true');
    expect(editor).toHaveAttribute('data-settings-loaded', 'true');
    expect(screen.getByRole('button', { name: 'Tue 13 Oct, office' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens a day with no record with nothing to edit from', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' }));
    expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-existing', '');
  });

  it('gives a cleared day’s record to the editor', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 8 Oct, no record' }));
    expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-existing', '2026-10-08');
  });

  it('does not open for a future day', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Tue 20 Oct, no record' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens for a day picked from the list, with its record', () => {
    renderTab();
    fireEvent.click(within(list()).getByRole('button', { name: 'Fri 9 Oct, Leave' }));
    expect(within(sheet()).getByRole('heading', { name: 'Fri 9 Oct' })).toBeInTheDocument();
    const editor = within(sheet()).getByTestId('day-editor');
    expect(editor).toHaveAttribute('data-date', '2026-10-09');
    expect(editor).toHaveAttribute('data-existing', '2026-10-09');
    expect(screen.getByRole('button', { name: 'Fri 9 Oct, leave' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('tells the editor the settings have not loaded after a settings error', () => {
    setWork({ settingsLoading: false, settingsLoaded: false });
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Tue 13 Oct, office' }));
    const editor = within(sheet()).getByTestId('day-editor');
    expect(editor).toHaveAttribute('data-settings-loaded', 'false');
    expect(editor).toHaveAttribute('data-days-loaded', 'true');
  });

  it('closes when the editor has saved', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' }));
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Saved 2026-10-15' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(editors()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes from the backdrop', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' }));
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('starts a fresh editor for each date picked', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' }));
    const first = within(sheet()).getByTestId('day-editor').getAttribute('data-mount');
    fireEvent.click(screen.getByRole('button', { name: 'Fri 16 Oct, not filled in' }));
    const second = within(sheet()).getByTestId('day-editor');
    expect(second).toHaveAttribute('data-date', '2026-10-16');
    expect(second.getAttribute('data-mount')).not.toBe(first);
  });

  it('closes when the month changes, and does not come back on returning', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Tue 13 Oct, office' }));
    expect(sheet()).toBeInTheDocument();

    fireEvent.click(previous());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(editors()).toHaveLength(0);

    fireEvent.click(next());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tue 13 Oct, office' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes when stepping forward as well', () => {
    renderTab();
    fireEvent.click(previous());
    fireEvent.click(screen.getByRole('button', { name: 'Fri 25 Sep, home, finish not confirmed' }));
    expect(sheet()).toBeInTheDocument();
    fireEvent.click(next());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes when the month changes across an income year', () => {
    setWork({ clock: { today: '2026-07-10', nowMinutes: 540 } });
    setYear('2026-27', [day('2026-07-02')]);
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 2 Jul, home, finish not confirmed' }));
    fireEvent.click(previous());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(editors()).toHaveLength(0);
  });

  it('closes only the date an editor was opened for when it reports it has saved', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' }));
    const lateForFifteenth = state.saved['2026-10-15'];
    fireEvent.click(screen.getByRole('button', { name: 'Fri 16 Oct, not filled in' }));
    expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-date', '2026-10-16');

    // The first day's acknowledgement arrives after the second day was opened.
    act(() => lateForFifteenth());
    expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-date', '2026-10-16');
    expect(screen.getByRole('button', { name: 'Fri 16 Oct, not filled in' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('closes the date an editor was opened for when its own callback is called late', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' }));
    act(() => state.saved['2026-10-15']());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  describe('on desktop', () => {
    beforeEach(() => {
      state.desktop = true;
    });

    it('shows the day inline in the page rather than in a sheet', () => {
      renderTab();
      fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      const region = screen.getByRole('region', { name: 'Thu 15 Oct' });
      expect(within(region).getByTestId('day-editor')).toHaveAttribute('data-date', '2026-10-15');
    });

    it('closes from the Close button and when the editor has saved', () => {
      renderTab();
      fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' }));
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('region', { name: 'Thu 15 Oct' })).toBeNull();

      fireEvent.click(within(list()).getByRole('button', { name: 'Fri 9 Oct, Leave' }));
      fireEvent.click(within(screen.getByRole('region', { name: 'Fri 9 Oct' })).getByRole('button', { name: 'Saved 2026-10-09' }));
      expect(screen.queryByRole('region', { name: 'Fri 9 Oct' })).toBeNull();
    });
  });
});
