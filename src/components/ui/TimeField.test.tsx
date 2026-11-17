import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeField from './TimeField';
import { parseTime } from '../../lib/parseTime';

describe('parseTime', () => {
  it.each([
    ['08:30', '08:30'],
    ['8:30', '08:30'],
    ['830', '08:30'],
    ['0830', '08:30'],
    ['23:59', '23:59'],
  ])('reads %s as %s', (text, out) => expect(parseTime(text)).toBe(out));

  it.each(['', '8', '24:00', '12:60', 'ab:cd', '8:3'])('rejects %j', (text) => {
    expect(parseTime(text)).toBeNull();
  });
});

describe('TimeField', () => {
  it('is a text field, not a native time input', () => {
    render(<TimeField id="t" value="08:30" onChange={() => {}} pickerLabel="Pick time" />);
    expect(screen.getByDisplayValue('08:30')).toHaveAttribute('type', 'text');
  });

  it('reports a valid typed time and ignores a half-typed one', () => {
    const onChange = vi.fn();
    render(<TimeField id="t" value="" onChange={onChange} pickerLabel="Pick time" />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '8:3' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '8:30' } });
    expect(onChange).toHaveBeenCalledWith('08:30');
  });

  it('reports an empty value when cleared', () => {
    const onChange = vi.fn();
    render(<TimeField id="t" value="08:30" onChange={onChange} pickerLabel="Pick time" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('follows the value when the parent changes it', () => {
    const { rerender } = render(<TimeField id="t" value="08:30" onChange={() => {}} pickerLabel="Pick time" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '9:15' } });
    rerender(<TimeField id="t" value="17:00" onChange={() => {}} pickerLabel="Pick time" />);
    expect(screen.getByRole('textbox')).toHaveValue('17:00');
  });

  it('picks hour then minute from the popover', async () => {
    const onChange = vi.fn();
    render(<TimeField id="t" value="08:30" onChange={onChange} pickerLabel="Pick time" />);
    await userEvent.click(screen.getByRole('button', { name: 'Pick time' }));
    await userEvent.click(screen.getByRole('option', { name: '14' }));
    expect(onChange).toHaveBeenLastCalledWith('14:30');
    await userEvent.click(screen.getByRole('option', { name: '45' }));
    expect(onChange).toHaveBeenLastCalledWith('08:45');
  });
});
