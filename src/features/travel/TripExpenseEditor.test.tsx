import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from 'firebase/auth';
import TripExpenseEditor from './TripExpenseEditor';
import { makeExpense, makeItem, makeTrip } from '../../test/fixtures';
import type { CategoryDoc } from '../../types/models';

const { saveTripExpense } = vi.hoisted(() => ({ saveTripExpense: vi.fn() }));
vi.mock('./tripWrite', () => ({ saveTripExpense }));
const cats: CategoryDoc[] = [
  { id: 'food', name: 'Food', order: 0, archived: false },
  { id: 'fun', name: 'Activities', order: 1, archived: false },
];
const archived: CategoryDoc = { id: 'old', name: 'Souvenirs', order: 2, archived: true };
const catState = vi.hoisted(() => ({ active: null as unknown, all: null as unknown }));
vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({ active: catState.active, all: catState.all, loading: false }),
}));
vi.mock('../expenses/DatePicker', () => ({
  default: ({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) => (
    <input id={id} aria-label="Date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const trip = makeTrip('japan', 'Japan', '2027-05-10', '2027-05-20', ['Alex', 'Ben', 'Chris']);
const alex = { uid: 'alex', email: 'alex@example.com' } as User;
const onSaved = vi.fn();
const lastJpy = makeExpense('prev', { currency: 'JPY', paidWith: { kind: 'card', rate: 99, rateStatus: 'estimated' } });

beforeEach(() => {
  catState.active = cats;
  catState.all = [...cats, archived];
  saveTripExpense.mockReset().mockResolvedValue('new-id');
  onSaved.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2027, 4, 12, 9)); // during the trip
});
afterEach(() => vi.useRealTimers());

describe('TripExpenseEditor', () => {
  it('starts today, in the last currency used, at its last rate, shared by everyone', () => {
    render(<TripExpenseEditor trip={trip} user={alex} expenses={[lastJpy]} onSaved={onSaved} />);
    expect(screen.getByLabelText('Date')).toHaveValue('2027-05-12');
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('JPY');
    expect(screen.getByLabelText('Exchange rate')).toHaveValue('99');
    const sharers = within(screen.getByRole('group', { name: 'Item 1 shared with' }));
    expect(sharers.getAllByRole('button', { pressed: true }).map((b) => b.textContent)).toEqual(['You', 'Ben', 'Chris']);
  });

  it('shows the total and its estimated value in the home currency', async () => {
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TripExpenseEditor trip={trip} user={alex} expenses={[lastJpy]} onSaved={onSaved} />);
    await u.type(screen.getByLabelText('Item 1 name'), 'Ramen');
    await u.type(screen.getByLabelText('Item 1 amount'), '4500');
    expect(screen.getByText('¥4,500')).toBeInTheDocument();
    expect(screen.getByText('≈ A$45.45')).toBeInTheDocument();
  });

  it('saves the expense with the people chosen for each item', async () => {
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TripExpenseEditor trip={trip} user={alex} expenses={[lastJpy]} onSaved={onSaved} />);
    await u.type(screen.getByLabelText('Where'), 'Ichiran');
    await u.type(screen.getByLabelText('Item 1 name'), 'Ramen');
    await u.type(screen.getByLabelText('Item 1 amount'), '4500');
    await u.click(within(screen.getByRole('group', { name: 'Item 1 shared with' })).getByRole('button', { name: 'Chris' }));
    await u.click(screen.getByRole('button', { name: 'Add item' }));
    await u.type(screen.getByLabelText('Item 2 name'), 'Keyring');
    await u.type(screen.getByLabelText('Item 2 amount'), '800');
    await u.click(within(screen.getByRole('group', { name: 'Item 2' })).getByLabelText('Shared'));
    await u.click(screen.getByRole('button', { name: 'Save expense' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('new-id'));
    expect(saveTripExpense).toHaveBeenCalledWith({
      tripId: 'japan', uid: 'alex', home: 'AUD',
      categories: { food: 'Food', fun: 'Activities', old: 'Souvenirs' },
      built: {
        date: '2027-05-12', shopName: 'Ichiran', payerUid: 'alex', currency: 'JPY', rate: 99, total: 5300,
        items: [
          { name: 'Ramen', categoryId: 'food', amount: 4500, shared: true, sharedWith: ['alex', 'ben'] },
          { name: 'Keyring', categoryId: 'food', amount: 800, shared: false },
        ],
      },
      existing: undefined,
    });
  });

  it('asks for a rate only for a foreign currency', async () => {
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TripExpenseEditor trip={trip} user={alex} expenses={[]} onSaved={onSaved} />);
    expect(screen.getByRole('combobox', { name: 'Currency' })).toHaveTextContent('AUD');
    expect(screen.queryByLabelText('Exchange rate')).not.toBeInTheDocument();
    await u.click(screen.getByRole('combobox', { name: 'Currency' }));
    await u.click(screen.getByRole('option', { name: /^JPY/ }));
    expect(screen.getByLabelText('Exchange rate')).toHaveValue('');
    expect(screen.getByText('1 AUD =')).toBeInTheDocument();
  });

  it('says what is missing instead of saving', async () => {
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TripExpenseEditor trip={trip} user={alex} expenses={[lastJpy]} onSaved={onSaved} />);
    await u.type(screen.getByLabelText('Item 1 name'), 'Ramen');
    await u.type(screen.getByLabelText('Item 1 amount'), '4500');
    for (const name of ['You', 'Ben', 'Chris']) {
      await u.click(within(screen.getByRole('group', { name: 'Item 1 shared with' })).getByRole('button', { name }));
    }
    await u.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await screen.findByText('Item 1: choose who shares it.')).toBeInTheDocument();
    expect(saveTripExpense).not.toHaveBeenCalled();
  });

  it('shows an error and stays open when saving fails', async () => {
    saveTripExpense.mockRejectedValue(new Error('denied'));
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TripExpenseEditor trip={trip} user={alex} expenses={[lastJpy]} onSaved={onSaved} />);
    await u.type(screen.getByLabelText('Item 1 name'), 'Ramen');
    await u.type(screen.getByLabelText('Item 1 amount'), '4500');
    await u.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(await screen.findByText("Couldn't save the expense. Try again.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('opens an existing expense with its values, and saves it as an edit', async () => {
    const expense = makeExpense('e1', {
      day: '2027-05-11', shopName: 'Lawson', payerUid: 'ben', currency: 'JPY', total: 1200,
      paidWith: { kind: 'card', rate: 98.5, rateStatus: 'estimated' },
    });
    const items = [makeItem('i1', 'e1', { name: 'Onigiri', amount: 1200, categoryId: 'food', shared: true, sharedWith: ['ben', 'chris'] })];
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TripExpenseEditor trip={trip} user={alex} expenses={[lastJpy, expense]} existing={{ expense, items }} onSaved={onSaved} />);
    expect(screen.getByLabelText('Date')).toHaveValue('2027-05-11');
    expect(screen.getByLabelText('Where')).toHaveValue('Lawson');
    expect(screen.getByLabelText('Exchange rate')).toHaveValue('98.5');
    expect(screen.getByLabelText('Item 1 amount')).toHaveValue('1200');
    const sharers = within(screen.getByRole('group', { name: 'Item 1 shared with' }));
    expect(sharers.getAllByRole('button', { pressed: true }).map((b) => b.textContent)).toEqual(['Ben', 'Chris']);
    await u.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(saveTripExpense).toHaveBeenCalledWith(expect.objectContaining({ existing: { expense, items } })));
  });

  it('keeps an archived category on an item being edited, by name', async () => {
    const expense = makeExpense('e1', { day: '2027-05-11', currency: 'AUD', total: 500, paidWith: { kind: 'card', rate: 1, rateStatus: 'actual' } });
    const items = [makeItem('i1', 'e1', { name: 'Magnet', amount: 500, categoryId: 'old', category: 'Souvenirs', shared: false })];
    render(<TripExpenseEditor trip={trip} user={alex} expenses={[expense]} existing={{ expense, items }} onSaved={onSaved} />);
    expect(screen.getByRole('combobox', { name: 'Item 1 category' })).toHaveTextContent('Souvenirs');
  });

  it('saves without a category when the trip has none', async () => {
    catState.active = [];
    catState.all = [];
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TripExpenseEditor trip={trip} user={alex} expenses={[lastJpy]} onSaved={onSaved} />);
    expect(screen.queryByRole('combobox', { name: 'Item 1 category' })).not.toBeInTheDocument();
    await u.type(screen.getByLabelText('Item 1 name'), 'Ramen');
    await u.type(screen.getByLabelText('Item 1 amount'), '4500');
    await u.click(screen.getByRole('button', { name: 'Save expense' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
