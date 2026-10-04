import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SettingsMenu from './SettingsMenu';

vi.mock('../lib/firebase', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));

describe('SettingsMenu while dark mode is not yet enabled', () => {
  it('has no appearance options', async () => {
    render(<MemoryRouter><SettingsMenu /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: 'Settings menu' }));
    expect(screen.getByRole('menuitem', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Appearance' })).toBeNull();
    expect(screen.queryByRole('menuitemradio')).toBeNull();
  });
});
