import { describe, it, expect } from 'vitest';
import { computeBudgetProgress, parseBudgetInput, tightestBudget, type BudgetRow } from './budget';

const cat = (id: string, name: string, order: number, over: { monthlyBudget?: number; archived?: boolean } = {}) =>
  ({ id, name, order, archived: false, ...over });
const item = (categoryId: string, amount: number, over: { refund?: boolean } = {}) => ({ categoryId, amount, ...over });

// Monday 19 October 2026: 19 of October's 31 days have passed.
const MID_OCTOBER = new Date(2026, 9, 19, 9).getTime();

const categories = [
  cat('groceries', 'Groceries', 0, { monthlyBudget: 50000 }),
  cat('dining', 'Dining', 1, { monthlyBudget: 20000 }),
  cat('transport', 'Transport', 2),
];

function progress(items: ReturnType<typeof item>[], cats = categories, month = '2026-10', now = MID_OCTOBER) {
  return computeBudgetProgress(items, cats, month, now);
}

describe('computeBudgetProgress rows', () => {
  it('gives a row for each active category with a budget, in category order', () => {
    const { rows } = progress([]);
    expect(rows.map((r) => r.categoryId)).toEqual(['groceries', 'dining']);
    expect(rows[0]).toMatchObject({ name: 'Groceries', limit: 50000, spent: 0, remaining: 50000, pct: 0, status: 'ok' });
  });

  it('follows the categories order, not the order they are passed in', () => {
    const { rows } = progress([], [categories[1], categories[0]]);
    expect(rows.map((r) => r.categoryId)).toEqual(['groceries', 'dining']);
  });

  it('leaves out archived categories and ones with no usable budget', () => {
    const { rows } = progress([], [
      cat('a', 'Archived', 0, { monthlyBudget: 1000, archived: true }),
      cat('b', 'Zero', 1, { monthlyBudget: 0 }),
      cat('c', 'Negative', 2, { monthlyBudget: -500 }),
      cat('d', 'Missing', 3),
      cat('e', 'Kept', 4, { monthlyBudget: 1000 }),
    ]);
    expect(rows.map((r) => r.categoryId)).toEqual(['e']);
  });

  it('is empty when no category has a budget', () => {
    expect(progress([item('groceries', 100)], [cat('groceries', 'Groceries', 0)]).rows).toEqual([]);
  });
});

describe('computeBudgetProgress spending', () => {
  it('counts every item in the category, shared or personal', () => {
    // The items carry no shared flag: all of them count, which is the point.
    const { rows } = progress([item('groceries', 12000), item('groceries', 3000), item('dining', 500)]);
    expect(rows[0].spent).toBe(15000);
    expect(rows[1].spent).toBe(500);
  });

  it('matches by category id, ignoring other and unknown categories', () => {
    const { rows } = progress([item('groceries', 1000), item('transport', 9000), item('gone', 7000)]);
    expect(rows[0].spent).toBe(1000);
    expect(rows[1].spent).toBe(0);
  });

  it('takes refunds off what was spent', () => {
    const { rows } = progress([item('groceries', 20000), item('groceries', 5000, { refund: true })]);
    expect(rows[0].spent).toBe(15000);
    expect(rows[0].remaining).toBe(35000);
  });

  it('reports the amount over when spending passes the limit', () => {
    const { rows } = progress([item('dining', 25000)]);
    expect(rows[1]).toMatchObject({ spent: 25000, remaining: -5000, pct: 125, status: 'over' });
  });

  it('shows no progress when refunds outweigh spending', () => {
    const { rows } = progress([item('dining', 1000), item('dining', 4000, { refund: true })]);
    expect(rows[1]).toMatchObject({ spent: -3000, pct: 0, status: 'ok' });
  });
});

describe('computeBudgetProgress status', () => {
  const statusAt = (spent: number) => progress([item('dining', spent)]).rows[1].status;

  it('is ok below 80% of the limit', () => {
    expect(statusAt(15999)).toBe('ok');
  });

  it('warns from 80% up to the limit', () => {
    expect(statusAt(16000)).toBe('warn');
    expect(statusAt(19999)).toBe('warn');
  });

  it('is over from the limit itself', () => {
    expect(statusAt(20000)).toBe('over');
  });
});

describe('computeBudgetProgress pace', () => {
  it('marks how much of the month has passed while it is in progress', () => {
    const result = progress([]);
    expect(result.pace).toBeCloseTo((19 / 31) * 100, 5);
    expect(result.daysLeft).toBe(12);
  });

  it('has no pace for a finished month, with no days left', () => {
    const result = progress([], categories, '2026-09');
    expect(result.pace).toBeNull();
    expect(result.daysLeft).toBe(0);
  });

  it('has no pace on the last day, when the month is all but over', () => {
    const result = progress([], categories, '2026-10', new Date(2026, 9, 31, 9).getTime());
    expect(result.pace).toBeNull();
    expect(result.daysLeft).toBe(0);
  });

  it('has no pace for a month that has not started, with all its days left', () => {
    const result = progress([], categories, '2026-11');
    expect(result.pace).toBeNull();
    expect(result.daysLeft).toBe(30);
  });

  it('does not carry anything over: each month stands on its own limit', () => {
    const september = progress([item('dining', 5000)], categories, '2026-09').rows[1];
    const october = progress([], categories, '2026-10').rows[1];
    expect(september.remaining).toBe(15000);
    expect(october.remaining).toBe(20000);
  });
});

describe('tightestBudget', () => {
  const row = (categoryId: string, pct: number, status: BudgetRow['status']): BudgetRow =>
    ({ categoryId, name: categoryId, spent: 0, limit: 100, remaining: 100, pct, status });

  it('is null without budgets', () => {
    expect(tightestBudget([])).toBeNull();
  });

  it('is null while every budget is ok', () => {
    expect(tightestBudget([row('a', 79, 'ok'), row('b', 10, 'ok')])).toBeNull();
  });

  it('picks the budget with the most used', () => {
    expect(tightestBudget([row('a', 85, 'warn'), row('b', 92, 'warn'), row('c', 40, 'ok')])?.categoryId).toBe('b');
  });

  it('ranks over budget above one that is close', () => {
    expect(tightestBudget([row('a', 99, 'warn'), row('b', 130, 'over')])?.categoryId).toBe('b');
  });

  it('keeps the earlier category on a tie', () => {
    expect(tightestBudget([row('a', 90, 'warn'), row('b', 90, 'warn')])?.categoryId).toBe('a');
  });
});

describe('parseBudgetInput', () => {
  it('reads a blank field as removing the budget', () => {
    expect(parseBudgetInput('')).toBeNull();
    expect(parseBudgetInput('   ')).toBeNull();
  });

  it('reads whole and fractional amounts as cents', () => {
    expect(parseBudgetInput('400')).toBe(40000);
    expect(parseBudgetInput('400.5')).toBe(40050);
    expect(parseBudgetInput('400.05')).toBe(40005);
    expect(parseBudgetInput('.5')).toBe(50);
  });

  it('tolerates a currency symbol, thousands commas and spaces', () => {
    expect(parseBudgetInput('$400')).toBe(40000);
    expect(parseBudgetInput('A$ 1,200.00')).toBe(120000);
    expect(parseBudgetInput(' 1,200 ')).toBe(120000);
  });

  it('rejects what is not a positive amount', () => {
    for (const text of ['abc', '0', '0.00', '-5', '12.345', '1e3', '1.2.3', '4 00x', '--']) {
      expect(parseBudgetInput(text), text).toBe('invalid');
    }
  });

  it('rejects an amount too large to be a household budget', () => {
    expect(parseBudgetInput('10000000')).toBe(1_000_000_000);
    expect(parseBudgetInput('10000001')).toBe('invalid');
  });
});
