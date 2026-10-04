import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MonthRail from './MonthRail';
import { useUIStore } from '../stores/uiStore';
import { computeSummary } from '../lib/settlement';
import { makeGroup } from '../test/fixtures';

const { overview } = vi.hoisted(() => ({ overview: vi.fn() }));
vi.mock('../hooks/useYearOverview', () => ({ useYearOverview: overview }));

const group = {
  ...makeGroup('g1', 'Home'),
  createdAt: { toDate: () => new Date(2025, 10, 5) } as unknown as ReturnType<typeof makeGroup>['createdAt'],
};
const members = group.memberUids;

const month = (items: Array<{ amount: number; shared: boolean; payerUid: string }>, paid = false) => ({
  spent: items.reduce((s, i) => s + i.amount, 0),
  summary: computeSummary(members, items, paid ? [{ fromUid: 'priya', toUid: 'mike', amount: 500, paid: true }] : []),
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 9, 4, 12));
  useUIStore.setState({ selectedMonth: '2026-10' });
  overview.mockImplementation((_gid: string, year: string) => ({
    loading: false,
    total: year === '2026' ? 33024 : 0,
    months: year === '2026'
      ? {
          '2026-10': month([{ amount: 17658, shared: true, payerUid: 'mike' }]),
          '2026-09': month([{ amount: 2480, shared: true, payerUid: 'priya' }]),
          '2026-08': month([{ amount: 1000, shared: true, payerUid: 'mike' }], true),
        }
      : {},
  }));
});

afterEach(() => vi.useRealTimers());

describe('MonthRail', () => {
  it('lists the current year, newest month first, with spend and status', () => {
    render(<MonthRail group={group} viewerUid="mike" />);
    expect(screen.getByRole('navigation', { name: 'Months' })).toBeInTheDocument();
    const months = screen.getAllByRole('button', { name: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/ });
    expect(months.map((m) => m.textContent?.slice(0, 3))).toEqual([
      'Oct', 'Sep', 'Aug', 'Jul', 'Jun', 'May', 'Apr', 'Mar', 'Feb', 'Jan',
    ]);
    expect(screen.getByRole('button', { name: /^Oct/ })).toHaveTextContent('176.58');
    expect(screen.getByRole('button', { name: /^Oct/ })).toHaveTextContent('Priya owes 88.29');
    expect(screen.getByRole('button', { name: /^Sep/ })).toHaveTextContent('You owe 12.40');
    expect(screen.getByRole('button', { name: /^Aug/ })).toHaveTextContent('Settled');
  });

  it('marks the selected month', () => {
    render(<MonthRail group={group} viewerUid="mike" />);
    expect(screen.getByRole('button', { name: /^Oct/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /^Sep/ })).not.toHaveAttribute('aria-current');
  });

  it('selects a month on click', async () => {
    render(<MonthRail group={group} viewerUid="mike" />);
    await userEvent.click(screen.getByRole('button', { name: /^Sep/ }));
    expect(useUIStore.getState().selectedMonth).toBe('2026-09');
  });

  it('keeps older years collapsed and unfetched until expanded', async () => {
    render(<MonthRail group={group} viewerUid="mike" />);
    const y2025 = screen.getByRole('button', { name: /^2025/ });
    expect(y2025).toHaveAttribute('aria-expanded', 'false');
    // Collapsed years pass no group id, so nothing is fetched.
    expect(overview.mock.calls.filter((c) => c[1] === '2025' && c[0] !== null)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /^Dec/ })).toBeNull();

    await userEvent.click(y2025);
    expect(y2025).toHaveAttribute('aria-expanded', 'true');
    expect(overview.mock.calls.filter((c) => c[1] === '2025' && c[0] === 'g1').length).toBeGreaterThan(0);
    expect(y2025).toHaveFocus();
    expect(screen.getAllByRole('button', { name: /^(Nov|Dec)/ }).map((b) => b.textContent?.slice(0, 3))).toEqual(['Dec', 'Nov']);
  });

  it("shows the expanded year's total spend", () => {
    render(<MonthRail group={group} viewerUid="mike" />);
    expect(screen.getByRole('button', { name: /^2026/ })).toHaveTextContent('330');
  });

  it('includes a selected month from before the group started', () => {
    useUIStore.setState({ selectedMonth: '2025-09' });
    render(<MonthRail group={group} viewerUid="mike" />);
    const current = screen.getAllByRole('button', { name: /^Sep/ }).filter((b) => b.getAttribute('aria-current') === 'true');
    expect(current).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^2025/ })).toHaveAttribute('aria-expanded', 'true');
  });
});
