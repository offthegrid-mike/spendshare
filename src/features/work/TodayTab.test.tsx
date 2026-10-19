import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc, WorkDayType, WorkSettingsDoc } from '../../types/models';
import type { Clock } from '../../lib/work/workDates';
import { DEFAULT_WORK_SETTINGS } from '../../lib/work/workSettings';
import { useWorkDays } from '../../hooks/useWorkDays';
import TodayTab from './TodayTab';

const state = vi.hoisted(() => ({
  work: null as unknown,
  byYear: {} as Record<string, { days: unknown[]; loading: boolean; error: boolean }>,
  desktop: false,
  mounts: 0,
  // The real hook keeps its last days for one render after the uid goes away.
  stale: false,
  // The latest onSaved each date's editor was given, for calling one late.
  saved: {} as Record<string, () => void>,
}));

// Like the real hook: no uid means no subscription, so no days, not loading and no error.
const NO_DAYS = vi.hoisted(() => ({ days: [] as unknown[], loading: false, error: false }));
vi.mock('../../hooks/useWorkDays', () => ({
  useWorkDays: vi.fn((uid: string | undefined, year: string) =>
    uid || state.stale ? (state.byYear[year] ?? NO_DAYS) : NO_DAYS,
  ),
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
// Tracking from Monday 12 October, so Thursday 15 and Friday 16 October are missing.
const SETTINGS: WorkSettingsDoc = { ...DEFAULT_WORK_SETTINGS, trackingStartDate: '2026-10-12' };

// A Home day finishing 16:06 that is counted in the claim; unconfirmed unless `finishConfirmed` is set.
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

// Mon 12 Oct Home and confirmed, Tue 13 Office, Wed 14 Home and unconfirmed;
// Thu 15 and Fri 16 are missing. Two counted Home days: 15.2 h, $10 at 70c/h.
const DAYS = [
  day('2026-10-12', { finishConfirmed: true }),
  dayWithoutTimes('2026-10-13', 'office'),
  day('2026-10-14'),
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

function renderTab() {
  return render(
    <MemoryRouter>
      <TodayTab />
    </MemoryRouter>,
  );
}

const editors = () => screen.getAllByTestId('day-editor');
const editorFor = (date: string) => editors().find((el) => el.getAttribute('data-date') === date);
const sheet = () => screen.getByRole('dialog');

beforeEach(() => {
  setWork();
  state.byYear = {};
  setYear('2026-27', DAYS);
  state.desktop = false;
  state.mounts = 0;
  state.stale = false;
  state.saved = {};
  vi.mocked(useWorkDays).mockClear();
});

describe('TodayTab loading', () => {
  it('shows the skeleton and no editor while this year’s days load', () => {
    setYear('2026-27', [], true);
    renderTab();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByTestId('day-editor')).toBeNull();
    expect(screen.queryByRole('heading', { name: /Today/ })).toBeNull();
    expect(screen.queryByText(/not filled in/)).toBeNull();
  });

  it('shows the skeleton while the settings load', () => {
    setWork({ settingsLoading: true, settingsLoaded: false });
    renderTab();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByTestId('day-editor')).toBeNull();
  });

  it('shows the skeleton while the previous year loads in early July', () => {
    setWork({ clock: { today: '2026-07-05', nowMinutes: 540 } });
    setYear('2026-27', []);
    setYear('2025-26', [], true);
    renderTab();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByTestId('day-editor')).toBeNull();
  });

  it('shows the screen once everything has loaded', () => {
    renderTab();
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    expect(screen.getByTestId('day-editor')).toBeInTheDocument();
  });

  it('lets the editors know the days have loaded and, after a settings error, that the settings have not', () => {
    setWork({ settingsLoading: false, settingsLoaded: false });
    renderTab();
    const editor = editorFor(TODAY);
    expect(editor).toHaveAttribute('data-days-loaded', 'true');
    expect(editor).toHaveAttribute('data-settings-loaded', 'false');
  });

  it('shows no load error once the days have loaded', () => {
    renderTab();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// After a listener error the days are an empty list that only looks like a
// year with nothing recorded, so nothing may be written or nudged from it.
describe('TodayTab after the days fail to load', () => {
  const LOAD_FAILED = "Couldn't load your Work days.";

  it('says so in place of the banner and tells both editors the days have not loaded', () => {
    setYear('2026-27', [], false, true);
    renderTab();
    expect(screen.getByRole('alert')).toHaveTextContent(LOAD_FAILED);
    expect(screen.queryByText(/not filled in/)).toBeNull();
    expect(screen.queryByText(/to confirm/)).toBeNull();
    expect(editorFor(TODAY)).toHaveAttribute('data-days-loaded', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' }));
    expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-days-loaded', 'false');
  });

  it('does the same when the previous year fails early in July', () => {
    setWork({ clock: { today: '2026-07-05', nowMinutes: 540 }, settings: { ...SETTINGS, trackingStartDate: '2026-07-01' } });
    setYear('2026-27', []);
    setYear('2025-26', [], false, true);
    renderTab();
    expect(screen.getByRole('alert')).toHaveTextContent(LOAD_FAILED);
    expect(screen.queryByText(/not filled in/)).toBeNull();
    expect(editorFor('2026-07-05')).toHaveAttribute('data-days-loaded', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Thu 2 Jul, not filled in' }));
    expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-days-loaded', 'false');
  });
});

describe('TodayTab', () => {
  it('subscribes to this income year’s days for the user', () => {
    renderTab();
    expect(useWorkDays).toHaveBeenCalledWith('mike', '2026-27');
  });

  it('shows the banner with the missing weekdays and the days to confirm', () => {
    renderTab();
    expect(screen.getByText('2 weekdays not filled in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thu 15 Oct' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fri 16 Oct' })).toBeInTheDocument();
    expect(screen.getByText('1 day to confirm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wed 14 Oct' })).toBeInTheDocument();
  });

  it('shows no banner when nothing is missing or to confirm', () => {
    setYear('2026-27', [day('2026-10-12', { finishConfirmed: true })]);
    setWork({ settings: { ...SETTINGS, trackingStartDate: null } });
    renderTab();
    expect(screen.queryByText(/not filled in/)).toBeNull();
    expect(screen.queryByText(/to confirm/)).toBeNull();
  });

  it('shows the Today card with an editor for today and no record yet', () => {
    renderTab();
    expect(screen.getByRole('heading', { name: 'Today · Mon 19 Oct' })).toBeInTheDocument();
    expect(screen.getByText('not saved yet')).toBeInTheDocument();
    const editor = editorFor(TODAY);
    expect(editor).toHaveAttribute('data-existing', '');
  });

  it('gives the Today card’s editor today’s record', () => {
    setYear('2026-27', [...DAYS, day(TODAY, { finishConfirmed: true })]);
    renderTab();
    expect(screen.getByText('finish confirmed')).toBeInTheDocument();
    expect(editorFor(TODAY)).toHaveAttribute('data-existing', TODAY);
  });

  it('reads a cleared record for today as not saved yet', () => {
    setYear('2026-27', [...DAYS, dayWithoutTimes(TODAY, null)]);
    renderTab();
    expect(screen.getByText('not saved yet')).toBeInTheDocument();
  });

  it('shows the current month’s calendar', () => {
    renderTab();
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon 12 Oct, home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tue 13 Oct, office' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon 19 Oct, no record' })).toHaveAttribute('aria-current', 'date');
  });

  it('shows the income year so far', () => {
    renderTab();
    expect(screen.getByRole('heading', { name: 'Income year 2026–27 so far' })).toBeInTheDocument();
    expect(screen.getByText('15.2 h')).toBeInTheDocument();
    expect(screen.getByText('from home · 2 days')).toBeInTheDocument();
    expect(screen.getByText('≈ $10')).toBeInTheDocument();
  });

  it('shows a carried rate for a year with no rate of its own, and a set one at that rate', () => {
    const { unmount } = renderTab();
    expect(screen.getByText('at 70c/h')).toBeInTheDocument();
    expect(screen.getByText('70c is the 2025–26 rate until you set one')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set the rate' })).toHaveAttribute('href', '/work/more');
    unmount();

    setWork({ settings: { ...SETTINGS, ratesCentsPerHour: { '2026-27': 72 } } });
    renderTab();
    expect(screen.getByText('at 72c/h')).toBeInTheDocument();
    expect(screen.queryByText(/until you set one/)).toBeNull();
  });

  it('counts added-later and unconfirmed days in the year card', () => {
    setYear('2026-27', [
      ...DAYS,
      day('2026-10-09', { addedLater: true, countedInClaim: false, finishConfirmed: true }),
    ]);
    renderTab();
    expect(screen.getByText('Added later · 1 day · 7.6 h · not in the claim')).toBeInTheDocument();
    expect(screen.getByText('Not confirmed · 1 day · 7.6 h · still counted')).toBeInTheDocument();
  });

  it('stacks the banner, the Today card, the calendar and the year card in that order', () => {
    renderTab();
    const order = [
      screen.getByText('2 weekdays not filled in'),
      screen.getByRole('heading', { name: 'Today · Mon 19 Oct' }),
      screen.getByRole('heading', { name: 'October 2026' }),
      screen.getByRole('heading', { name: 'Income year 2026–27 so far' }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('opens no sheet at first', () => {
    renderTab();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(editors()).toHaveLength(1);
  });
});

describe('TodayTab day sheet', () => {
  it('opens for a missing day picked from the banner', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct' }));
    expect(within(sheet()).getByRole('heading', { name: 'Thu 15 Oct' })).toBeInTheDocument();
    const editor = within(sheet()).getByTestId('day-editor');
    expect(editor).toHaveAttribute('data-date', '2026-10-15');
    expect(editor).toHaveAttribute('data-existing', '');
    expect(editor).toHaveAttribute('data-days-loaded', 'true');
    expect(editor).toHaveAttribute('data-settings-loaded', 'true');
  });

  it('opens a day to confirm with its record', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Wed 14 Oct' }));
    expect(within(sheet()).getByRole('heading', { name: 'Wed 14 Oct' })).toBeInTheDocument();
    expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-existing', '2026-10-14');
  });

  it('opens for a day picked from the calendar and marks it selected', () => {
    renderTab();
    const cell = screen.getByRole('button', { name: 'Tue 13 Oct, office' });
    expect(cell).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(cell);
    expect(within(sheet()).getByRole('heading', { name: 'Tue 13 Oct' })).toBeInTheDocument();
    const editor = within(sheet()).getByTestId('day-editor');
    expect(editor).toHaveAttribute('data-date', '2026-10-13');
    expect(editor).toHaveAttribute('data-existing', '2026-10-13');
    expect(screen.getByRole('button', { name: 'Tue 13 Oct, office' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not open for a future day', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Tue 20 Oct, no record' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes when the editor has saved', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct' }));
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Saved 2026-10-15' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(editors()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Thu 15 Oct, not filled in' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes from the backdrop', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct' }));
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes only the date an editor was opened for when it reports it has saved', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct' }));
    act(() => state.saved['2026-10-15']());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('starts a fresh editor for each date picked', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct' }));
    const first = within(sheet()).getByTestId('day-editor').getAttribute('data-mount');
    fireEvent.click(screen.getByRole('button', { name: 'Fri 16 Oct, not filled in' }));
    const second = within(sheet()).getByTestId('day-editor');
    expect(second).toHaveAttribute('data-date', '2026-10-16');
    expect(second.getAttribute('data-mount')).not.toBe(first);
  });

  it('leaves the sheet open when the Today card’s editor saves', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct' }));
    fireEvent.click(screen.getByRole('button', { name: `Saved ${TODAY}` }));
    expect(sheet()).toBeInTheDocument();
    expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-date', '2026-10-15');
  });

  // DayEditor keeps a form's edits over a new record, so two live editors for one
  // date would let edits left in one be written back over a save from the other.
  describe('for today’s date', () => {
    const pickToday = () => fireEvent.click(screen.getByRole('button', { name: 'Mon 19 Oct, no record' }));

    it('mounts only the sheet’s editor, the Today card keeping its heading and status', () => {
      renderTab();
      expect(editors()).toHaveLength(1);
      pickToday();
      expect(editors()).toHaveLength(1);
      expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-date', TODAY);
      expect(screen.getByRole('heading', { name: 'Today · Mon 19 Oct' })).toBeInTheDocument();
      expect(screen.getByText('not saved yet')).toBeInTheDocument();
    });

    it('mounts only the inline editor on desktop', () => {
      state.desktop = true;
      renderTab();
      pickToday();
      expect(editors()).toHaveLength(1);
      expect(within(screen.getByRole('region', { name: 'Mon 19 Oct' })).getByTestId('day-editor')).toHaveAttribute(
        'data-date',
        TODAY,
      );
    });

    it('brings the Today card’s editor back, fresh, when the sheet closes', () => {
      renderTab();
      const before = editorFor(TODAY)?.getAttribute('data-mount');
      pickToday();
      fireEvent.click(within(sheet()).getByRole('button', { name: `Saved ${TODAY}` }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(editors()).toHaveLength(1);
      const after = editorFor(TODAY)?.getAttribute('data-mount');
      expect(after).toBeTruthy();
      expect(after).not.toBe(before);
    });

    it('brings the Today card’s editor back when the sheet is dismissed', () => {
      renderTab();
      pickToday();
      fireEvent.click(screen.getByTestId('sheet-backdrop'));
      expect(editors()).toHaveLength(1);
      expect(editorFor(TODAY)).toBeInTheDocument();
    });

    it('brings the Today card’s editor back, fresh, when today is picked and then another day', () => {
      renderTab();
      pickToday();
      const inSheet = within(sheet()).getByTestId('day-editor').getAttribute('data-mount');
      fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct' }));
      expect(editors()).toHaveLength(2);
      expect(editorFor(TODAY)?.getAttribute('data-mount')).not.toBe(inSheet);
      expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-date', '2026-10-15');
    });
  });

  it('leaves the Today card’s editor in place while another date is open', () => {
    renderTab();
    const mount = editorFor(TODAY)?.getAttribute('data-mount');
    fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct' }));
    expect(editors()).toHaveLength(2);
    expect(editors().filter((el) => el.getAttribute('data-date') === TODAY)).toHaveLength(1);
    expect(editorFor(TODAY)).toHaveAttribute('data-mount', mount);
  });

  describe('on desktop', () => {
    beforeEach(() => {
      state.desktop = true;
    });

    it('shows the day inline below the calendar and above the year card', () => {
      renderTab();
      fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      const region = screen.getByRole('region', { name: 'Thu 15 Oct' });
      expect(within(region).getByTestId('day-editor')).toHaveAttribute('data-date', '2026-10-15');
      const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      expect(follows(screen.getByRole('heading', { name: 'October 2026' }), region)).toBe(true);
      expect(follows(region, screen.getByRole('heading', { name: 'Income year 2026–27 so far' }))).toBe(true);
    });

    it('closes from the Close button and when the editor has saved', () => {
      renderTab();
      fireEvent.click(screen.getByRole('button', { name: 'Thu 15 Oct' }));
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('region', { name: 'Thu 15 Oct' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Fri 16 Oct' }));
      fireEvent.click(within(screen.getByRole('region', { name: 'Fri 16 Oct' })).getByRole('button', { name: 'Saved 2026-10-16' }));
      expect(screen.queryByRole('region', { name: 'Fri 16 Oct' })).toBeNull();
    });
  });
});

// In the first 14 days of an income year the banner also reaches back to the
// year that has just ended, so a day left unconfirmed in June is still offered.
describe('TodayTab early in an income year', () => {
  const EARLY: Clock = { today: '2026-07-05', nowMinutes: 540 };
  // Mon 29 and Tue 30 June, the last two working days of 2025-26, both unconfirmed.
  const PREVIOUS = [
    day('2026-06-29', { incomeYear: '2025-26' }),
    day('2026-06-30', { incomeYear: '2025-26' }),
    day('2026-06-26', { incomeYear: '2025-26', finishConfirmed: true }),
  ];

  beforeEach(() => {
    setWork({ clock: EARLY, settings: { ...SETTINGS, trackingStartDate: null } });
    setYear('2026-27', []);
    setYear('2025-26', PREVIOUS);
  });

  it('subscribes to the previous income year as well', () => {
    renderTab();
    expect(useWorkDays).toHaveBeenCalledWith('mike', '2026-27');
    expect(useWorkDays).toHaveBeenCalledWith('mike', '2025-26');
  });

  it('adds the previous year’s days to confirm to the banner', () => {
    renderTab();
    expect(screen.getByText('2 days to confirm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mon 29 Jun' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tue 30 Jun' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fri 26 Jun' })).toBeNull();
  });

  it('lists the days to confirm in date order, previous year first', () => {
    setYear('2026-27', [day('2026-07-02'), day('2026-07-03', { finishConfirmed: true })]);
    renderTab();
    const group = screen.getByText('3 days to confirm').closest('div') as HTMLElement;
    expect(within(group).getAllByRole('button').map((chip) => chip.textContent)).toEqual([
      'Mon 29 Jun',
      'Tue 30 Jun',
      'Thu 2 Jul',
    ]);
  });

  it('opens a previous-year day with its record', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Tue 30 Jun' }));
    expect(within(sheet()).getByRole('heading', { name: 'Tue 30 Jun' })).toBeInTheDocument();
    const editor = within(sheet()).getByTestId('day-editor');
    expect(editor).toHaveAttribute('data-date', '2026-06-30');
    expect(editor).toHaveAttribute('data-existing', '2026-06-30');
  });

  it('opens a current-year day with its record when both years have days', () => {
    setYear('2026-27', [day('2026-07-02')]);
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 2 Jul' }));
    expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-existing', '2026-07-02');
  });

  it('keeps the missing weekdays to the current income year', () => {
    // Tracking began in June, but the scan stops at 1 July: Wed 1, Thu 2 and Fri 3 July.
    setWork({ clock: EARLY, settings: { ...SETTINGS, trackingStartDate: '2026-06-01' } });
    renderTab();
    const missing = screen.getByText('3 weekdays not filled in').closest('div') as HTMLElement;
    expect(within(missing).getAllByRole('button').map((chip) => chip.textContent)).toEqual([
      'Wed 1 Jul',
      'Thu 2 Jul',
      'Fri 3 Jul',
    ]);
    // The two unconfirmed June days are in the other group.
    expect(screen.getByText('2 days to confirm')).toBeInTheDocument();
  });

  it('shows the current income year’s figures only', () => {
    setYear('2026-27', [day('2026-07-02', { finishConfirmed: true })]);
    renderTab();
    expect(screen.getByRole('heading', { name: 'Income year 2026–27 so far' })).toBeInTheDocument();
    expect(screen.getByText('7.6 h')).toBeInTheDocument();
    expect(screen.getByText('from home · 1 day')).toBeInTheDocument();
  });

  // A sheet opened from the banner on 14 July can still be open when the clock
  // reaches 15 July; its editor must keep the record it was opened with.
  it('keeps the previous year while one of its days is open past the window', () => {
    setWork({ clock: { today: '2026-07-14', nowMinutes: 540 }, settings: { ...SETTINGS, trackingStartDate: null } });
    const { rerender } = renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Tue 30 Jun' }));

    setWork({ clock: { today: '2026-07-15', nowMinutes: 540 }, settings: { ...SETTINGS, trackingStartDate: null } });
    vi.mocked(useWorkDays).mockClear();
    rerender(
      <MemoryRouter>
        <TodayTab />
      </MemoryRouter>,
    );

    expect(useWorkDays).toHaveBeenCalledWith('mike', '2025-26');
    const editor = within(sheet()).getByTestId('day-editor');
    expect(editor).toHaveAttribute('data-date', '2026-06-30');
    expect(editor).toHaveAttribute('data-existing', '2026-06-30');
    // The banner has stopped looking back all the same.
    expect(screen.queryByRole('button', { name: 'Mon 29 Jun' })).toBeNull();

    // Closing the sheet lets the previous year go.
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(useWorkDays).toHaveBeenLastCalledWith(undefined, '2025-26');
  });

  it('does not reach back to the previous year for a current-year day open past the window', () => {
    setWork({ clock: { today: '2026-07-20', nowMinutes: 540 }, settings: { ...SETTINGS, trackingStartDate: null } });
    setYear('2026-27', [day('2026-07-02')]);
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Thu 2 Jul' }));

    expect(within(sheet()).getByTestId('day-editor')).toHaveAttribute('data-existing', '2026-07-02');
    expect(useWorkDays).toHaveBeenLastCalledWith(undefined, '2025-26');
    expect(useWorkDays).not.toHaveBeenCalledWith('mike', '2025-26');
  });

  // The first 14 days of the income year, 1 to 14 July, and not a day more.
  it.each([
    ['2026-07-01', '2026-27', '2025-26', true],
    ['2026-07-14', '2026-27', '2025-26', true],
    ['2026-07-15', '2026-27', '2025-26', false],
    ['2027-06-30', '2026-27', '2025-26', false],
    ['2027-07-14', '2027-28', '2026-27', true],
  ])('on %s (income year %s) subscribes to %s: %s', (today, year, previous, subscribed) => {
    setWork({ clock: { today, nowMinutes: 540 } });
    renderTab();
    expect(useWorkDays).toHaveBeenCalledWith('mike', year);
    expect(useWorkDays).toHaveBeenCalledWith(subscribed ? 'mike' : undefined, previous);
    if (!subscribed) expect(useWorkDays).not.toHaveBeenCalledWith('mike', previous);
  });
});

describe('TodayTab outside the early window', () => {
  it('passes no uid for the previous year, so nothing from it appears', () => {
    setYear('2025-26', [day('2026-06-30', { incomeYear: '2025-26' })]);
    renderTab();
    expect(useWorkDays).toHaveBeenCalledWith('mike', '2026-27');
    expect(useWorkDays).toHaveBeenCalledWith(undefined, '2025-26');
    expect(useWorkDays).not.toHaveBeenCalledWith('mike', '2025-26');
    expect(screen.queryByRole('button', { name: 'Tue 30 Jun' })).toBeNull();
    // Only Wed 14 Oct, from this year, is to confirm.
    expect(screen.getByText('1 day to confirm')).toBeInTheDocument();
  });

  it('ignores previous-year days still held for a render after the window has passed', () => {
    state.stale = true;
    setYear('2025-26', [day('2026-06-30', { incomeYear: '2025-26' })]);
    renderTab();
    expect(screen.queryByRole('button', { name: 'Tue 30 Jun' })).toBeNull();
    expect(screen.getByText('1 day to confirm')).toBeInTheDocument();
  });
});
