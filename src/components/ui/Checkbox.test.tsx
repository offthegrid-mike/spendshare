import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Checkbox from './Checkbox';

describe('Checkbox', () => {
  it('stays an accessible checkbox named by its label', async () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange}>Shared</Checkbox>);
    const box = screen.getByRole('checkbox', { name: 'Shared' });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalled();
  });

  it('draws its own box instead of the native control', () => {
    const { container } = render(<Checkbox checked onChange={() => {}}>Shared</Checkbox>);
    expect(screen.getByRole('checkbox')).toHaveClass('sr-only');
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
