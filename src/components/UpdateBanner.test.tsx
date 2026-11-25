import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UpdateBanner from './UpdateBanner';
import { usePwaStore } from '../lib/pwa';

describe('UpdateBanner', () => {
  beforeEach(() => {
    usePwaStore.setState({ installPrompt: null, installed: false, needRefresh: false, updateSW: null });
  });

  it('stays hidden until a new version is waiting', () => {
    render(<UpdateBanner />);
    expect(screen.queryByText(/new version/i)).not.toBeInTheDocument();
  });

  it('reloads into the new version', async () => {
    const updateSW = vi.fn().mockResolvedValue(undefined);
    usePwaStore.setState({ needRefresh: true, updateSW });
    render(<UpdateBanner />);
    expect(screen.getByText(/new version of homebase/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(updateSW).toHaveBeenCalledWith(true);
  });

  it('can be put off until later', async () => {
    usePwaStore.setState({ needRefresh: true, updateSW: vi.fn() });
    render(<UpdateBanner />);
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText(/new version/i)).not.toBeInTheDocument();
    expect(usePwaStore.getState().needRefresh).toBe(false);
  });
});
