import { describe, it, expect } from 'vitest';
import { paths } from './paths';
import { routeInfo, isExpenseEditorPath, isEditExpensePath } from './routes';

describe('routeInfo', () => {
  it.each([paths.spend, paths.summary, paths.income])('treats %s as a month-scoped main section', (path) => {
    expect(routeInfo(path)).toEqual({ kind: 'primary', monthScoped: true });
  });

  it('treats More as a main section that is not month-scoped', () => {
    expect(routeInfo(paths.more)).toEqual({ kind: 'primary', monthScoped: false });
  });

  it('gives Search a back link to the expenses list', () => {
    expect(routeInfo(paths.search)).toEqual({ kind: 'secondary', title: 'Search', back: '/spend' });
  });

  it.each([
    [paths.categories, 'Categories', '/spend/more'],
    [paths.groupInvites, 'Invite', '/spend/more'],
    [paths.groupSettings, 'Group settings', '/spend/more'],
  ])('gives %s the title "%s" and a back link to More', (path, title, back) => {
    expect(routeInfo(path)).toEqual({ kind: 'secondary', title, back });
  });

  it('gives the new expense page a back link to the expenses list', () => {
    expect(routeInfo(paths.newExpense)).toEqual({ kind: 'secondary', title: 'New expense', back: '/spend' });
  });

  it('gives the refund page a back link to the expenses list', () => {
    expect(routeInfo(paths.refundExpense('abc'))).toEqual({ kind: 'secondary', title: 'Refund', back: '/spend' });
  });

  it('gives the edit expense page a back link to the expenses list', () => {
    expect(routeInfo('/spend/expense/abc/edit')).toEqual({ kind: 'secondary', title: 'Edit expense', back: '/spend' });
  });
});

describe('isExpenseEditorPath', () => {
  it.each(['/spend/expense/new', '/spend/expense/x/edit', '/spend/expense/x/refund'])('is true for %s', (path) => {
    expect(isExpenseEditorPath(path)).toBe(true);
  });

  it.each(['/spend', '/spend/more', '/expense/new'])('is false for %s', (path) => {
    expect(isExpenseEditorPath(path)).toBe(false);
  });
});

describe('isEditExpensePath', () => {
  it('is true for an existing expense being edited', () => {
    expect(isEditExpensePath('/spend/expense/x/edit')).toBe(true);
  });

  it.each(['/spend/expense/new', '/spend', '/spend/more', '/expense/x/edit', '/spend/expense/x/edit/more'])(
    'is false for %s',
    (path) => {
      expect(isEditExpensePath(path)).toBe(false);
    },
  );
});
