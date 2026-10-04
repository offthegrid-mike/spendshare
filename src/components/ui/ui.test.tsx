import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShoppingBasket } from 'lucide-react';
import Avatar, { AvatarStack } from './Avatar';
import { initialOf } from '../../lib/initials';
import SegmentedControl from './SegmentedControl';
import CategoryTile from './CategoryTile';
import Chip from './Chip';
import Skeleton from './Skeleton';

describe('initialOf', () => {
  it('uppercases the first letter', () => {
    expect(initialOf('priya')).toBe('P');
  });

  it('ignores leading whitespace', () => {
    expect(initialOf('  mike')).toBe('M');
  });

  it('falls back to ? for a blank name', () => {
    expect(initialOf('   ')).toBe('?');
  });
});

describe('Avatar', () => {
  it('shows the initial and names the person for assistive tech', () => {
    render(<Avatar name="Priya" tone="them" />);
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.getByTitle('Priya')).toBeInTheDocument();
  });
});

describe('AvatarStack', () => {
  it('shows up to max avatars then a +N overflow', () => {
    render(
      <AvatarStack
        max={2}
        people={[
          { name: 'Mike', isMe: true },
          { name: 'Priya', isMe: false },
          { name: 'Sam', isMe: false },
        ]}
      />,
    );
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
    expect(screen.queryByText('S')).toBeNull();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
  ];

  it('is a labelled group with the active option pressed', () => {
    render(<SegmentedControl label="Pick" options={options} value="b" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Pick' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the chosen option', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Pick" options={options} value="b" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onChange).toHaveBeenCalledWith('a');
  });
});

describe('CategoryTile', () => {
  it('renders the icon when given one', () => {
    const { container } = render(<CategoryTile icon={ShoppingBasket} label="Groceries" />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.queryByText('G')).toBeNull();
  });

  it('falls back to the first letter of the label', () => {
    render(<CategoryTile label="pets" />);
    expect(screen.getByText('P')).toBeInTheDocument();
  });
});

describe('Chip and Skeleton', () => {
  it('Chip renders its text', () => {
    render(<Chip>Personal</Chip>);
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('Skeleton is hidden from assistive tech', () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
