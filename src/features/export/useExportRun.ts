import { useState } from 'react';
import type { ExportResult } from '../../lib/exportActions';

/**
 * The state of an export button: whether it is working and what it last said.
 * The message belongs to `scope` (the month on screen, say) and is only shown
 * while that is still what's on screen, so a month's message never sits under
 * another month, even if the export finishes after the person has moved on.
 */
export function useExportRun(scope = '') {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ scope: string; result: ExportResult } | null>(null);

  async function run(job: () => Promise<ExportResult>) {
    if (busy) return;
    setBusy(true);
    setLast(null);
    try {
      setLast({ scope, result: await job() });
    } finally {
      setBusy(false);
    }
  }

  return { busy, result: last?.scope === scope ? last.result : null, run };
}
