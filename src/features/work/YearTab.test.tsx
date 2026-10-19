import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useWorkDays } from '../../hooks/useWorkDays';
import { downloadCsv } from '../../lib/work/downloadCsv';
import { makeWorkDay, WORK_SETTINGS } from '../../test/fixtures';
import YearTab from './YearTab';

const state = vi.hoisted(() => ({
  work: null as unknown,
  byYear: {} as Record<string, { days: unknown[]; loading: boolean; error: boolean }>,
}));

const NO_DAYS = vi.hoisted(() => ({ days: [] as unknown[], loading: false, error: false }));
vi.mock('../../hooks/useWorkDays', () => ({
  useWorkDays: vi.fn((uid: string | undefined, year: string) => (uid ? (state.byYear[year] ?? NO_DAYS) : NO_DAYS)),
}));
vi.mock('./WorkContext', () => ({ useWork: () => state.work }));
vi.mock('../../hooks/useMediaQuery', () => ({ useIsDesktop: () => true }));
vi.mock('../../lib/work/downloadCsv', () => ({ downloadCsv: vi.fn() }));
vi.mock('../../lib/work/workWrite', () => ({ writeWorkDay: vi.fn(), saveWorkSettings: vi.fn() }));
vi.mock('./DayEditor', () => ({
  default: ({ date, existing }: { date: string; existing: { date: string } | null }) => (
    <div data-testid="day-editor" data-date={date} data-existing={existing?.date ?? ''} />
  ),
}));

const CLOCK = { today: '2026-10-19', nowMinutes: 540 };

const HOME = makeWorkDay('2026-10-12');
const LATE = makeWorkDay('2026-10-13', { addedLater: true, countedInClaim: false });
const UNCONFIRMED = makeWorkDay('2026-10-14', { finishConfirmed: false });

function renderTab(hash = '') {
  return render(
    <MemoryRouter initialEntries={[`/work/year${hash}`]}>
      <YearTab />
    </MemoryRouter>,
  );
}

const scrollIntoView = vi.fn();

beforeEach(() => {
  state.work = { uid: 'mike', settings: WORK_SETTINGS, settingsLoading: false, settingsLoaded: true, clock: CLOCK };
  state.byYear = { '2026-27': { days: [HOME, LATE, UNCONFIRMED], loading: false, error: false } };
  vi.mocked(useWorkDays).mockClear();
  vi.mocked(downloadCsv).mockReset();
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  // jsdom has no scrollIntoView of its own.
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

describe('YearTab', () => {
  it('opens on the current income year', () => {
    renderTab();
    expect(screen.getByRole('heading', { level: 2, name: '2026–27' })).toBeInTheDocument();
    expect(useWorkDays).toHaveBeenLastCalledWith('mike', '2026-27');
  });

  it('steps back a year and does not step past the current one', () => {
    renderTab();
    expect(screen.getByRole('button', { name: 'Next income year' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Previous income year' }));
    expect(screen.getByRole('heading', { level: 2, name: '2025–26' })).toBeInTheDocument();
    expect(useWorkDays).toHaveBeenLastCalledWith('mike', '2025-26');
    expect(screen.getByRole('button', { name: 'Next income year' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next income year' }));
    expect(screen.getByRole('heading', { level: 2, name: '2026–27' })).toBeInTheDocument();
  });

  it('does not step back before 2020–21, the first year with a fixed rate', () => {
    renderTab();
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByRole('button', { name: 'Previous income year' }));
    expect(screen.getByRole('heading', { level: 2, name: '2020–21' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous income year' })).toBeDisabled();
  });

  it('heads the card of a past year without "so far"', () => {
    renderTab();
    expect(screen.getByRole('heading', { name: 'Income year 2026–27 so far' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous income year' }));
    expect(screen.getByRole('heading', { name: 'Income year 2025–26' })).toBeInTheDocument();
  });

  it('says a year has no days in place of the totals', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Previous income year' }));
    expect(screen.getByText('No days recorded in 2025–26.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Totals per month' })).toBeNull();
  });

  it('shows the year card, the totals, both reviews and the export, in that order', () => {
    renderTab();
    const order = [
      screen.getByRole('heading', { name: 'Income year 2026–27 so far' }),
      screen.getByRole('table', { name: 'Totals per month' }),
      screen.getByRole('region', { name: 'Added later' }),
      screen.getByRole('region', { name: 'Not confirmed' }),
      screen.getByRole('region', { name: 'Export' }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('heads the card with the chosen year and leaves out its links to this tab', () => {
    renderTab();
    expect(screen.queryByRole('link', { name: 'Include ›' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Review ›' })).toBeNull();
  });

  it('downloads the days file', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Download days (CSV)' }));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [name, csv] = vi.mocked(downloadCsv).mock.calls[0];
    expect(name).toBe('work-days-2026-27.csv');
    expect(csv.startsWith('date,weekday,type')).toBe(true);
    expect(csv).toContain('2026-10-12,Mon,home');
  });

  it('downloads the changes file', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Download changes (CSV)' }));
    const [name, csv] = vi.mocked(downloadCsv).mock.calls[0];
    expect(name).toBe('work-revisions-2026-27.csv');
    expect(csv.startsWith('date,revised_at,kind')).toBe(true);
  });

  it('downloads an empty year too', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Previous income year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download days (CSV)' }));
    expect(vi.mocked(downloadCsv).mock.calls[0][0]).toBe('work-days-2025-26.csv');
  });

  it('opens an unconfirmed day to edit it', () => {
    renderTab();
    const review = screen.getByRole('region', { name: 'Not confirmed' });
    fireEvent.click(within(review).getByRole('button', { name: 'Edit' }));
    const editor = screen.getByTestId('day-editor');
    expect(editor).toHaveAttribute('data-date', '2026-10-14');
    expect(editor).toHaveAttribute('data-existing', '2026-10-14');
  });

  it('scrolls to the review named in the address', () => {
    renderTab('#late');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('late'));
  });

  it('scrolls once the days have loaded', () => {
    state.byYear['2026-27'] = { days: [], loading: true, error: false };
    const { rerender } = renderTab('#confirm');
    expect(scrollIntoView).not.toHaveBeenCalled();

    state.byYear['2026-27'] = { days: [HOME, LATE, UNCONFIRMED], loading: false, error: false };
    act(() => {
      rerender(
        <MemoryRouter initialEntries={['/work/year#confirm']}>
          <YearTab />
        </MemoryRouter>,
      );
    });
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('confirm'));
  });

  it('shows a loading state and no export while the days load', () => {
    state.byYear['2026-27'] = { days: [], loading: true, error: false };
    renderTab();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download days (CSV)' })).toBeNull();
  });

  it('says the days failed to load, with no totals and no export', () => {
    state.byYear['2026-27'] = { days: [], loading: false, error: true };
    renderTab();
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your Work days.");
    expect(screen.queryByText(/No days recorded/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download days (CSV)' })).toBeNull();
  });
});
