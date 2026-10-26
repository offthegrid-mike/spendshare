import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagInput from './TagInput';
import { MAX_TAGS } from '../../lib/tags';

function Harness({ initial = [], onChange, hint }: { initial?: string[]; onChange?: (tags: string[]) => void; hint?: string }) {
  const [tags, setTags] = useState(initial);
  return (
    <TagInput
      id="tags"
      label="Tags"
      tags={tags}
      suggestions={['Holiday 2026', 'Renovation']}
      hint={hint}
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

  it('says when an item is full, and stops taking tags', () => {
    render(<Harness initial={Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`)} />);
    expect(screen.getByText(`${MAX_TAGS} tags is the most.`)).toBeInTheDocument();
    expect(field()).toBeDisabled();
  });

  it('does not add a tag on Enter while an input method is composing', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(field(), { target: { value: '街' } });
    fireEvent.keyDown(field(), { key: 'Enter', isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('turns pasted comma-separated text into separate tags', () => {
    render(<Harness />);
    fireEvent.change(field(), { target: { value: 'Holiday, Food, Snacks' } });
    expect(screen.getByText('Holiday')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
    expect(field()).toHaveValue(' Snacks');
  });

  it('describes the field with its hint', () => {
    render(<Harness hint="Tag single items from their own row." />);
    expect(field()).toHaveAccessibleDescription('Tag single items from their own row.');
  });
});
