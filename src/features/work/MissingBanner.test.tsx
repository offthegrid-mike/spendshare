import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MissingBanner from './MissingBanner';

function renderBanner(missing: string[], toConfirm: string[]) {
  const onPick = vi.fn();
  const view = render(<MissingBanner missing={missing} toConfirm={toConfirm} onPick={onPick} />);
  return { onPick, ...view };
}

describe('MissingBanner', () => {
  it('renders nothing when both lists are empty', () => {
    const { container } = renderBanner([], []);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts the missing weekdays and shows a chip for each', () => {
    renderBanner(['2026-10-15', '2026-10-16'], []);
    expect(screen.getByText('2 weekdays not filled in')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thu 15 Oct' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fri 16 Oct' })).toBeInTheDocument();
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it('uses the singular for one missing weekday', () => {
    renderBanner(['2026-10-15'], []);
    expect(screen.getByText('1 weekday not filled in')).toBeInTheDocument();
  });

  it('shows three chips and the rest as plain text when more than three are missing', () => {
    renderBanner(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'], []);
    expect(screen.getByText('5 weekdays not filled in')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Thu 15 Oct' })).not.toBeInTheDocument();
    const more = screen.getByText('+2 more');
    expect(more).toBeInTheDocument();
    expect(more.closest('button')).toBeNull();
  });

  it('shows exactly three chips and no "more" for three days', () => {
    renderBanner(['2026-10-13', '2026-10-14', '2026-10-15'], []);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText(/more/)).not.toBeInTheDocument();
  });

  it('counts the days to confirm and shows a chip for it', () => {
    renderBanner([], ['2026-10-14']);
    expect(screen.getByText('1 day to confirm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wed 14 Oct' })).toBeInTheDocument();
    expect(screen.queryByText(/not filled in/)).not.toBeInTheDocument();
  });

  it('uses the plural for several days to confirm and limits the chips to three', () => {
    renderBanner([], ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']);
    expect(screen.getByText('4 days to confirm')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('shows both messages when there are missing and unconfirmed days', () => {
    renderBanner(['2026-10-15'], ['2026-10-14']);
    expect(screen.getByText('1 weekday not filled in')).toBeInTheDocument();
    expect(screen.getByText('1 day to confirm')).toBeInTheDocument();
  });

  it('shows a date that is in both lists in both', () => {
    renderBanner(['2026-10-15'], ['2026-10-15']);
    expect(screen.getAllByRole('button', { name: 'Thu 15 Oct' })).toHaveLength(2);
  });

  it('calls onPick with the date of a clicked chip', () => {
    const { onPick } = renderBanner(['2026-10-15', '2026-10-16'], ['2026-10-14']);
    fireEvent.click(screen.getByRole('button', { name: 'Fri 16 Oct' }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('2026-10-16');
    fireEvent.click(screen.getByRole('button', { name: 'Wed 14 Oct' }));
    expect(onPick).toHaveBeenLastCalledWith('2026-10-14');
  });
});
