import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GroupSettings from './GroupSettings';
import type { GroupDoc } from '../../types/models';

vi.mock('../../lib/converters', () => ({ groupsCol: {} }));

type MockFn<TArgs extends unknown[], TReturn> = ReturnType<typeof vi.fn> & ((...args: TArgs) => TReturn);
const mockUpdateDoc = vi.fn() as MockFn<[unknown, unknown], Promise<void>>;
const mockDoc = vi.fn(() => ({})) as MockFn<[unknown, unknown], object>;
vi.mock('firebase/firestore', () => ({
  updateDoc: (a: unknown, b: unknown) => mockUpdateDoc(a, b),
  doc: (a: unknown, b: unknown) => mockDoc(a, b),
  serverTimestamp: () => ({ _serverTimestamp: true }),
  arrayUnion: (v: unknown) => ({ _arrayUnion: v }),
  arrayRemove: (v: unknown) => ({ _arrayRemove: v }),
  deleteField: () => ({ _deleteField: true }),
}));

// Mock crypto.randomUUID
const mockUUID = 'aaaa-bbbb-cccc-dddd';
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: () => mockUUID },
  writable: true,
});

const ownerMember = { displayName: 'Alice', email: 'alice@example.com', role: 'owner', joinedAt: null };
const regularMember = { displayName: 'Bob', email: 'bob@example.com', role: 'member', joinedAt: null };

const group = {
  id: 'g1', name: 'Family', currency: 'AUD', ownerUid: 'u1',
  members: { u1: ownerMember, u2: regularMember },
  memberUids: ['u1', 'u2'],
  createdAt: null,
} as unknown as GroupDoc;

describe('GroupSettings', () => {
  beforeEach(() => {
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDoc.mockReturnValue({});
  });

  it('renders all current members', () => {
    render(<GroupSettings group={group} currentUserUid="u1" />);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('shows Add member form for owner', () => {
    render(<GroupSettings group={group} currentUserUid="u1" />);
    expect(screen.getByPlaceholderText(/jane smith/i)).toBeTruthy();
  });

  it('hides Add member form for non-owner', () => {
    render(<GroupSettings group={group} currentUserUid="u2" />);
    expect(screen.queryByPlaceholderText(/jane smith/i)).toBeNull();
  });

  it('calls updateDoc with manual member data when form submitted', async () => {
    render(<GroupSettings group={group} currentUserUid="u1" />);
    fireEvent.change(screen.getByPlaceholderText(/jane smith/i), { target: { value: 'Charlie' } });
    fireEvent.submit(screen.getByRole('button', { name: /add member/i }).closest('form')!);
    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          [`members.manual_${mockUUID}`]: expect.objectContaining({
            displayName: 'Charlie',
            manual: true,
            role: 'member',
          }),
        }),
      );
    });
  });

  it('shows remove button for non-owner members when viewed by owner', () => {
    render(<GroupSettings group={group} currentUserUid="u1" />);
    const removeButtons = screen.getAllByTitle('Remove member');
    expect(removeButtons.length).toBe(1); // only Bob can be removed
  });

  it('calls updateDoc with deleteField on remove', async () => {
    render(<GroupSettings group={group} currentUserUid="u1" />);
    fireEvent.click(screen.getByTitle('Remove member'));
    await waitFor(() => {
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ 'members.u2': expect.objectContaining({ _deleteField: true }) }),
      );
    });
  });
});
