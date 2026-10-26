import { CSV_MIME_TYPE } from '../csv';
import { downloadFile } from '../downloadFile';

/** Saves `csv` as `fileName`. */
export function downloadCsv(fileName: string, csv: string): void {
  downloadFile(fileName, csv, CSV_MIME_TYPE);
}
