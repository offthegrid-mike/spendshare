import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ExpenseDetail from './ExpenseDetail';
import { makeExpense, makeGroup, makeItem } from '../../test/fixtures';

const pair = makeGroup('g1', 'Home');
const exp = makeExpense('e1', { shopName: 'Woolworths', total: 4250, day: '2026-10-03' });
const items = [makeItem('i1', 'e1', { name: 'Milk', amount: 4250 })];

describe('ExpenseDetail', () => {
  it('shows the selected expense with its items and actions', async () => {
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <ExpenseDetail expense={exp} items={items} group={pair} viewerUid="mike" onDelete={onDelete} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Woolworths' })).toBeInTheDocument();
    expect(screen.getByText('Sat 3 Oct · paid by you')).toBeInTheDocument();
    expect(screen.getByText('A$42.50')).toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/expense/e1/edit');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
    expect(screen.getByText('Use ↑ ↓ to move between expenses')).toBeInTheDocument();
  });

  it('names the payer when it is someone else', () => {
    render(
      <MemoryRouter>
        <ExpenseDetail expense={{ ...exp, payerUid: 'priya' }} items={items} group={pair} viewerUid="mike" onDelete={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Sat 3 Oct · paid by Priya')).toBeInTheDocument();
  });

  it('asks for a selection when nothing is selected', () => {
    render(
      <MemoryRouter>
        <ExpenseDetail expense={null} items={[]} group={pair} viewerUid="mike" onDelete={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Select an expense to see its items.')).toBeInTheDocument();
  });
});
