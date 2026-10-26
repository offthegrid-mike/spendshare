import { describe, it, expect } from 'vitest';
import { paths } from './paths';
import { routeInfo, isExpenseEditorPath, isEditExpensePath, isRefundExpensePath } from './routes';

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

  it('gives Tags a back link to More, and a tag page a back link to Tags titled by the tag', () => {
    expect(routeInfo(paths.tags)).toEqual({ kind: 'secondary', title: 'Tags', back: paths.more });
    expect(routeInfo(paths.tag('Holiday 2026'))).toEqual({ kind: 'secondary', title: 'Holiday 2026', back: paths.tags });
  });

  it('titles a tag page with its raw name when the address is not valid encoding, instead of failing', () => {
    expect(routeInfo('/spend/tags/%E0')).toEqual({ kind: 'secondary', title: '%E0', back: paths.tags });
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

describe('isRefundExpensePath', () => {
  it('is true only for the refund page', () => {
    expect(isRefundExpensePath('/spend/expense/x/refund')).toBe(true);
    expect(isRefundExpensePath('/spend/expense/x/edit')).toBe(false);
    expect(isRefundExpensePath('/spend/expense/x/refund/more')).toBe(false);
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

describe('price history route', () => {
  it("titles an item's price page with the item and gives it a back link to Spend", () => {
    expect(routeInfo(paths.price('Milk 2L'))).toEqual({ kind: 'secondary', title: 'Milk 2L', back: paths.spend });
  });

  it('titles it with the raw name when the address is not valid encoding, instead of failing', () => {
    expect(routeInfo('/spend/prices/%E0')).toEqual({ kind: 'secondary', title: '%E0', back: paths.spend });
  });

  it('is not the page for a longer address', () => {
    expect(routeInfo('/spend/prices/Milk/extra').kind).toBe('primary');
  });
});
