import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { WorkDayDoc } from '../../types/models';
import { writeWorkDay } from '../../lib/work/workWrite';
import { makeWorkDay, WORK_SETTINGS } from '../../test/fixtures';
import LateDaysReview from './LateDaysReview';

vi.mock('../../lib/work/workWrite', () => ({ writeWorkDay: vi.fn(), saveWorkSettings: vi.fn() }));

const write = vi.mocked(writeWorkDay);

const late = (date: string, extra: Partial<WorkDayDoc> = {}) =>
  makeWorkDay(date, { addedLater: true, countedInClaim: false, finishConfirmed: false, ...extra });

beforeEach(() => {
  write.mockReset();
  write.mockResolvedValue(undefined);
});

function rowFor(label: string) {
  return screen.getByText(label).closest('li') as HTMLElement;
}

describe('LateDaysReview', () => {
  it('lists the late Home days, oldest first, with their hours and claim state', () => {
    const days = [
      makeWorkDay('2026-10-12'),
      late('2026-10-14', { countedInClaim: true, minutes: 470 }),
      late('2026-10-13'),
      late('2026-10-15', { type: 'office', startTime: undefined, finishTime: undefined, minutes: undefined }),
    ];
    render(<LateDaysReview uid="mike" days={days} settings={WORK_SETTINGS} />);

    const section = screen.getByRole('region', { name: 'Added later' });
    expect(section).toHaveAttribute('id', 'late');
    const items = within(section).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Tue 13 Oct');
    expect(items[0]).toHaveTextContent('7.6 h');
    expect(items[0]).toHaveTextContent('Not in the claim');
    expect(items[1]).toHaveTextContent('Wed 14 Oct');
    expect(items[1]).toHaveTextContent('7.83 h');
    expect(items[1]).toHaveTextContent('Included');
  });

  it('includes a day with one write', async () => {
    const day = late('2026-10-13');
    render(<LateDaysReview uid="mike" days={[day]} settings={WORK_SETTINGS} />);
    await act(async () => {
      fireEvent.click(within(rowFor('Tue 13 Oct')).getByRole('button', { name: 'Include' }));
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('mike', '2026-10-13', { kind: 'include' }, day, WORK_SETTINGS);
  });

  it('follows the day: include, then exclude, then include, one write each', async () => {
    let day = late('2026-10-13');
    const { rerender } = render(<LateDaysReview uid="mike" days={[day]} settings={WORK_SETTINGS} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Include' }));
    });
    day = { ...day, countedInClaim: true };
    rerender(<LateDaysReview uid="mike" days={[day]} settings={WORK_SETTINGS} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Exclude' }));
    });
    day = { ...day, countedInClaim: false };
    rerender(<LateDaysReview uid="mike" days={[day]} settings={WORK_SETTINGS} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Include' }));
    });

    expect(write.mock.calls.map((call) => call[2])).toEqual([
      { kind: 'include' },
      { kind: 'exclude' },
      { kind: 'include' },
    ]);
  });

  it('says a failed write failed and lets it be tried again', async () => {
    write.mockRejectedValueOnce(new Error('denied'));
    render(<LateDaysReview uid="mike" days={[late('2026-10-13')]} settings={WORK_SETTINGS} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Include' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't update the day. Try again.");
    expect(screen.getByRole('button', { name: 'Include' })).toBeEnabled();
  });

  it('disables the button while its write is on the way', async () => {
    let resolve = () => {};
    write.mockReturnValueOnce(new Promise<void>((r) => (resolve = r)));
    render(<LateDaysReview uid="mike" days={[late('2026-10-13')]} settings={WORK_SETTINGS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Include' }));
    expect(within(rowFor('Tue 13 Oct')).getByRole('button')).toBeDisabled();
    await act(async () => resolve());
    expect(within(rowFor('Tue 13 Oct')).getByRole('button')).toBeEnabled();
  });

  it('renders nothing without late days', () => {
    const { container } = render(
      <LateDaysReview uid="mike" days={[makeWorkDay('2026-10-12')]} settings={WORK_SETTINGS} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
