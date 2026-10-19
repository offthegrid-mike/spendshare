import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SectionPills, { type SectionPill } from './SectionPills';

const SECTIONS: SectionPill[] = [
  { to: '/a', label: 'Alpha', end: true },
  { to: '/a/b', label: 'Beta' },
  { to: '/c', label: 'Gamma' },
];

function renderPills(path = '/a', props: Partial<React.ComponentProps<typeof SectionPills>> = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SectionPills sections={SECTIONS} {...props} />
    </MemoryRouter>,
  );
}

describe('SectionPills', () => {
  it('renders the sections as links inside a navigation named Sections', () => {
    renderPills();
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/a', '/a/b', '/c']);
  });

  it('renames the navigation with label', () => {
    renderPills('/a', { label: 'Work sections' });
    expect(screen.getByRole('navigation', { name: 'Work sections' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
  });

  it('marks the current section with aria-current', () => {
    renderPills('/c');
    expect(screen.getByRole('link', { name: 'Gamma' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Alpha' })).not.toHaveAttribute('aria-current');
  });

  it('honours end so a parent section is not current on a child path', () => {
    renderPills('/a/b');
    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Alpha' })).not.toHaveAttribute('aria-current');
  });

  it('keeps a section without end current on its child paths', () => {
    renderPills('/a/b/deeper');
    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute('aria-current', 'page');
  });
});
