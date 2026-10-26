import { Download } from 'lucide-react';
import { exportGroupBackup } from '../../lib/exportActions';
import ExportMessage from '../export/ExportMessage';
import { useExportRun } from '../export/useExportRun';
import type { GroupDoc } from '../../types/models';

interface Props { group: GroupDoc; }

/** Downloads a JSON copy of everything in the group. Any member can. */
export default function BackupExport({ group }: Props) {
  const { busy, result, run } = useExportRun();

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-ink">Backup</h2>
      <div className="card space-y-3 p-4 sm:p-5">
        <p className="text-sm text-ink-muted">
          Download a copy of everything in this group as a file: expenses with their items,
          categories, income, settlements and autocomplete. Member emails are left out. The
          app can't restore from it yet.
        </p>
        <button
          type="button"
          onClick={() => void run(() => exportGroupBackup(group))}
          disabled={busy}
          className="btn-outline w-full sm:w-auto"
        >
          <Download size={14} />
          {busy ? 'Preparing…' : 'Download backup'}
        </button>
        <ExportMessage result={result} />
      </div>
    </section>
  );
}
