import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeSwitch from './ThemeSwitch';
import { useUIStore } from '../stores/uiStore';

beforeEach(() => useUIStore.setState({ theme: 'system' }));

describe('ThemeSwitch', () => {
  it('shows the current preference as pressed', () => {
    render(<ThemeSwitch />);
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('stores the chosen preference', async () => {
    render(<ThemeSwitch />);
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(useUIStore.getState().theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  });
});
