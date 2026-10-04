import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MoreScreen from './MoreScreen';

vi.mock('../../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));

describe('MoreScreen while dark mode is not yet enabled', () => {
  it('has no appearance switch', () => {
    render(<MemoryRouter><MoreScreen /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /categories/i })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Appearance' })).toBeNull();
    expect(screen.queryByText('Appearance')).toBeNull();
  });
});
