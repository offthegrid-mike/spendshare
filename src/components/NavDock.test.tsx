import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Home, Layers, Settings } from 'lucide-react';
import NavDock, { type NavDockItem } from './NavDock';

const ITEMS: NavDockItem[] = [
  { to: '/a', label: 'Alpha', icon: Home, end: true },
  { to: '/a/b', label: 'Beta', icon: Layers },
  { to: '/c', label: 'Gamma', icon: Settings },
];

function renderDock(props: Partial<React.ComponentProps<typeof NavDock>> = {}, path = '/a') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavDock items={ITEMS} {...props} />
    </MemoryRouter>,
  );
}

describe('NavDock', () => {
  it('renders the items as links in order inside a navigation named Main', () => {
    renderDock();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/a', '/a/b', '/c']);
  });

  it('renames the navigation with ariaLabel', () => {
    renderDock({ ariaLabel: 'Work' });
    expect(screen.getByRole('navigation', { name: 'Work' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('marks the active item with aria-current', () => {
    renderDock({}, '/c');
    expect(screen.getByRole('link', { name: 'Gamma' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Alpha' })).not.toHaveAttribute('aria-current');
  });

  it('honours end so a parent item is not active on a child path', () => {
    renderDock({}, '/a/b');
    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Alpha' })).not.toHaveAttribute('aria-current');
  });

  it('inserts the centre node between the items at its index', () => {
    renderDock({ center: { index: 2, node: <button type="button">Centre</button> } });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const order = within(nav)
      .getAllByRole('link')
      .map((l) => l.textContent);
    expect(order).toEqual(['Alpha', 'Beta', 'Gamma']);
    const centre = within(nav).getByRole('button', { name: 'Centre' });
    const beta = within(nav).getByRole('link', { name: 'Beta' });
    const gamma = within(nav).getByRole('link', { name: 'Gamma' });
    // DOCUMENT_POSITION_FOLLOWING (4): the argument comes after the receiver.
    expect(beta.compareDocumentPosition(centre) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(centre.compareDocumentPosition(gamma) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts the centre node first or last when the index says so', () => {
    const { unmount } = renderDock({ center: { index: 0, node: <button type="button">Centre</button> } });
    const first = screen.getByRole('navigation', { name: 'Main' }).firstElementChild;
    expect(first).toContainElement(screen.getByRole('button', { name: 'Centre' }));
    unmount();

    renderDock({ center: { index: 3, node: <button type="button">Centre</button> } });
    const last = screen.getByRole('navigation', { name: 'Main' }).lastElementChild;
    expect(last).toContainElement(screen.getByRole('button', { name: 'Centre' }));
  });
});
