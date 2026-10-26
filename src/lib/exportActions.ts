import { CSV_MIME_TYPE } from './csv';
import { downloadFile } from './downloadFile';
import { buildBackup } from './exportBackup';
import { buildExpensesCsv } from './exportCsv';
import { ExportError, loadBackupData, loadPeriodData } from './exportData';
import { backupFileName, csvFileName, periodLabel, type ExportPeriod } from './exportNames';
import type { GroupDoc } from '../types/models';

// An export end to end: read from the server, build the file, save it. Each
// returns what to tell the person rather than throwing.

export interface ExportResult {
  status: 'done' | 'empty' | 'error';
  message: string;
}

// Without it Excel reads a UTF-8 file as Windows-1252 and garbles non-Latin names.
const BYTE_ORDER_MARK = '﻿';

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
    downloadFile(fileName, BYTE_ORDER_MARK + buildExpensesCsv(group, expenses, itemsByExpense), CSV_MIME_TYPE);
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
