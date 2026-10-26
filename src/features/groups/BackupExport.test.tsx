import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeGroup } from '../../test/fixtures';

const { exportGroupBackup } = vi.hoisted(() => ({ exportGroupBackup: vi.fn() }));
vi.mock('../../lib/exportActions', () => ({ exportGroupBackup }));

import BackupExport from './BackupExport';

const group = makeGroup('g1', 'Hartley House');

beforeEach(() => {
  vi.clearAllMocks();
  exportGroupBackup.mockResolvedValue({ status: 'done', message: 'Downloaded spendshare-hartley-house-backup-2026-10-26.json' });
});

describe('BackupExport', () => {
  it('explains what the backup holds, and what it leaves out', () => {
    render(<BackupExport group={group} />);
    expect(screen.getByRole('heading', { name: 'Backup' })).toBeInTheDocument();
    expect(screen.getByText(/member emails are left out/i)).toBeInTheDocument();
  });

  it('downloads the backup of the group and says what was saved', async () => {
    render(<BackupExport group={group} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(exportGroupBackup).toHaveBeenCalledWith(group);
    expect(await screen.findByText('Downloaded spendshare-hartley-house-backup-2026-10-26.json')).toBeInTheDocument();
  });

  it('is busy while it works, so it cannot be started twice', async () => {
    let finish: (r: { status: 'done'; message: string }) => void = () => {};
    exportGroupBackup.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<BackupExport group={group} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download backup' }));
    const busy = screen.getByRole('button', { name: 'Preparing…' });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(exportGroupBackup).toHaveBeenCalledTimes(1);
    finish({ status: 'done', message: 'Downloaded it' });
    expect(await screen.findByText('Downloaded it')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download backup' })).toBeEnabled();
  });

  it('shows a failure where it can be read', async () => {
    exportGroupBackup.mockResolvedValue({ status: 'error', message: "Couldn't reach the server. Check your connection and try again." });
    render(<BackupExport group={group} />);
    await userEvent.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText(/couldn't reach the server/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/couldn't reach the server/i);
  });
});
