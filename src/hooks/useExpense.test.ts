import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useExpense } from './useExpense';

const { getDocMock, getDocsMock } = vi.hoisted(() => ({
  getDocMock: vi.fn(),
  getDocsMock: vi.fn(),
}));

vi.mock('../lib/converters', () => ({
  expensesCol: () => 'EXPENSES_COL',
  itemsCol: () => 'ITEMS_COL',
}));
vi.mock('firebase/firestore', () => ({
  doc: () => 'EXPENSE_DOC',
  getDoc: () => getDocMock(),
  getDocs: () => getDocsMock(),
}));

describe('useExpense', () => {
  beforeEach(() => {
    getDocMock.mockReset();
    getDocsMock.mockReset();
  });

  it('loads an expense and its items by id, regardless of month', async () => {
    getDocMock.mockImplementation(() =>
      Promise.resolve({
        exists: () => true,
        id: 'e1',
        data: () => ({ shopName: 'Woolworths', month: '2025-11' }),
      }),
    );
    getDocsMock.mockImplementation(() =>
      Promise.resolve({ docs: [{ id: 'i1', data: () => ({ name: 'Milk', expenseId: 'e1' }) }] }),
    );

    const { result } = renderHook(() => useExpense('g1', 'e1'));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.expense?.shopName).toBe('Woolworths');
    expect(result.current.items.map((i) => i.name)).toEqual(['Milk']);
  });

  it('resolves to null for a missing expense instead of hanging', async () => {
    getDocMock.mockImplementation(() =>
      Promise.resolve({ exists: () => false, id: 'e9', data: () => undefined }),
    );
    getDocsMock.mockImplementation(() => Promise.resolve({ docs: [] }));

    const { result } = renderHook(() => useExpense('g1', 'e9'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.expense).toBeNull();
  });

  it('resolves to null when the read fails', async () => {
    getDocMock.mockImplementation(() => Promise.reject(new Error('permission-denied')));
    getDocsMock.mockImplementation(() => Promise.resolve({ docs: [] }));

    const { result } = renderHook(() => useExpense('g1', 'e1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.expense).toBeNull();
  });

  it('does not fetch without a group or id', async () => {
    const { result } = renderHook(() => useExpense('g1', undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getDocMock).not.toHaveBeenCalled();
  });
});
