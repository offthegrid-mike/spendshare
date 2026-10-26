import { downloadFile } from './downloadFile';
import { backupFileName, buildBackup } from './exportBackup';
import { buildExpensesCsv, csvFileName, type ExportPeriod } from './exportCsv';
import { ExportError, loadBackupData, loadPeriodData } from './exportData';
import { formatMonthLabel } from './month';
import type { GroupDoc } from '../types/models';

// An export end to end: read from the server, build the file, save it. Each
// returns what to tell the person rather than throwing.

export interface ExportResult {
  status: 'done' | 'empty' | 'error';
  message: string;
}

const CSV_TYPE = 'text/csv;charset=utf-8';
// Without it Excel reads a UTF-8 file as Windows-1252 and garbles non-Latin names.
const BYTE_ORDER_MARK = '﻿';

function periodLabel(period: ExportPeriod): string {
  return period.kind === 'month' ? formatMonthLabel(period.month) : period.year;
}

function failed(err: unknown): ExportResult {
  if (err instanceof ExportError) return { status: 'error', message: err.message };
  console.error('Export failed', err);
  return { status: 'error', message: "Couldn't create the file. Try again." };
}

/** Downloads the items of one month or year as a CSV. A period with no expenses saves nothing. */
export async function exportPeriodCsv(group: GroupDoc, period: ExportPeriod): Promise<ExportResult> {
  try {
    const { expenses, itemsByExpense } = await loadPeriodData(group.id, period);
    if (expenses.length === 0) {
      return { status: 'empty', message: `No expenses in ${periodLabel(period)} to export.` };
    }
    const fileName = csvFileName(group, period);
    downloadFile(fileName, BYTE_ORDER_MARK + buildExpensesCsv(group, expenses, itemsByExpense), CSV_TYPE);
    return { status: 'done', message: `Downloaded ${fileName}` };
  } catch (err) {
    return failed(err);
  }
}

/** Downloads everything in the group as a JSON backup. */
export async function exportGroupBackup(group: GroupDoc, now: Date = new Date()): Promise<ExportResult> {
  try {
    const data = await loadBackupData(group.id);
    const fileName = backupFileName(group, now);
    downloadFile(fileName, JSON.stringify(buildBackup({ group, ...data }, now), null, 2), 'application/json');
    return { status: 'done', message: `Downloaded ${fileName}` };
  } catch (err) {
    return failed(err);
  }
}
