import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dock from './Dock';
import { useUIStore } from '../stores/uiStore';

function renderDock(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Dock />
    </MemoryRouter>,
  );
}

beforeEach(() => useUIStore.setState({ addSheetOpen: false }));

describe('Dock', () => {
  it('links to the four main sections', () => {
    renderDock();
    expect(screen.getByRole('link', { name: 'Expenses' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Summary' })).toHaveAttribute('href', '/summary');
    expect(screen.getByRole('link', { name: 'Income' })).toHaveAttribute('href', '/income');
    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('href', '/more');
  });

  it('marks the current section', () => {
    renderDock('/income');
    expect(screen.getByRole('link', { name: 'Income' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Expenses' })).not.toHaveAttribute('aria-current');
  });

  it('opens the Add Expense sheet from the centre button', async () => {
    renderDock();
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(useUIStore.getState().addSheetOpen).toBe(true);
  });

  it.each(['/expense/new', '/expense/abc123/edit'])('is hidden on %s', (path) => {
    renderDock(path);
    expect(screen.queryByRole('button', { name: 'Add expense' })).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
