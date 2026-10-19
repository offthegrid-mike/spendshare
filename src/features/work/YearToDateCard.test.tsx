import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import type { ResolvedRate } from '../../lib/work/workRates';
import type { WorkYearSummary } from '../../lib/work/workYear';
import { paths } from '../../lib/paths';
import YearToDateCard from './YearToDateCard';

// 22 Home days and 167.2 h in the claim, at 70c/h: 11 704 cents, so $117 once the cents are dropped.
const SUMMARY: WorkYearSummary = {
  counted: { days: 22, minutes: 10032 },
  addedLater: { days: 0, minutes: 0 },
  notConfirmed: { days: 0, minutes: 0 },
  officeDays: 6,
  leaveDays: 1,
  claimCents: 11704,
  claimDollars: 117,
};

const KNOWN: ResolvedRate = { cents: 70, source: 'known' };

function renderCard(props: Partial<ComponentProps<typeof YearToDateCard>> = {}) {
  return render(
    <MemoryRouter>
      <YearToDateCard summary={SUMMARY} rate={KNOWN} incomeYear="2026-27" {...props} />
    </MemoryRouter>,
  );
}

describe('YearToDateCard', () => {
  it('is headed with the income year', () => {
    renderCard();
    expect(screen.getByRole('heading', { name: 'Income year 2026–27 so far' })).toBeInTheDocument();
  });

  it('shows the counted hours, the days, the claim and the rate', () => {
    renderCard();
    expect(screen.getByText('167.2 h')).toBeInTheDocument();
    expect(screen.getByText('from home · 22 days')).toBeInTheDocument();
    expect(screen.getByText('≈ $117')).toBeInTheDocument();
    expect(screen.getByText('at 70c/h')).toBeInTheDocument();
  });

  it('uses the singular for one day', () => {
    renderCard({ summary: { ...SUMMARY, counted: { days: 1, minutes: 456 }, claimCents: 532, claimDollars: 5 } });
    expect(screen.getByText('7.6 h')).toBeInTheDocument();
    expect(screen.getByText('from home · 1 day')).toBeInTheDocument();
    expect(screen.getByText('≈ $5')).toBeInTheDocument();
  });

  it('shows an empty year as nothing yet', () => {
    renderCard({
      summary: { ...SUMMARY, counted: { days: 0, minutes: 0 }, claimCents: 0, claimDollars: 0 },
    });
    expect(screen.getByText('0.0 h')).toBeInTheDocument();
    expect(screen.getByText('from home · 0 days')).toBeInTheDocument();
    expect(screen.getByText('≈ $0')).toBeInTheDocument();
  });

  it('groups the thousands of a larger claim', () => {
    renderCard({ summary: { ...SUMMARY, claimCents: 119_025, claimDollars: 1190 } });
    expect(screen.getByText('≈ $1,190')).toBeInTheDocument();
  });

  it('shows the rate a set or known year uses without a carried-rate note', () => {
    renderCard({ rate: { cents: 75, source: 'set' } });
    expect(screen.getByText('at 75c/h')).toBeInTheDocument();
    expect(screen.queryByText(/until you set one/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('says a carried rate is last year’s and links to where to set it', () => {
    renderCard({ rate: { cents: 70, source: 'carried', carriedFrom: '2025-26' } });
    expect(screen.getByText('at 70c/h')).toBeInTheDocument();
    expect(screen.getByText('70c is the 2025–26 rate until you set one')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set the rate' })).toHaveAttribute('href', paths.workMore);
    expect(paths.workMore).toBe('/work/more');
  });

  it('lists days added later that are not in the claim', () => {
    renderCard({ summary: { ...SUMMARY, addedLater: { days: 2, minutes: 912 } } });
    expect(screen.getByText('Added later · 2 days · 15.2 h · not in the claim')).toBeInTheDocument();
    expect(screen.queryByText(/Not confirmed/)).toBeNull();
  });

  it('lists counted days whose finish is not confirmed', () => {
    renderCard({ summary: { ...SUMMARY, notConfirmed: { days: 1, minutes: 456 } } });
    expect(screen.getByText('Not confirmed · 1 day · 7.6 h · still counted')).toBeInTheDocument();
    expect(screen.queryByText(/Added later/)).toBeNull();
  });

  it('shows neither extra line when both counts are zero', () => {
    renderCard();
    expect(screen.queryByText(/Added later/)).toBeNull();
    expect(screen.queryByText(/Not confirmed/)).toBeNull();
  });

  it('shows both extra lines together', () => {
    renderCard({
      summary: { ...SUMMARY, addedLater: { days: 1, minutes: 456 }, notConfirmed: { days: 3, minutes: 1368 } },
    });
    expect(screen.getByText('Added later · 1 day · 7.6 h · not in the claim')).toBeInTheDocument();
    expect(screen.getByText('Not confirmed · 3 days · 22.8 h · still counted')).toBeInTheDocument();
  });

  it('links the added-later line to the review on the Year tab', () => {
    renderCard({ summary: { ...SUMMARY, addedLater: { days: 2, minutes: 912 } } });
    expect(screen.getByRole('link', { name: 'Include ›' })).toHaveAttribute('href', '/work/year#late');
    expect(screen.queryByRole('link', { name: 'Review ›' })).toBeNull();
  });

  it('links the not-confirmed line to the review on the Year tab', () => {
    renderCard({ summary: { ...SUMMARY, notConfirmed: { days: 1, minutes: 456 } } });
    expect(screen.getByRole('link', { name: 'Review ›' })).toHaveAttribute('href', '/work/year#confirm');
    expect(screen.queryByRole('link', { name: 'Include ›' })).toBeNull();
  });

  it('leaves the links out on the Year tab itself', () => {
    renderCard({
      linkToYear: false,
      summary: { ...SUMMARY, addedLater: { days: 1, minutes: 456 }, notConfirmed: { days: 1, minutes: 456 } },
    });
    expect(screen.getByText('Added later · 1 day · 7.6 h · not in the claim')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Include ›' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Review ›' })).toBeNull();
  });

  it('drops "so far" from the heading of a year that has ended', () => {
    renderCard({ incomeYear: '2025-26', finished: true });
    expect(screen.getByRole('heading', { name: 'Income year 2025–26' })).toBeInTheDocument();
  });
});
