import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingButton from './LoadingButton';

describe('LoadingButton', () => {
  it('renders children and is enabled when not loading', () => {
    render(<LoadingButton loading={false}>Save</LoadingButton>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).not.toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a spinner and loadingText, and disables the button, while loading', () => {
    render(
      <LoadingButton loading loadingText="Saving…">
        Save
      </LoadingButton>,
    );
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });

  it('falls back to children as the label while loading if no loadingText is given', () => {
    render(<LoadingButton loading>Save</LoadingButton>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('stays disabled while loading even if disabled=false is passed', () => {
    render(
      <LoadingButton loading disabled={false}>
        Save
      </LoadingButton>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('respects an explicit disabled prop when not loading', () => {
    render(
      <LoadingButton loading={false} disabled>
        Save
      </LoadingButton>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('forwards onClick and other button props', () => {
    const onClick = vi.fn();
    render(
      <LoadingButton loading={false} onClick={onClick} className="btn-primary">
        Save
      </LoadingButton>,
    );
    screen.getByRole('button').click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toHaveClass('btn-primary');
  });
});
