import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonthOverview from './MonthOverview';
import type { MonthBreakdown } from '../../lib/monthSummary';

const breakdown: MonthBreakdown = {
  spent: 12000,
  income: 30000,
  saved: 18000,
  savingsRate: 60,
  vsPrev: { amount: 2000, pct: 20 },
  dailyAverage: 1200,
  biggestExpense: { shopName: 'Woolworths', amount: 7000 },
  categories: [],
  topShops: [],
};

function renderOverview(over: Partial<MonthBreakdown> = {}, comparedWith = 'September', sharedTotal = 8000) {
  return render(
    <MonthOverview breakdown={{ ...breakdown, ...over }} sharedTotal={sharedTotal} currency="AUD" comparedWith={comparedWith} />,
  );
}

describe('MonthOverview', () => {
  it('shows spending, income, what is left and the savings rate', () => {
    renderOverview();
    expect(screen.getByTestId('month-spent')).toHaveTextContent('A$120.00');
    expect(screen.getByTestId('month-income')).toHaveTextContent('A$300.00');
    expect(screen.getByTestId('month-saved')).toHaveTextContent('A$180.00');
    expect(screen.getByTestId('month-savings-rate')).toHaveTextContent('60%');
  });

  it('leaves out the income figures when no income was recorded', () => {
    renderOverview({ income: 0, saved: -12000, savingsRate: null });
    expect(screen.getByTestId('month-spent')).toBeInTheDocument();
    expect(screen.queryByTestId('month-income')).toBeNull();
    expect(screen.queryByTestId('month-saved')).toBeNull();
    expect(screen.queryByTestId('month-savings-rate')).toBeNull();
  });

  it('shows a shortfall as a negative amount', () => {
    renderOverview({ income: 10000, saved: -2000, savingsRate: -20 });
    expect(screen.getByTestId('month-saved')).toHaveTextContent('-A$20.00');
    expect(screen.getByTestId('month-savings-rate')).toHaveTextContent('-20%');
  });

  it('says how much more was spent than last month', () => {
    renderOverview();
    expect(screen.getByTestId('month-vs-prev')).toHaveTextContent('20% more than September');
  });

  it('says how much less was spent than last month, to the nearest percent', () => {
    renderOverview({ vsPrev: { amount: -4000, pct: -24.6 } });
    expect(screen.getByTestId('month-vs-prev')).toHaveTextContent('25% less than September');
  });

  it('calls a change that rounds to nothing about the same', () => {
    renderOverview({ vsPrev: { amount: 10, pct: 0.2 } });
    expect(screen.getByTestId('month-vs-prev')).toHaveTextContent('About the same as September');
  });

  it('has no comparison line when there is nothing to compare', () => {
    renderOverview({ vsPrev: null });
    expect(screen.queryByTestId('month-vs-prev')).toBeNull();
  });

  it('shows the shared total, the daily average and the biggest expense', () => {
    renderOverview();
    const details = screen.getByTestId('month-details');
    expect(details).toHaveTextContent('A$80.00 shared');
    expect(details).toHaveTextContent('Daily average A$12.00');
    expect(details).toHaveTextContent('Biggest: Woolworths A$70.00');
  });

  it('skips the biggest expense when there is none to name', () => {
    renderOverview({ biggestExpense: null });
    expect(screen.getByTestId('month-details')).not.toHaveTextContent('Biggest');
  });

  it('renders nothing for a month with no spending', () => {
    const { container } = renderOverview({ spent: 0, vsPrev: null, biggestExpense: null });
    expect(container).toBeEmptyDOMElement();
  });

  it('names the days of last month a month in progress is compared with', () => {
    renderOverview({}, '1–12 September');
    expect(screen.getByTestId('month-vs-prev')).toHaveTextContent('20% more than 1–12 September');
  });

  it('says so when a month in progress is below that stretch of last month, or level with it', () => {
    renderOverview({ vsPrev: { amount: -2000, pct: -20 } }, '1–12 September');
    expect(screen.getByTestId('month-vs-prev')).toHaveTextContent('20% less than 1–12 September');
    renderOverview({ vsPrev: { amount: 10, pct: 0.2 } }, '1–12 September');
    expect(screen.getAllByTestId('month-vs-prev')[1]).toHaveTextContent('About the same as 1–12 September');
  });
});
