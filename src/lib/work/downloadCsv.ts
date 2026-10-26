import { downloadFile } from '../downloadFile';

/** Saves `csv` as `fileName`. */
export function downloadCsv(fileName: string, csv: string): void {
  downloadFile(fileName, csv, 'text/csv;charset=utf-8');
}
