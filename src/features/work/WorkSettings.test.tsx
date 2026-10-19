import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { WorkSettingsDoc } from '../../types/models';
import type { Clock } from '../../lib/work/workDates';
import { DEFAULT_WORK_SETTINGS } from '../../lib/work/workSettings';
import { saveWorkSettings } from '../../lib/work/workWrite';
import WorkSettings from './WorkSettings';

const state = vi.hoisted(() => ({ work: null as unknown }));

vi.mock('./WorkContext', () => ({ useWork: () => state.work }));
vi.mock('../../lib/work/workWrite', () => ({ saveWorkSettings: vi.fn() }));
// So the real AccountSection (Appearance and Sign out) renders.
vi.mock('../../lib/firebase', () => ({ auth: {} }));
vi.mock('../../lib/features', () => ({ DARK_MODE_ENABLED: true }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));

const CLOCK: Clock = { today: '2026-10-19', nowMinutes: 540 };
const WRITE_FAILED = "Couldn't save. Try again.";

function setWork(settings: Partial<WorkSettingsDoc> = {}, overrides: Record<string, unknown> = {}) {
  state.work = {
    uid: 'u1',
    settings: { ...DEFAULT_WORK_SETTINGS, ...settings },
    settingsLoading: false,
    settingsLoaded: true,
    clock: CLOCK,
    ...overrides,
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const save = vi.mocked(saveWorkSettings);

const daysSaveButton = () => screen.getByRole('button', { name: 'Save work days' });
const hoursSaveButton = () => screen.getByRole('button', { name: 'Save default hours' });
const hoursInput = () => screen.getByRole('textbox', { name: 'Default hours' });
const rateRow = (label: string) => within(screen.getByRole('group', { name: label }));
const rateInput = (label: string) => rateRow(label).getByRole('textbox', { name: 'Rate in cents per hour' });
const rateSaveButton = (label: string) => rateRow(label).getByRole('button', { name: 'Save rate' });
const checkbox = (name: string) => screen.getByRole('checkbox', { name });

function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

beforeEach(() => {
  setWork();
  save.mockReset();
  save.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WorkSettings', () => {
  describe('loading', () => {
    it('shows the loading skeleton and no sections while the settings load', () => {
      setWork({}, { settingsLoading: true, settingsLoaded: false });
      render(<WorkSettings />);
      expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save work days' })).toBeNull();
      expect(screen.queryByRole('heading', { name: 'Usual work days' })).toBeNull();
    });

    // After a listener error `settings` holds the defaults, and the work days and
    // default hours are saved as whole values, so saving from them could replace
    // the user's real ones. Nothing is editable until a real snapshot has arrived.
    describe('after a settings listener error', () => {
      beforeEach(() => {
        setWork({}, { settingsLoading: false, settingsLoaded: false });
      });

      it('says the settings could not be loaded', () => {
        render(<WorkSettings />);
        expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your Work settings.");
        expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
      });

      it('shows none of the editable sections', () => {
        render(<WorkSettings />);
        for (const name of ['Save work days', 'Save default hours', 'Save rate']) {
          expect(screen.queryByRole('button', { name })).toBeNull();
        }
        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(screen.queryByRole('textbox')).toBeNull();
        for (const name of ['Usual work days', 'Default hours', 'Rate per hour']) {
          expect(screen.queryByRole('heading', { name })).toBeNull();
        }
      });

      it('still shows the Appearance group and the Sign out button', () => {
        render(<WorkSettings />);
        expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
      });
    });

    it('shows no load error once the settings have loaded', () => {
      render(<WorkSettings />);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('has a heading for each section and no page heading', () => {
      render(<WorkSettings />);
      for (const name of ['Usual work days', 'Default hours', 'Rate per hour', 'Appearance', 'Account']) {
        expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
      }
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    });
  });

  describe('usual work days', () => {
    it('shows the seven weekday checkboxes, ticked for the saved work days', () => {
      render(<WorkSettings />);
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      expect(screen.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)).toEqual(days);
      for (const name of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) expect(checkbox(name)).toBeChecked();
      for (const name of ['Sat', 'Sun']) expect(checkbox(name)).not.toBeChecked();
    });

    it('saves the ticked days after ticking Saturday', () => {
      render(<WorkSettings />);
      fireEvent.click(checkbox('Sat'));
      fireEvent.click(daysSaveButton());
      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith('u1', { workWeekdays: [1, 2, 3, 4, 5, 6] });
    });

    it('saves the days in ascending order whatever order they were stored and ticked in', () => {
      setWork({ workWeekdays: [5, 3, 1] });
      render(<WorkSettings />);
      fireEvent.click(checkbox('Sun'));
      fireEvent.click(checkbox('Tue'));
      fireEvent.click(daysSaveButton());
      expect(save).toHaveBeenCalledWith('u1', { workWeekdays: [1, 2, 3, 5, 7] });
    });

    it('saves an unticked day as removed', () => {
      render(<WorkSettings />);
      fireEvent.click(checkbox('Wed'));
      fireEvent.click(daysSaveButton());
      expect(save).toHaveBeenCalledWith('u1', { workWeekdays: [1, 2, 4, 5] });
    });

    it('disables the save button when no day is ticked, and re-enables it when one is', () => {
      render(<WorkSettings />);
      for (const name of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) fireEvent.click(checkbox(name));
      expect(daysSaveButton()).toBeDisabled();
      fireEvent.click(checkbox('Sun'));
      expect(daysSaveButton()).toBeEnabled();
      fireEvent.click(daysSaveButton());
      expect(save).toHaveBeenCalledWith('u1', { workWeekdays: [7] });
    });

    it('ignores stored weekdays outside 1 to 7', () => {
      setWork({ workWeekdays: [0, 1, 9] });
      render(<WorkSettings />);
      fireEvent.click(checkbox('Tue'));
      fireEvent.click(daysSaveButton());
      expect(save).toHaveBeenCalledWith('u1', { workWeekdays: [1, 2] });
    });
  });

  describe('default hours', () => {
    it('shows the default hours as a decimal', () => {
      render(<WorkSettings />);
      expect(hoursInput()).toHaveValue('7.6');
      expect(hoursInput()).toHaveAttribute('inputmode', 'decimal');
    });

    it('shows a default that is not a tenth of an hour with two decimals', () => {
      setWork({ defaultMinutes: 457 });
      render(<WorkSettings />);
      expect(hoursInput()).toHaveValue('7.62');
    });

    it('saves 7.5 hours as 450 minutes', () => {
      render(<WorkSettings />);
      type(hoursInput(), '7.5');
      fireEvent.click(hoursSaveButton());
      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith('u1', { defaultMinutes: 450 });
    });

    it('saves the pre-filled hours as the stored minutes', () => {
      render(<WorkSettings />);
      fireEvent.click(hoursSaveButton());
      expect(save).toHaveBeenCalledWith('u1', { defaultMinutes: 456 });
    });

    it('trims the text, and accepts 24 hours as the most', async () => {
      render(<WorkSettings />);
      type(hoursInput(), ' 7.5 ');
      fireEvent.click(hoursSaveButton());
      expect(save).toHaveBeenLastCalledWith('u1', { defaultMinutes: 450 });
      await screen.findByText('Saved');
      type(hoursInput(), '24');
      fireEvent.click(hoursSaveButton());
      expect(save).toHaveBeenLastCalledWith('u1', { defaultMinutes: 1440 });
    });

    it('keeps a partial entry such as 7. while it is typed', () => {
      render(<WorkSettings />);
      type(hoursInput(), '7.');
      expect(hoursInput()).toHaveValue('7.');
      fireEvent.click(hoursSaveButton());
      expect(save).toHaveBeenCalledWith('u1', { defaultMinutes: 420 });
    });

    it.each(['0', '25', '', '   ', 'abc', '-1', '7,5', '1e1', '0x10', '0.001', '24.1'])(
      'disables the save button for %j hours',
      (text) => {
        render(<WorkSettings />);
        type(hoursInput(), text);
        expect(hoursSaveButton()).toBeDisabled();
        fireEvent.click(hoursSaveButton());
        expect(save).not.toHaveBeenCalled();
      },
    );
  });

  describe('rate per hour', () => {
    it('has a row for the current income year and the two before it, newest first', () => {
      render(<WorkSettings />);
      const rows = screen.getAllByRole('group', { name: /^\d{4}–\d{2}$/ });
      expect(rows.map((row) => within(row).getByText(/^\d{4}–\d{2}$/).textContent)).toEqual([
        '2026–27',
        '2025–26',
        '2024–25',
      ]);
    });

    it('follows the income year, which starts on 1 July', () => {
      setWork({}, { clock: { today: '2026-06-30', nowMinutes: 0 } });
      const { unmount } = render(<WorkSettings />);
      expect(screen.getByRole('group', { name: '2025–26' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: '2024–25' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: '2023–24' })).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: '2026–27' })).toBeNull();
      unmount();

      setWork({}, { clock: { today: '2026-07-01', nowMinutes: 0 } });
      render(<WorkSettings />);
      expect(screen.getByRole('group', { name: '2026–27' })).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: '2023–24' })).toBeNull();
    });

    it('pre-fills a year with no rate of its own from the carried rate, and says so', () => {
      render(<WorkSettings />);
      expect(rateInput('2026–27')).toHaveValue('70');
      expect(rateRow('2026–27').getByText('70c is the 2025–26 rate until you set one')).toBeInTheDocument();
      expect(rateRow('2026–27').getByText('c/h')).toBeInTheDocument();
    });

    it('pre-fills a known year with its rate and no note', () => {
      render(<WorkSettings />);
      expect(rateInput('2025–26')).toHaveValue('70');
      expect(rateInput('2024–25')).toHaveValue('70');
      expect(rateRow('2025–26').queryByText(/until you set one/)).toBeNull();
      expect(rateRow('2024–25').queryByText(/until you set one/)).toBeNull();
    });

    it('pre-fills a year with a stored rate from it, with no note', () => {
      setWork({ ratesCentsPerHour: { '2026-27': 72, '2025-26': 68 } });
      render(<WorkSettings />);
      expect(rateInput('2026–27')).toHaveValue('72');
      expect(rateInput('2025–26')).toHaveValue('68');
      expect(screen.queryByText(/until you set one/)).toBeNull();
    });

    it('saves 72 for 2026-27 from that row only', () => {
      render(<WorkSettings />);
      type(rateInput('2026–27'), '72');
      fireEvent.click(rateSaveButton('2026–27'));
      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith('u1', { ratesCentsPerHour: { '2026-27': 72 } });
    });

    it('saves another row under its own year, trimming the text', () => {
      render(<WorkSettings />);
      type(rateInput('2024–25'), ' 68 ');
      fireEvent.click(rateSaveButton('2024–25'));
      expect(save).toHaveBeenCalledWith('u1', { ratesCentsPerHour: { '2024-25': 68 } });
    });

    it('can save the pre-filled carried rate as the year\'s own rate', () => {
      render(<WorkSettings />);
      fireEvent.click(rateSaveButton('2026–27'));
      expect(save).toHaveBeenCalledWith('u1', { ratesCentsPerHour: { '2026-27': 70 } });
    });

    it.each(['', '   ', '0', '00', '-5', '70.5', '1e2', '+70', 'abc', '7 0', '99999999999999999999'])(
      'disables Save rate for %j cents',
      (text) => {
        render(<WorkSettings />);
        type(rateInput('2026–27'), text);
        expect(rateSaveButton('2026–27')).toBeDisabled();
        fireEvent.click(rateSaveButton('2026–27'));
        expect(save).not.toHaveBeenCalled();
      },
    );

    it('disables only the row with the bad entry', () => {
      render(<WorkSettings />);
      type(rateInput('2026–27'), '');
      expect(rateSaveButton('2026–27')).toBeDisabled();
      expect(rateSaveButton('2025–26')).toBeEnabled();
      expect(rateSaveButton('2024–25')).toBeEnabled();
    });
  });

  describe('account', () => {
    it('shows the Appearance group and the Sign out button', () => {
      render(<WorkSettings />);
      expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    });
  });

  describe('saving', () => {
    it('shows Saved after a successful save, and clears it when the section is edited again', async () => {
      render(<WorkSettings />);
      expect(screen.queryByText('Saved')).toBeNull();
      fireEvent.click(checkbox('Sat'));
      fireEvent.click(daysSaveButton());
      expect(await screen.findByText('Saved')).toHaveAttribute('role', 'status');
      expect(screen.getAllByText('Saved')).toHaveLength(1);
      expect(daysSaveButton()).toBeEnabled();
      fireEvent.click(checkbox('Sun'));
      expect(screen.queryByText('Saved')).toBeNull();
    });

    it('shows Saved for default hours and clears it on the next edit', async () => {
      render(<WorkSettings />);
      type(hoursInput(), '7.5');
      fireEvent.click(hoursSaveButton());
      expect(await screen.findByText('Saved')).toBeInTheDocument();
      type(hoursInput(), '7.4');
      expect(screen.queryByText('Saved')).toBeNull();
    });

    it('shows Saved only in the rate row that was saved', async () => {
      render(<WorkSettings />);
      type(rateInput('2025–26'), '71');
      fireEvent.click(rateSaveButton('2025–26'));
      expect(await rateRow('2025–26').findByText('Saved')).toBeInTheDocument();
      expect(rateRow('2026–27').queryByText('Saved')).toBeNull();
      expect(rateRow('2024–25').queryByText('Saved')).toBeNull();
      type(rateInput('2025–26'), '72');
      expect(rateRow('2025–26').queryByText('Saved')).toBeNull();
    });

    it('disables the button while a save is pending, and writes once', async () => {
      const write = deferred();
      save.mockReturnValue(write.promise);
      render(<WorkSettings />);
      fireEvent.click(hoursSaveButton());
      expect(hoursSaveButton()).toBeDisabled();
      fireEvent.click(hoursSaveButton());
      expect(save).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Saved')).toBeNull();
      write.resolve();
      expect(await screen.findByText('Saved')).toBeInTheDocument();
      expect(hoursSaveButton()).toBeEnabled();
    });

    // An edit made while a write is pending changes the value that write was for:
    // when the server acknowledges it, Saved would be about the old value.
    describe.each([
      {
        name: 'usual work days',
        saveButton: daysSaveButton,
        edit: () => fireEvent.click(checkbox('Sun')),
        patch: { workWeekdays: [1, 2, 3, 4, 5, 7] },
      },
      {
        name: 'default hours',
        saveButton: hoursSaveButton,
        edit: () => type(hoursInput(), '7.4'),
        patch: { defaultMinutes: 444 },
      },
      {
        name: 'a rate row',
        saveButton: () => rateSaveButton('2025–26'),
        edit: () => type(rateInput('2025–26'), '71'),
        patch: { ratesCentsPerHour: { '2025-26': 71 } },
      },
    ])('an edit while a write is pending ($name)', ({ saveButton, edit, patch }) => {
      it('does not show Saved when the old write is acknowledged, and a new save works', async () => {
        const write = deferred();
        save.mockReturnValueOnce(write.promise);
        render(<WorkSettings />);
        fireEvent.click(saveButton());
        edit();
        expect(saveButton()).toBeDisabled();
        write.resolve();
        await waitFor(() => expect(saveButton()).toBeEnabled());
        expect(screen.queryByText('Saved')).toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();

        fireEvent.click(saveButton());
        expect(await screen.findByText('Saved')).toBeInTheDocument();
        expect(save).toHaveBeenCalledTimes(2);
        expect(save).toHaveBeenLastCalledWith('u1', patch);
      });

      it('still shows the failure when the old write is rejected', async () => {
        const write = deferred();
        save.mockReturnValueOnce(write.promise);
        render(<WorkSettings />);
        fireEvent.click(saveButton());
        edit();
        write.reject(new Error('permission-denied'));
        expect(await screen.findByRole('alert')).toHaveTextContent(WRITE_FAILED);
        expect(saveButton()).toBeEnabled();
        expect(screen.queryByText('Saved')).toBeNull();
      });
    });

    it('shows a failure under the section and re-enables the button when a write is rejected', async () => {
      save.mockRejectedValue(new Error('permission-denied'));
      render(<WorkSettings />);
      fireEvent.click(checkbox('Sat'));
      fireEvent.click(daysSaveButton());
      expect(await screen.findByRole('alert')).toHaveTextContent(WRITE_FAILED);
      expect(daysSaveButton()).toBeEnabled();
      expect(screen.queryByText('Saved')).toBeNull();
    });

    it('shows a failed default hours save and a failed rate save in their own sections', async () => {
      save.mockRejectedValue(new Error('permission-denied'));
      render(<WorkSettings />);
      fireEvent.click(hoursSaveButton());
      expect(await screen.findByRole('alert')).toHaveTextContent(WRITE_FAILED);
      expect(hoursSaveButton()).toBeEnabled();
      fireEvent.click(rateSaveButton('2026–27'));
      await waitFor(() => expect(rateRow('2026–27').getByRole('alert')).toHaveTextContent(WRITE_FAILED));
      expect(rateRow('2025–26').queryByRole('alert')).toBeNull();
      expect(rateSaveButton('2026–27')).toBeEnabled();
    });

    it('clears the failure on the next edit, and a retry that works shows Saved', async () => {
      save.mockRejectedValueOnce(new Error('unavailable'));
      render(<WorkSettings />);
      fireEvent.click(hoursSaveButton());
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      type(hoursInput(), '7.5');
      expect(screen.queryByRole('alert')).toBeNull();
      fireEvent.click(hoursSaveButton());
      expect(await screen.findByText('Saved')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(save).toHaveBeenLastCalledWith('u1', { defaultMinutes: 450 });
    });

    it('does not leave the button stuck offline, where the write never settles', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      save.mockReturnValue(new Promise<void>(() => {}));
      render(<WorkSettings />);
      fireEvent.click(checkbox('Sat'));
      fireEvent.click(daysSaveButton());
      expect(save).toHaveBeenCalledWith('u1', { workWeekdays: [1, 2, 3, 4, 5, 6] });
      expect(await screen.findByText('Saved')).toBeInTheDocument();
      expect(daysSaveButton()).toBeEnabled();
    });
  });
});
