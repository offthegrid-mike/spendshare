import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from './BottomNav';

function renderNav(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>
  );
}

describe('BottomNav', () => {
  it('renders all four tab labels', () => {
    renderNav();
    expect(screen.getByText('Expenses')).toBeTruthy();
    expect(screen.getByText('Income')).toBeTruthy();
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.getByText('More')).toBeTruthy();
  });

  it('links point to correct routes', () => {
    renderNav();
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/income');
    expect(hrefs).toContain('/summary');
    expect(hrefs).toContain('/more');
  });

  it('applies active colour class to the current route', () => {
    renderNav('/income');
    const incomeLink = screen.getByText('Income').closest('a')!;
    expect(incomeLink.className).toContain('text-brand-700');
  });

  it('applies inactive colour class to non-current routes', () => {
    renderNav('/income');
    const expensesLink = screen.getByText('Expenses').closest('a')!;
    expect(expensesLink.className).toContain('text-slate-400');
  });
});
