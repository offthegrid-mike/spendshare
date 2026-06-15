import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MoreScreen from './MoreScreen';

vi.mock('../../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));

function renderMore() {
  return render(<MemoryRouter><MoreScreen /></MemoryRouter>);
}

describe('MoreScreen', () => {
  it('renders Categories link pointing to /categories', () => {
    renderMore();
    const link = screen.getByRole('link', { name: /categories/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/categories');
  });

  it('renders Invites link pointing to /group/invites', () => {
    renderMore();
    const link = screen.getByRole('link', { name: /invites/i });
    expect(link.getAttribute('href')).toBe('/group/invites');
  });

  it('renders Group settings link pointing to /group/settings', () => {
    renderMore();
    const link = screen.getByRole('link', { name: /group settings/i });
    expect(link.getAttribute('href')).toBe('/group/settings');
  });

  it('renders a Sign out button', () => {
    renderMore();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy();
  });
});
