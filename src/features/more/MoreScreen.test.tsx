import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MoreScreen from './MoreScreen';
import { paths } from '../../lib/paths';

vi.mock('../../lib/firebase', () => ({ auth: {} }));
vi.mock('../../lib/features', () => ({ DARK_MODE_ENABLED: true }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));

function renderMore() {
  return render(<MemoryRouter><MoreScreen /></MemoryRouter>);
}

describe('MoreScreen', () => {
  it('renders Categories link pointing to /categories', () => {
    renderMore();
    const link = screen.getByRole('link', { name: /categories/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe(paths.categories);
  });

  it('renders Invites link pointing to /group/invites', () => {
    renderMore();
    const link = screen.getByRole('link', { name: /invites/i });
    expect(link.getAttribute('href')).toBe(paths.groupInvites);
  });

  it('renders Group settings link pointing to /group/settings', () => {
    renderMore();
    const link = screen.getByRole('link', { name: /group settings/i });
    expect(link.getAttribute('href')).toBe(paths.groupSettings);
  });

  it('renders the shared account controls: Appearance and Sign out', () => {
    renderMore();
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });

  it('renders the build version stamp', () => {
    renderMore();
    expect(screen.getByText(/built \d{4}-\d{2}-\d{2}/)).toBeTruthy();
  });

  it('renders a Tags link', () => {
    renderMore();
    expect(screen.getByRole('link', { name: /Tags/ })).toHaveAttribute('href', '/spend/tags');
  });
});
