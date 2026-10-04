import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupSwitcher from './GroupSwitcher';
import { useUIStore } from '../stores/uiStore';
import { makeGroup } from '../test/fixtures';

const home = makeGroup('g1', 'Hartley House');
const trip = makeGroup('g2', 'Ski trip', ['Mike', 'Sam']);

beforeEach(() => useUIStore.setState({ selectedGroupId: 'g1' }));

describe('GroupSwitcher', () => {
  it('shows the selected group name and its members, viewer first', () => {
    render(<GroupSwitcher groups={[home, trip]} currentUid="priya" />);
    expect(screen.getByText('Hartley House', { selector: 'span' })).toBeInTheDocument();
    const initials = screen.getAllByTitle(/Mike|Priya/).map((el) => el.textContent);
    expect(initials).toEqual(['P', 'M']);
  });

  it('is a static label when there is only one group', () => {
    render(<GroupSwitcher groups={[home]} currentUid="mike" />);
    expect(screen.getByText('Hartley House')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('switches group from the native select when there are several', async () => {
    render(<GroupSwitcher groups={[home, trip]} currentUid="mike" />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Switch group' }), 'g2');
    expect(useUIStore.getState().selectedGroupId).toBe('g2');
  });
});
