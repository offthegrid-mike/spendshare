import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Timestamp } from 'firebase/firestore';
import type { WorkDayDoc, WorkSettingsDoc } from '../../types/models';
import type { Clock } from '../../lib/work/workDates';
import { DEFAULT_WORK_SETTINGS } from '../../lib/work/workSettings';
import { writeWorkDay } from '../../lib/work/workWrite';
import DayEditor from './DayEditor';

vi.mock('../../lib/work/workWrite', () => ({ writeWorkDay: vi.fn() }));
const write = vi.mocked(writeWorkDay);

const TODAY = '2026-10-19';
const PAST = '2026-10-15';
const FUTURE = '2026-10-20';
const CLOCK: Clock = { today: TODAY, nowMinutes: 18 * 60 }; // 18:00, after a 16:06 finish
const SETTINGS: WorkSettingsDoc = { ...DEFAULT_WORK_SETTINGS, defaultMinutes: 456 };

const LATE_NOTICE =
  "You're filling this in after the day. It will be saved as added later and stays out of the claim until you include it.";
const WRITE_FAILED = "Couldn't save the day. Try again.";

// A Home day recorded on the day, 08:30 to 16:06: counted and not yet confirmed.
function day(overrides: Partial<WorkDayDoc> = {}): WorkDayDoc {
  return {
    date: TODAY,
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

// An Office, Leave or cleared day as Firestore stores it: no times and not in the claim.
function dayWithoutTimes(type: 'office' | 'leave' | null, overrides: Partial<WorkDayDoc> = {}): WorkDayDoc {
  const doc = day({ type, countedInClaim: false, ...overrides });
  delete doc.startTime;
  delete doc.finishTime;
  delete doc.minutes;
  return doc;
}

function renderEditor(props: Partial<ComponentProps<typeof DayEditor>> = {}) {
  const onSaved = vi.fn();
  const editor = (next: Partial<ComponentProps<typeof DayEditor>>) => (
    <DayEditor
      uid="u1"
      date={TODAY}
      existing={null}
      settings={SETTINGS}
      settingsLoaded
      daysLoaded
      clock={CLOCK}
      onSaved={onSaved}
      {...props}
      {...next}
    />
  );
  const view = render(editor({}));
  // The same editor with some props changed, as when a snapshot brings a new record.
  const rerender = (next: Partial<ComponentProps<typeof DayEditor>>) => view.rerender(editor(next));
  return { onSaved, rerender };
}

/** A write that stays pending until the test settles it. */
function deferredWrite() {
  let reject: (error: Error) => void = () => {};
  write.mockReturnValue(
    new Promise<void>((_, rejectWrite) => {
      reject = rejectWrite;
    }),
  );
  return { reject: (error: Error) => reject(error) };
}

function field(name: 'Start' | 'Finish' | 'Hours'): HTMLInputElement {
  return screen.getByLabelText(name);
}

function type(name: 'Start' | 'Finish' | 'Hours', value: string) {
  fireEvent.change(field(name), { target: { value } });
}

function button(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name });
}

beforeEach(() => {
  write.mockReset();
  write.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DayEditor', () => {
  describe('layout', () => {
    // At phone widths three columns clip a 12-hour time ("04:45 PM" shows as "04:4"),
    // so Start and Finish share a row and Hours takes the row below until the sm breakpoint.
    it('puts Hours on its own row below Start and Finish on narrow screens', () => {
      renderEditor();
      const start = field('Start').parentElement!;
      const finish = field('Finish').parentElement!;
      const hours = field('Hours').parentElement!;
      const grid = start.parentElement!;

      expect(grid).toHaveClass('grid', 'grid-cols-2', 'sm:grid-cols-3');
      expect(grid).not.toHaveClass('grid-cols-3');
      expect(finish.parentElement).toBe(grid);
      expect(hours.parentElement).toBe(grid);
      expect(hours).toHaveClass('col-span-2', 'sm:col-span-1');
      expect(start).not.toHaveClass('col-span-2');
      expect(finish).not.toHaveClass('col-span-2');
    });
  });

  describe('times', () => {
    it('fills the finish and the hours from a typed start', () => {
      renderEditor();
      expect(field('Start')).toHaveAttribute('type', 'time');
      expect(field('Finish')).toHaveAttribute('type', 'time');
      expect(field('Hours')).toHaveAttribute('inputmode', 'decimal');

      type('Start', '08:30');

      expect(field('Finish')).toHaveValue('16:06');
      expect(field('Hours')).toHaveValue('7.6');
    });

    it('moves the finish when the hours are typed', () => {
      renderEditor();
      type('Start', '08:30');
      type('Hours', '8');

      expect(field('Finish')).toHaveValue('16:30');
      expect(field('Hours')).toHaveValue('8');
    });

    it('keeps a partial hours entry while it is typed and tidies it when the field is left', () => {
      renderEditor();
      type('Start', '08:30');
      type('Hours', '7.');

      expect(field('Hours')).toHaveValue('7.');
      expect(field('Finish')).toHaveValue('15:30');

      fireEvent.blur(field('Hours'));
      expect(field('Hours')).toHaveValue('7.0');
    });

    it('leaves the hours alone for text that is not a number', () => {
      renderEditor();
      type('Start', '08:30');
      type('Hours', 'abc');

      expect(field('Finish')).toHaveValue('16:06');
      fireEvent.blur(field('Hours'));
      expect(field('Hours')).toHaveValue('7.6');
    });

    it('shows the hours a new finish gives, even while typed hours text is kept', () => {
      renderEditor();
      type('Start', '08:30');
      type('Hours', '7.');
      type('Finish', '17:00');

      expect(field('Hours')).toHaveValue('8.5');
    });

    it('rounds typed hours to whole minutes', async () => {
      const { onSaved } = renderEditor();
      type('Start', '08:30');
      type('Hours', '7.62');
      fireEvent.click(button('Save today'));

      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(write).toHaveBeenCalledWith(
        'u1',
        TODAY,
        { kind: 'save', type: 'home', startTime: '08:30', finishTime: '16:07', minutes: 457 },
        null,
        SETTINGS,
      );
    });

    it('asks for a start time on a blank day and will not save it', () => {
      renderEditor();

      expect(screen.getByText('Enter a start time')).toBeInTheDocument();
      expect(button('Save today')).toBeDisabled();
    });

    it('asks for a finish time when the day would run past midnight and will not save it', () => {
      renderEditor();
      type('Start', '20:00');

      expect(screen.getByText('Enter a finish time')).toBeInTheDocument();
      expect(button('Save today')).toBeDisabled();
      fireEvent.click(button('Save today'));
      expect(write).not.toHaveBeenCalled();
    });

    it('asks for the finish to be after the start and will not save it', () => {
      renderEditor();
      type('Start', '08:30');
      type('Finish', '08:00');

      expect(screen.getByText('Finish must be after start')).toBeInTheDocument();
      expect(button('Save today')).toBeDisabled();
    });
  });

  describe('saving', () => {
    it('saves a new Home day once and then calls onSaved', async () => {
      const { onSaved } = renderEditor();
      type('Start', '08:30');
      fireEvent.click(button('Save today'));

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith(
        'u1',
        TODAY,
        { kind: 'save', type: 'home', startTime: '08:30', finishTime: '16:06', minutes: 456 },
        null,
        SETTINGS,
      );
    });

    it('hides the times for Office and saves the type alone', async () => {
      const { onSaved } = renderEditor();
      fireEvent.click(button('Office'));

      expect(button('Office')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Finish')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Hours')).not.toBeInTheDocument();

      fireEvent.click(button('Save today'));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(write).toHaveBeenCalledWith('u1', TODAY, { kind: 'save', type: 'office' }, null, SETTINGS);
    });

    it('labels the type choice as Day type', () => {
      renderEditor();
      expect(screen.getByRole('group', { name: 'Day type' })).toBeInTheDocument();
    });

    it('passes no settings while they have not loaded', async () => {
      const { onSaved } = renderEditor({ settingsLoaded: false });
      type('Start', '08:30');
      fireEvent.click(button('Save today'));

      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(write).toHaveBeenCalledWith('u1', TODAY, expect.objectContaining({ kind: 'save' }), null, null);
    });

    it('shows the save in progress and blocks a second one', () => {
      write.mockReturnValue(new Promise(() => {}));
      renderEditor();
      type('Start', '08:30');
      fireEvent.click(button('Save today'));

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(button('Save today')).toBeDisabled();
      fireEvent.click(button('Save today'));
      expect(write).toHaveBeenCalledTimes(1);
    });

    it('shows an error for a failed write, re-enables the button and stays open', async () => {
      write.mockRejectedValue(new Error('permission-denied'));
      const { onSaved } = renderEditor();
      type('Start', '08:30');
      fireEvent.click(button('Save today'));

      expect(await screen.findByRole('alert')).toHaveTextContent(WRITE_FAILED);
      expect(button('Save today')).toBeEnabled();
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('shows the same error for a write that throws before it starts', async () => {
      write.mockImplementation(() => {
        throw new Error('Finish and hours do not agree');
      });
      const { onSaved } = renderEditor();
      type('Start', '08:30');
      fireEvent.click(button('Save today'));

      expect(await screen.findByRole('alert')).toHaveTextContent(WRITE_FAILED);
      expect(button('Save today')).toBeEnabled();
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('drops the error once the form is edited', async () => {
      write.mockRejectedValue(new Error('permission-denied'));
      renderEditor();
      type('Start', '08:30');
      fireEvent.click(button('Save today'));
      await screen.findByRole('alert');

      type('Finish', '17:00');
      expect(screen.queryByText(WRITE_FAILED)).not.toBeInTheDocument();
    });

    it('does not wait for the server while offline', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      write.mockReturnValue(new Promise(() => {})); // never acknowledged offline
      const { onSaved } = renderEditor();
      type('Start', '08:30');
      fireEvent.click(button('Save today'));

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(button('Save today')).toBeEnabled();
    });
  });

  describe('button and late notice', () => {
    it('reads Save today for today, with no late notice', () => {
      renderEditor();
      type('Start', '08:30');

      expect(button('Save today')).toBeEnabled();
      expect(screen.queryByText(LATE_NOTICE)).not.toBeInTheDocument();
    });

    it('reads Save day for a past day and shows the late notice', () => {
      renderEditor({ date: PAST });
      expect(screen.getByText(LATE_NOTICE)).toBeInTheDocument();

      type('Start', '08:30');
      expect(button('Save day')).toBeEnabled();
      expect(screen.getByText(LATE_NOTICE)).toBeInTheDocument();
    });

    it('offers nothing for a future day', () => {
      renderEditor({ date: FUTURE });

      expect(screen.getByText("Future days can't be recorded.")).toBeInTheDocument();
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
    });

    it('reads Update day for a recorded day and stays disabled until something changes', () => {
      const existing = day();
      renderEditor({ existing });

      expect(field('Start')).toHaveValue('08:30');
      expect(button('Update day')).toBeDisabled();
      fireEvent.click(button('Update day'));
      expect(write).not.toHaveBeenCalled();

      type('Finish', '16:30');
      expect(button('Update day')).toBeEnabled();
    });

    it('updates a recorded day with the existing document', async () => {
      const existing = day();
      const { onSaved } = renderEditor({ existing });
      type('Finish', '16:30');
      fireEvent.click(button('Update day'));

      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(write).toHaveBeenCalledWith(
        'u1',
        TODAY,
        { kind: 'save', type: 'home', startTime: '08:30', finishTime: '16:30', minutes: 480 },
        existing,
        SETTINGS,
      );
    });

    it('opens an Office day on Office, unchanged', () => {
      renderEditor({ existing: dayWithoutTimes('office') });

      expect(button('Office')).toHaveAttribute('aria-pressed', 'true');
      expect(button('Update day')).toBeDisabled();
    });

    it('shows the late notice for a past day only once the form would change it', () => {
      renderEditor({ date: PAST, existing: day({ date: PAST }) });
      expect(screen.queryByText(LATE_NOTICE)).not.toBeInTheDocument();

      type('Finish', '16:30');
      expect(screen.getByText(LATE_NOTICE)).toBeInTheDocument();
    });

    it('shows the late notice when a past Office day is switched to Leave', () => {
      renderEditor({ date: PAST, existing: dayWithoutTimes('office', { date: PAST }) });
      expect(screen.queryByText(LATE_NOTICE)).not.toBeInTheDocument();

      fireEvent.click(button('Leave'));
      expect(screen.getByText(LATE_NOTICE)).toBeInTheDocument();
    });

    it('reads Save day for a cleared past day and Save today for a cleared today', () => {
      const { rerender } = renderEditor({ date: PAST, existing: dayWithoutTimes(null, { date: PAST }) });
      expect(button('Save day')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Update day' })).not.toBeInTheDocument();

      rerender({ date: TODAY, existing: dayWithoutTimes(null) });
      expect(button('Save today')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Update day' })).not.toBeInTheDocument();
    });
  });

  // The editor outlives a record: another device edits the day, or this device's
  // own write lands after the editor was shown. Each snapshot brings new objects.
  describe('when the record changes', () => {
    it('refills an unedited form, so Confirm finish sends the new finish and hours', async () => {
      const { onSaved, rerender } = renderEditor({ existing: day() });
      expect(field('Finish')).toHaveValue('16:06');

      // The laptop moves the finish to 17:00.
      const edited = day({ finishTime: '17:00', minutes: 510 });
      rerender({ existing: edited });
      expect(field('Start')).toHaveValue('08:30');
      expect(field('Finish')).toHaveValue('17:00');
      expect(field('Hours')).toHaveValue('8.5');
      expect(button('Update day')).toBeDisabled();

      fireEvent.click(button('Confirm finish'));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(write).toHaveBeenCalledWith(
        'u1',
        TODAY,
        { kind: 'confirm', finishTime: '17:00', minutes: 510 },
        edited,
        SETTINGS,
      );
    });

    it('blanks the form once a cleared day arrives, offering Save today and no Clear day', async () => {
      const { onSaved, rerender } = renderEditor({ existing: day() });
      fireEvent.click(button('Clear day'));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());

      rerender({ existing: dayWithoutTimes(null) });
      expect(field('Start')).toHaveValue('');
      expect(field('Finish')).toHaveValue('');
      expect(button('Save today')).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Update day' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear day' })).not.toBeInTheDocument();
    });

    it('refills the type as well, for a day switched to Office elsewhere', () => {
      const { rerender } = renderEditor({ existing: day() });
      rerender({ existing: dayWithoutTimes('office') });

      expect(button('Office')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
      expect(button('Update day')).toBeDisabled();
    });

    it('keeps an edited form', () => {
      const { rerender } = renderEditor({ existing: day() });
      type('Finish', '16:30');

      rerender({ existing: day({ finishTime: '17:00', minutes: 510 }) });
      expect(field('Finish')).toHaveValue('16:30');
      expect(field('Hours')).toHaveValue('8.0');
      expect(button('Update day')).toBeEnabled();
    });

    it('updates an edited form over the record it now has', async () => {
      const { onSaved, rerender } = renderEditor({ existing: day() });
      type('Finish', '16:30');
      const edited = day({ finishTime: '17:00', minutes: 510 });
      rerender({ existing: edited });

      fireEvent.click(button('Update day'));
      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(write).toHaveBeenCalledWith(
        'u1',
        TODAY,
        { kind: 'save', type: 'home', startTime: '08:30', finishTime: '16:30', minutes: 480 },
        edited,
        SETTINGS,
      );
    });

    it('changes nothing for a new record with the same values', () => {
      const { rerender } = renderEditor({ existing: day() });
      // The same hours typed another way: the form is unchanged, the text is kept.
      type('Hours', '7.60');

      rerender({ existing: day() });
      expect(field('Hours')).toHaveValue('7.60');
      expect(field('Finish')).toHaveValue('16:06');
    });

    it('follows the record again once an edit has been put back', () => {
      const { rerender } = renderEditor({ existing: day() });
      type('Finish', '16:30');
      type('Finish', '16:06');

      rerender({ existing: day({ finishTime: '17:00', minutes: 510 }) });
      expect(field('Finish')).toHaveValue('17:00');
    });

    it('keeps the typed values and shows the error when a pending save is rejected', async () => {
      const pending = deferredWrite();
      const { onSaved, rerender } = renderEditor({ existing: day() });
      type('Finish', '17:00');
      fireEvent.click(button('Update day'));

      // While the write is pending its local snapshot lands, and is then rolled back.
      rerender({ existing: day({ finishTime: '17:00', minutes: 510 }) });
      rerender({ existing: day() });
      await act(async () => pending.reject(new Error('permission-denied')));

      expect(await screen.findByRole('alert')).toHaveTextContent(WRITE_FAILED);
      expect(field('Finish')).toHaveValue('17:00');
      expect(field('Hours')).toHaveValue('8.5');
      expect(button('Update day')).toBeEnabled();
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('keeps the typed values when the rejection comes before the record is rolled back', async () => {
      const pending = deferredWrite();
      const { rerender } = renderEditor({ existing: day() });
      type('Finish', '17:00');
      fireEvent.click(button('Update day'));

      rerender({ existing: day({ finishTime: '17:00', minutes: 510 }) });
      await act(async () => pending.reject(new Error('permission-denied')));
      expect(await screen.findByRole('alert')).toHaveTextContent(WRITE_FAILED);
      rerender({ existing: day() });

      expect(field('Finish')).toHaveValue('17:00');
      expect(field('Hours')).toHaveValue('8.5');
      expect(screen.getByRole('alert')).toHaveTextContent(WRITE_FAILED);
    });

    it('still refills a form with no edits after a rejected write', async () => {
      write.mockRejectedValue(new Error('permission-denied'));
      const { rerender } = renderEditor({ existing: day() });
      fireEvent.click(button('Clear day'));
      await screen.findByRole('alert');

      rerender({ existing: day({ finishTime: '17:00', minutes: 510 }) });
      expect(field('Finish')).toHaveValue('17:00');
      expect(field('Hours')).toHaveValue('8.5');
    });

    // Switching type keeps the Home times in the form, hidden; an Office or Leave
    // record has none. The hidden times must not leave the form counted as edited.
    describe('after a Home day is saved as another type', () => {
      async function saveHomeDayAs(name: 'Office' | 'Leave') {
        const view = renderEditor({ existing: day() });
        fireEvent.click(button(name));
        fireEvent.click(button('Update day'));
        await waitFor(() => expect(view.onSaved).toHaveBeenCalledTimes(1));
        view.rerender({ existing: dayWithoutTimes(name === 'Office' ? 'office' : 'leave') });
        return view;
      }

      it('blanks the form when the day is then cleared', async () => {
        const { onSaved, rerender } = await saveHomeDayAs('Office');
        expect(button('Update day')).toBeDisabled();
        fireEvent.click(button('Clear day'));
        await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2));

        rerender({ existing: dayWithoutTimes(null) });
        expect(button('Home')).toHaveAttribute('aria-pressed', 'true');
        expect(field('Start')).toHaveValue('');
        expect(button('Save today')).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Clear day' })).not.toBeInTheDocument();
      });

      it('follows another device making it a Home day again', async () => {
        const { rerender } = await saveHomeDayAs('Office');

        rerender({ existing: day({ finishTime: '17:00', minutes: 510 }) });
        expect(button('Home')).toHaveAttribute('aria-pressed', 'true');
        expect(field('Start')).toHaveValue('08:30');
        expect(field('Finish')).toHaveValue('17:00');
        expect(button('Update day')).toBeDisabled();
      });

      it('does the same for Leave', async () => {
        const { rerender } = await saveHomeDayAs('Leave');
        expect(button('Update day')).toBeDisabled();

        rerender({ existing: day({ finishTime: '17:00', minutes: 510 }) });
        expect(button('Home')).toHaveAttribute('aria-pressed', 'true');
        expect(field('Finish')).toHaveValue('17:00');
        expect(button('Update day')).toBeDisabled();
      });

      it('does the same for a new day whose times were typed before the switch', async () => {
        const { onSaved, rerender } = renderEditor();
        type('Start', '08:30');
        fireEvent.click(button('Office'));
        fireEvent.click(button('Save today'));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        rerender({ existing: dayWithoutTimes('office') });
        expect(button('Update day')).toBeDisabled();

        rerender({ existing: day({ finishTime: '17:00', minutes: 510 }) });
        expect(button('Home')).toHaveAttribute('aria-pressed', 'true');
        expect(field('Finish')).toHaveValue('17:00');
        expect(button('Update day')).toBeDisabled();
      });

      it('keeps an Office switch whose save is rejected after its snapshot, over the rollback', async () => {
        const pending = deferredWrite();
        const { rerender } = renderEditor({ existing: day() });
        fireEvent.click(button('Office'));
        fireEvent.click(button('Update day'));

        rerender({ existing: dayWithoutTimes('office') });
        await act(async () => pending.reject(new Error('permission-denied')));
        expect(await screen.findByRole('alert')).toHaveTextContent(WRITE_FAILED);
        rerender({ existing: day() });

        expect(button('Office')).toHaveAttribute('aria-pressed', 'true');
        expect(button('Update day')).toBeEnabled();
        expect(screen.getByRole('alert')).toHaveTextContent(WRITE_FAILED);
      });
    });
  });

  describe('clear', () => {
    it('clears a recorded day and then calls onSaved', async () => {
      const existing = day();
      const { onSaved } = renderEditor({ existing });
      fireEvent.click(button('Clear day'));

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith('u1', TODAY, { kind: 'save', type: null }, existing, SETTINGS);
    });

    it('is not offered for a day with no record', () => {
      renderEditor();
      expect(screen.queryByRole('button', { name: 'Clear day' })).not.toBeInTheDocument();
    });

    it('is not offered for a cleared day', () => {
      renderEditor({ existing: dayWithoutTimes(null) });
      expect(screen.queryByRole('button', { name: 'Clear day' })).not.toBeInTheDocument();
    });
  });

  describe('confirm finish', () => {
    it('confirms an unconfirmed past Home day as it is', async () => {
      const existing = day({ date: PAST });
      const { onSaved } = renderEditor({ date: PAST, existing });
      fireEvent.click(button('Confirm finish'));

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(write).toHaveBeenCalledWith(
        'u1',
        PAST,
        { kind: 'confirm', finishTime: '16:06', minutes: 456 },
        existing,
        SETTINGS,
      );
    });

    it('confirms today once the finish has passed, with a changed finish', async () => {
      const existing = day();
      const { onSaved } = renderEditor({ existing });
      type('Finish', '16:30');
      fireEvent.click(button('Confirm finish'));

      await waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(write).toHaveBeenCalledWith(
        'u1',
        TODAY,
        { kind: 'confirm', finishTime: '16:30', minutes: 480 },
        existing,
        SETTINGS,
      );
    });

    it('is not offered before the finish time', () => {
      renderEditor({ existing: day(), clock: { today: TODAY, nowMinutes: 9 * 60 } });

      expect(screen.queryByRole('button', { name: 'Confirm finish' })).not.toBeInTheDocument();
      expect(screen.queryByText('Finish confirmed')).not.toBeInTheDocument();
    });

    it('shows Finish confirmed for a confirmed day, with no button', () => {
      renderEditor({ existing: day({ finishConfirmed: true }) });

      expect(screen.getByText('Finish confirmed')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Confirm finish' })).not.toBeInTheDocument();
    });

    it('is disabled once the start differs from the saved one', () => {
      renderEditor({ existing: day() });
      type('Start', '09:00');

      expect(button('Confirm finish')).toBeDisabled();
      expect(button('Update day')).toBeEnabled();
    });

    it('is disabled while the form has an error', () => {
      renderEditor({ existing: day() });
      type('Finish', '08:00');

      expect(button('Confirm finish')).toBeDisabled();
    });

    it('is disabled while the form is set to another type', () => {
      renderEditor({ existing: day() });
      fireEvent.click(button('Office'));

      expect(button('Confirm finish')).toBeDisabled();
    });

    it('is not offered for an Office day', () => {
      renderEditor({ existing: dayWithoutTimes('office', { date: PAST }), date: PAST });
      expect(screen.queryByRole('button', { name: 'Confirm finish' })).not.toBeInTheDocument();
    });
  });

  describe('claim', () => {
    it('includes a late day that is out of the claim', async () => {
      const existing = day({ date: PAST, addedLater: true, countedInClaim: false });
      const { onSaved } = renderEditor({ date: PAST, existing });

      expect(screen.getByText('Not in the claim')).toBeInTheDocument();
      fireEvent.click(button('Include in claim'));

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(write).toHaveBeenCalledWith('u1', PAST, { kind: 'include' }, existing, SETTINGS);
    });

    it('excludes a late day that is in the claim', async () => {
      const existing = day({ date: PAST, addedLater: true, countedInClaim: true });
      const { onSaved } = renderEditor({ date: PAST, existing });

      expect(screen.getByText('Included in the claim')).toBeInTheDocument();
      fireEvent.click(button('Exclude'));

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(write).toHaveBeenCalledWith('u1', PAST, { kind: 'exclude' }, existing, SETTINGS);
    });

    it('shows neither for a day recorded on the day', () => {
      renderEditor({ date: PAST, existing: day({ date: PAST }) });

      expect(screen.queryByText('Not in the claim')).not.toBeInTheDocument();
      expect(screen.queryByText('Included in the claim')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Include in claim' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Exclude' })).not.toBeInTheDocument();
    });
  });

  describe('before the days have loaded', () => {
    it('disables save for a new day', () => {
      renderEditor({ daysLoaded: false });
      type('Start', '08:30');

      expect(button('Save today')).toBeDisabled();
    });

    it('disables update, clear, confirm and include', () => {
      const existing = day({ date: PAST, addedLater: true, countedInClaim: false });
      renderEditor({ date: PAST, existing, daysLoaded: false });
      type('Finish', '16:30');

      expect(button('Update day')).toBeDisabled();
      expect(button('Clear day')).toBeDisabled();
      expect(button('Confirm finish')).toBeDisabled();
      expect(button('Include in claim')).toBeDisabled();
    });

    it('disables exclude', () => {
      const existing = day({ date: PAST, addedLater: true, countedInClaim: true });
      renderEditor({ date: PAST, existing, daysLoaded: false });

      expect(button('Exclude')).toBeDisabled();
    });
  });
});
