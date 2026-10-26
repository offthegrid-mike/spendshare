import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagInput from './TagInput';

function Harness({ initial = [], onChange }: { initial?: string[]; onChange?: (tags: string[]) => void }) {
  const [tags, setTags] = useState(initial);
  return (
    <TagInput
      id="tags"
      label="Tags"
      tags={tags}
      suggestions={['Holiday 2026', 'Renovation']}
      onChange={(next) => {
        setTags(next);
        onChange?.(next);
      }}
    />
  );
}

const field = () => screen.getByRole('combobox', { name: /^Tags/ });

describe('TagInput', () => {
  it('adds a tag with Enter, and another with a comma', async () => {
    render(<Harness />);
    await userEvent.type(field(), 'Holiday 2026{Enter}');
    await userEvent.type(field(), 'Food,');
    expect(screen.getByText('Holiday 2026')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(field()).toHaveValue('');
  });

  it('does not submit the form on Enter', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Harness />
      </form>,
    );
    await userEvent.type(field(), 'Holiday{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('skips a tag it already has in another case', async () => {
    const onChange = vi.fn();
    render(<Harness initial={['Holiday']} onChange={onChange} />);
    await userEvent.type(field(), 'holiday{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByText(/holiday/i)).toHaveLength(1);
  });

  it('removes a tag with its × button', async () => {
    render(<Harness initial={['Holiday', 'Food']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove tag Holiday' }));
    expect(screen.queryByText('Holiday')).toBeNull();
    expect(screen.getByText('Food')).toBeInTheDocument();
  });

  it('removes the last tag with Backspace in an empty field', async () => {
    render(<Harness initial={['Holiday', 'Food']} />);
    await userEvent.type(field(), '{Backspace}');
    expect(screen.queryByText('Food')).toBeNull();
    expect(screen.getByText('Holiday')).toBeInTheDocument();
  });

  it('adds what is typed when the field loses focus', async () => {
    render(<Harness />);
    await userEvent.type(field(), 'Renovation');
    await userEvent.tab();
    expect(screen.getByText('Renovation')).toBeInTheDocument();
  });

  it('offers earlier tags it does not already have', () => {
    render(<Harness initial={['Renovation']} />);
    const options = [...document.querySelectorAll('#tags-suggestions option')].map((o) => o.getAttribute('value'));
    expect(options).toEqual(['Holiday 2026']);
  });
});
