import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryFilter from './CategoryFilter';

function renderFilter(over: Partial<React.ComponentProps<typeof CategoryFilter>> = {}) {
  const onSelect = vi.fn();
  render(<CategoryFilter categories={['Dining', 'Groceries']} selected={null} onSelect={onSelect} {...over} />);
  return onSelect;
}

describe('CategoryFilter', () => {
  it('offers All, then each category in the order given', () => {
    renderFilter();
    const group = screen.getByRole('group', { name: 'Filter by category' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Dining', 'Groceries']);
  });

  it('scrolls sideways on touch screens but wraps on desktop, where a mouse cannot scroll it', () => {
    renderFilter();
    const group = screen.getByRole('group', { name: 'Filter by category' });
    expect(group.className).toContain('overflow-x-auto');
    expect(group.className).toContain('lg:flex-wrap');
    expect(group.className).toContain('lg:overflow-visible');
  });

  it('marks All as pressed when nothing is selected, and the chosen category otherwise', () => {
    renderFilter();
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Dining' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks only the selected category as pressed', () => {
    renderFilter({ selected: 'Dining' });
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Dining' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reports the chosen category, or null for All', async () => {
    const onSelect = renderFilter({ selected: 'Dining' });
    await userEvent.click(screen.getByRole('button', { name: 'Groceries' }));
    expect(onSelect).toHaveBeenLastCalledWith('Groceries');
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('renders nothing when there is only one category to choose', () => {
    const { container } = render(<CategoryFilter categories={['Groceries']} selected={null} onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
