import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { User } from 'firebase/auth';
import WorkLayout from './WorkLayout';
import { useWork } from './WorkContext';
import { useUIStore } from '../../stores/uiStore';
import { DEFAULT_WORK_SETTINGS } from '../../lib/work/workSettings';
import { paths } from '../../lib/paths';

const { desktop } = vi.hoisted(() => ({ desktop: { value: false } }));
vi.mock('../../hooks/useMediaQuery', () => ({ useIsDesktop: () => desktop.value }));
vi.mock('../../hooks/useWorkSettings', () => ({
  useWorkSettings: () => ({ settings: DEFAULT_WORK_SETTINGS, loading: false, loaded: true }),
}));

const mike = { uid: 'mike', displayName: 'Mike', email: 'mike@example.com' } as unknown as User;

function Page() {
  const { uid, clock } = useWork();
  return <p>{`Page content for ${uid} on ${clock.today}`}</p>;
}

function renderLayout(path: string = paths.work) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={paths.work} element={<WorkLayout user={mike} />}>
          <Route index element={<Page />} />
          <Route path="month" element={<Page />} />
          <Route path="year" element={<Page />} />
          <Route path="more" element={<Page />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  desktop.value = false;
  useUIStore.setState({ notice: null });
});

describe('WorkLayout on a phone', () => {
  it('has a header with a way back Home and the Work title', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument();
  });

  it('docks Today, Month, Year and More under a navigation named Work', () => {
    renderLayout();
    const dock = screen.getByRole('navigation', { name: 'Work' });
    const links = within(dock).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Today', 'Month', 'Year', 'More']);
    expect(within(dock).getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/work');
    expect(within(dock).getByRole('link', { name: 'Month' })).toHaveAttribute('href', '/work/month');
    expect(within(dock).getByRole('link', { name: 'Year' })).toHaveAttribute('href', '/work/year');
    expect(within(dock).getByRole('link', { name: 'More' })).toHaveAttribute('href', '/work/more');
  });

  it('marks Year current on /work/year', () => {
    renderLayout(paths.workYear);
    const dock = screen.getByRole('navigation', { name: 'Work' });
    expect(within(dock).getByRole('link', { name: 'Year' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks Today current on /work but not on /work/month', () => {
    const { unmount } = renderLayout(paths.work);
    const dock = screen.getByRole('navigation', { name: 'Work' });
    expect(within(dock).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    unmount();

    renderLayout(paths.workMonth);
    const nextDock = screen.getByRole('navigation', { name: 'Work' });
    expect(within(nextDock).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
    expect(within(nextDock).getByRole('link', { name: 'Month' })).toHaveAttribute('aria-current', 'page');
  });

  it('leaves out the desktop top bar', () => {
    renderLayout();
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Work settings' })).toBeNull();
  });

  it('shows the routed page, which can read the Work context', () => {
    renderLayout();
    expect(screen.getByText(/^Page content for mike on \d{4}-\d{2}-\d{2}$/)).toBeInTheDocument();
  });

  it('has the Notice region', () => {
    renderLayout();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows a notice in it', () => {
    useUIStore.setState({ notice: { id: 1, message: 'Saved a Work day' } });
    renderLayout();
    expect(within(screen.getByRole('status')).getByText('Saved a Work day')).toBeInTheDocument();
  });
});

describe('WorkLayout on desktop', () => {
  beforeEach(() => {
    desktop.value = true;
  });

  it('has a top bar with a way back Home', () => {
    renderLayout();
    expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('offers Today, Month and Year as sections, and a link to the settings on More', () => {
    renderLayout();
    const sections = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(sections).getAllByRole('link').map((link) => link.textContent)).toEqual(['Today', 'Month', 'Year']);
    expect(within(sections).getByRole('link', { name: 'Year' })).toHaveAttribute('href', '/work/year');
    expect(within(sections).getByRole('link', { name: 'Today' })).toHaveAttribute('href', '/work');
    expect(within(sections).getByRole('link', { name: 'Month' })).toHaveAttribute('href', '/work/month');
    expect(screen.getByRole('link', { name: 'Work settings' })).toHaveAttribute('href', '/work/more');
  });

  it('marks Today current on /work but not on /work/month', () => {
    const { unmount } = renderLayout(paths.work);
    const sections = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(sections).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    unmount();

    renderLayout(paths.workMonth);
    const nextSections = screen.getByRole('navigation', { name: 'Sections' });
    expect(within(nextSections).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
  });

  it('leaves out the phone header and dock', () => {
    renderLayout();
    expect(screen.queryByRole('heading', { level: 1, name: 'Work' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Work' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'More' })).toBeNull();
  });

  it('shows the routed page and the Notice region', () => {
    renderLayout();
    expect(screen.getByText(/^Page content for mike on /)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
