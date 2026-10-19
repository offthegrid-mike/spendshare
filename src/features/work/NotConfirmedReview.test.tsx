import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { writeWorkDay } from '../../lib/work/workWrite';
import { makeWorkDay, WORK_SETTINGS } from '../../test/fixtures';
import NotConfirmedReview from './NotConfirmedReview';

vi.mock('../../lib/work/workWrite', () => ({ writeWorkDay: vi.fn(), saveWorkSettings: vi.fn() }));

const write = vi.mocked(writeWorkDay);
const CLOCK = { today: '2026-10-19', nowMinutes: 540 };

const unconfirmed = (date: string, finishTime = '16:06', minutes = 456) =>
  makeWorkDay(date, { finishConfirmed: false, finishTime, minutes });

beforeEach(() => {
  write.mockReset();
  write.mockResolvedValue(undefined);
});

describe('NotConfirmedReview', () => {
  it('lists the unconfirmed days oldest first with their finish', () => {
    const days = [
      unconfirmed('2026-10-14', '17:00', 510),
      makeWorkDay('2026-10-12'),
      unconfirmed('2026-10-13'),
      // Today, finish still ahead: not unconfirmed yet.
      unconfirmed('2026-10-19'),
    ];
    render(<NotConfirmedReview uid="mike" days={days} settings={WORK_SETTINGS} clock={CLOCK} onEdit={vi.fn()} />);

    const section = screen.getByRole('region', { name: 'Not confirmed' });
    expect(section).toHaveAttribute('id', 'confirm');
    const items = within(section).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Tue 13 Oct');
    expect(items[0]).toHaveTextContent('Finish 16:06');
    expect(items[1]).toHaveTextContent('Wed 14 Oct');
    expect(items[1]).toHaveTextContent('Finish 17:00');
    expect(section).not.toHaveTextContent('not in the claim');
  });

  it('lists a late day left out of the claim too, without saying it still counts', () => {
    const late = makeWorkDay('2026-10-13', { finishConfirmed: false, addedLater: true, countedInClaim: false });
    render(<NotConfirmedReview uid="mike" days={[late]} settings={WORK_SETTINGS} clock={CLOCK} onEdit={vi.fn()} />);
    // Marked, so the list agrees with the year card's count of days that still count.
    expect(screen.getByText('Tue 13 Oct').closest('li')).toHaveTextContent('Finish 16:06 · not in the claim');
    expect(screen.queryByText(/still count/i)).toBeNull();
  });

  it("confirms one day's finish with its own times", async () => {
    const day = unconfirmed('2026-10-14', '17:00', 510);
    render(
      <NotConfirmedReview uid="mike" days={[unconfirmed('2026-10-13'), day]} settings={WORK_SETTINGS} clock={CLOCK} onEdit={vi.fn()} />,
    );
    const row = screen.getByText('Wed 14 Oct').closest('li') as HTMLElement;
    await act(async () => {
      fireEvent.click(within(row).getByRole('button', { name: 'Confirm finish' }));
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      'mike',
      '2026-10-14',
      { kind: 'confirm', finishTime: '17:00', minutes: 510 },
      day,
      WORK_SETTINGS,
    );
  });

  it('opens a day to edit it', () => {
    const onEdit = vi.fn();
    render(<NotConfirmedReview uid="mike" days={[unconfirmed('2026-10-13')]} settings={WORK_SETTINGS} clock={CLOCK} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith('2026-10-13');
  });

  it('has no way to confirm every day at once', () => {
    render(
      <NotConfirmedReview
        uid="mike"
        days={[unconfirmed('2026-10-13'), unconfirmed('2026-10-14')]}
        settings={WORK_SETTINGS}
        clock={CLOCK}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('button', { name: 'Confirm finish' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /all/i })).toBeNull();
  });

  it('says a failed confirm failed and lets it be tried again', async () => {
    write.mockRejectedValueOnce(new Error('denied'));
    render(<NotConfirmedReview uid="mike" days={[unconfirmed('2026-10-13')]} settings={WORK_SETTINGS} clock={CLOCK} onEdit={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm finish' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't update the day. Try again.");
    expect(screen.getByRole('button', { name: 'Confirm finish' })).toBeEnabled();
  });

  it('renders nothing when every day is confirmed', () => {
    const { container } = render(
      <NotConfirmedReview uid="mike" days={[makeWorkDay('2026-10-13')]} settings={WORK_SETTINGS} clock={CLOCK} onEdit={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
