import { describe, it, expect } from 'vitest';
import { dayLabel, dayListLabel } from './workFormat';

describe('dayLabel', () => {
  it('is the short weekday, day and short month', () => {
    expect(dayLabel('2026-10-15')).toBe('Thu 15 Oct');
  });

  it('does not zero-pad the day', () => {
    expect(dayLabel('2026-10-01')).toBe('Thu 1 Oct');
  });

  it('abbreviates every month to three letters, whatever the ICU version', () => {
    // Intl en-AU gives 'June', 'July' and 'Sept' on Node 22 and 'Jun', 'Jul' and 'Sep' on older ICU.
    expect(dayLabel('2026-06-03')).toBe('Wed 3 Jun');
    expect(dayLabel('2026-07-03')).toBe('Fri 3 Jul');
    expect(dayLabel('2026-09-03')).toBe('Thu 3 Sep');
  });

  it('follows the date across a month and year boundary', () => {
    expect(dayLabel('2026-12-31')).toBe('Thu 31 Dec');
    expect(dayLabel('2027-01-01')).toBe('Fri 1 Jan');
  });
});

describe('dayListLabel', () => {
  it('joins the labels with a comma and a space', () => {
    expect(dayListLabel(['2026-10-15', '2026-10-16'])).toBe('Thu 15 Oct, Fri 16 Oct');
  });

  it('is empty for no dates', () => {
    expect(dayListLabel([])).toBe('');
  });

  it('is a single label for one date', () => {
    expect(dayListLabel(['2026-10-15'])).toBe('Thu 15 Oct');
  });

  it('shows all of exactly max dates, with no "more"', () => {
    expect(dayListLabel(['2026-10-13', '2026-10-14', '2026-10-15'])).toBe('Tue 13 Oct, Wed 14 Oct, Thu 15 Oct');
  });

  it('shows the first three then how many more', () => {
    const dates = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
    expect(dayListLabel(dates)).toBe('Mon 12 Oct, Tue 13 Oct, Wed 14 Oct +2 more');
  });

  it('honours a custom max', () => {
    const dates = ['2026-10-12', '2026-10-13', '2026-10-14'];
    expect(dayListLabel(dates, 1)).toBe('Mon 12 Oct +2 more');
  });
});
