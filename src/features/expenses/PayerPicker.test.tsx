import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PayerPicker from './PayerPicker';
import { makeGroup } from '../../test/fixtures';

const pair = makeGroup('g1', 'Home'); // mike, priya
const five = makeGroup('g2', 'Big', ['Mike', 'Priya', 'Sam', 'Ana', 'Lee']);

describe('PayerPicker', () => {
  it('offers members as radio pills, calling the viewer "You"', () => {
    render(<PayerPicker group={pair} viewerUid="mike" value="mike" onChange={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: 'Paid by' });
    expect(within(group).getByRole('radio', { name: /You/ })).toBeChecked();
    expect(within(group).getByRole('radio', { name: /Priya/ })).not.toBeChecked();
  });

  it('reports the chosen payer', async () => {
    const onChange = vi.fn();
    render(<PayerPicker group={pair} viewerUid="mike" value="mike" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: /Priya/ }));
    expect(onChange).toHaveBeenCalledWith('priya');
  });

  it('falls back to a select above four members', async () => {
    const onChange = vi.fn();
    render(<PayerPicker group={five} viewerUid="mike" value="mike" onChange={onChange} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    const select = screen.getByRole('combobox', { name: 'Paid by' });
    await userEvent.selectOptions(select, 'sam');
    expect(onChange).toHaveBeenCalledWith('sam');
  });

  it('keeps a payer who has left the group as a choice', () => {
    render(<PayerPicker group={pair} viewerUid="mike" value="ghost" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: /ghost/ })).toBeChecked();
  });
});
