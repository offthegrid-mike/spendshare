import { describe, it, expect, vi, beforeEach } from 'vitest';

const { loadPeriodData, loadBackupData, downloadFile } = vi.hoisted(() => ({
  loadPeriodData: vi.fn(),
  loadBackupData: vi.fn(),
  downloadFile: vi.fn(),
}));

vi.mock('./exportData', () => {
  class ExportError extends Error {}
  return { ExportError, loadPeriodData, loadBackupData };
});
vi.mock('./downloadFile', () => ({ downloadFile }));

import { ExportError } from './exportData';
import { exportGroupBackup, exportPeriodCsv } from './exportActions';
import { makeExpense, makeGroup, makeItem } from '../test/fixtures';

const group = makeGroup('g1', 'Hartley House');
const month = { kind: 'month', month: '2026-10' } as const;
const year = { kind: 'year', year: '2026' } as const;

const e1 = makeExpense('e1', { shopName: 'Coles' });
const periodData = { expenses: [e1], itemsByExpense: { e1: [makeItem('i1', 'e1', { name: 'Oat milk' })] } };

beforeEach(() => {
  vi.clearAllMocks();
  downloadFile.mockReset();
  loadPeriodData.mockResolvedValue(periodData);
  loadBackupData.mockResolvedValue({
    expenses: [e1], itemsByExpense: periodData.itemsByExpense, categories: [], income: [], settlements: [], suggestions: null,
  });
});

describe('exportPeriodCsv', () => {
  it('reads the period and saves a CSV named for the group and period', async () => {
    const result = await exportPeriodCsv(group, month);
    expect(loadPeriodData).toHaveBeenCalledWith('g1', month);
    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [name, content, type] = downloadFile.mock.calls[0];
    expect(name).toBe('spendshare-hartley-house-2026-10.csv');
    expect(type).toBe('text/csv;charset=utf-8');
    expect(content).toContain('Oat milk');
    expect(result).toEqual({ status: 'done', message: 'Downloaded spendshare-hartley-house-2026-10.csv' });
  });

  it('starts the file with a byte-order mark, so a spreadsheet reads the names as UTF-8', async () => {
    await exportPeriodCsv(group, year);
    const [name, content] = downloadFile.mock.calls[0];
    expect(name).toBe('spendshare-hartley-house-2026.csv');
    expect(content.startsWith('﻿date,shop,paid_by,')).toBe(true);
  });

  it('saves nothing, and says so, when the period has no expenses', async () => {
    loadPeriodData.mockResolvedValue({ expenses: [], itemsByExpense: {} });
    expect(await exportPeriodCsv(group, month)).toEqual({ status: 'empty', message: 'No expenses in October 2026 to export.' });
    expect(await exportPeriodCsv(group, year)).toEqual({ status: 'empty', message: 'No expenses in 2026 to export.' });
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('passes on a failure to read, with its message, and saves nothing', async () => {
    loadPeriodData.mockRejectedValue(new ExportError("Couldn't reach the server. Check your connection and try again."));
    expect(await exportPeriodCsv(group, month)).toEqual({
      status: 'error',
      message: "Couldn't reach the server. Check your connection and try again.",
    });
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('gives a plain message for anything unexpected, such as the save failing, and logs the detail', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    downloadFile.mockImplementation(() => { throw new Error('boom: internal detail'); });
    const result = await exportPeriodCsv(group, month);
    expect(result).toEqual({ status: 'error', message: "Couldn't create the file. Try again." });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('exportGroupBackup', () => {
  const now = new Date(2026, 9, 26, 12);

  it('reads the whole group and saves it as a JSON file named for the group and day', async () => {
    const result = await exportGroupBackup(group, now);
    expect(loadBackupData).toHaveBeenCalledWith('g1');
    const [name, content, type] = downloadFile.mock.calls[0];
    expect(name).toBe('spendshare-hartley-house-backup-2026-10-26.json');
    expect(type).toBe('application/json');
    const backup = JSON.parse(content);
    expect(backup).toMatchObject({ schemaVersion: 1, group: { id: 'g1', name: 'Hartley House' } });
    expect(backup.expenses[0]).toMatchObject({ id: 'e1', items: [{ id: 'i1', name: 'Oat milk' }] });
    expect(result).toEqual({ status: 'done', message: 'Downloaded spendshare-hartley-house-backup-2026-10-26.json' });
  });

  it('leaves member emails out of the file', async () => {
    await exportGroupBackup(group, now);
    expect(downloadFile.mock.calls[0][1]).not.toContain('@');
  });

  it('passes on a failure to read, and saves nothing', async () => {
    loadBackupData.mockRejectedValue(new ExportError("Couldn't read your data to export it. Try again."));
    expect(await exportGroupBackup(group, now)).toEqual({ status: 'error', message: "Couldn't read your data to export it. Try again." });
    expect(downloadFile).not.toHaveBeenCalled();
  });
});
