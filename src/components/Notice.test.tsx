import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Notice from './Notice';
import { useUIStore } from '../stores/uiStore';
import { paths } from '../lib/paths';

function renderNotice() {
  return render(
    <MemoryRouter>
      <Notice />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  useUIStore.setState({ notice: null });
});
afterEach(() => vi.useRealTimers());

describe('Notice', () => {
  it('keeps an empty live region when there is no notice', () => {
    renderNotice();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('shows the message and its action link', () => {
    renderNotice();
    act(() => useUIStore.getState().showNotice({ message: 'Trip created', action: { label: 'Invite people', to: paths.groupInvites } }));
    expect(screen.getByText('Trip created')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invite people' })).toHaveAttribute('href', paths.groupInvites);
  });

  it('clears when the action link is followed', () => {
    renderNotice();
    act(() => useUIStore.getState().showNotice({ message: 'Trip created', action: { label: 'Invite people', to: paths.groupInvites } }));
    fireEvent.click(screen.getByRole('link', { name: 'Invite people' }));
    expect(useUIStore.getState().notice).toBeNull();
  });

  it('dismisses itself after 5 seconds', () => {
    renderNotice();
    act(() => useUIStore.getState().showNotice({ message: 'You joined Trip' }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText('You joined Trip')).toBeNull();
  });

  it('restarts the timer for a new notice', () => {
    renderNotice();
    act(() => useUIStore.getState().showNotice({ message: 'First' }));
    act(() => vi.advanceTimersByTime(4000));
    act(() => useUIStore.getState().showNotice({ message: 'Second' }));
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('can be dismissed by hand', () => {
    renderNotice();
    act(() => useUIStore.getState().showNotice({ message: 'You joined Trip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('You joined Trip')).toBeNull();
  });
});
