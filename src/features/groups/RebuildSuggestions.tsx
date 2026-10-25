import { useMemo, useState } from 'react';
import { getDocFromServer, writeBatch } from 'firebase/firestore';
import { RefreshCw } from 'lucide-react';
import { db } from '../../lib/firebase';
import { suggestionsDocRef } from '../../lib/converters';
import { countSuggestionChanges, recountSuggestions, type SuggestionLists } from '../../lib/suggestions';
import { stageSuggestions } from '../../lib/suggestionsWrite';
import { useAllExpenses } from '../../hooks/useAllExpenses';
import { writeCache } from '../../hooks/useItemSuggestions';
import ConfirmDialog from '../../components/ConfirmDialog';

interface Props { groupId: string; }

/** The stored suggestions as read for one run: the lists, or the read failed. */
type Stored = SuggestionLists | 'failed' | null;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Recounts the group's autocomplete suggestions from its whole expense history
 * and, after a confirm, replaces the stored counts with the recount. Repairs
 * counts that drifted, for example from deletes made before they were counted.
 */
export default function RebuildSuggestions({ groupId }: Props) {
  // Each run remounts RebuildRun, so the history is fetched again rather than
  // reused from an earlier run.
  const [run, setRun] = useState(0);
  const [stored, setStored] = useState<{ run: number; value: Stored }>({ run: 0, value: null });

  function start() {
    const next = run + 1;
    setRun(next);
    // From the server, never the local cache: the recount replaces what is stored.
    getDocFromServer(suggestionsDocRef(groupId))
      .then((snap) => {
        const data = snap.exists() ? snap.data() : null;
        setStored({ run: next, value: { items: data?.items ?? [], shops: data?.shops ?? [] } });
      })
      .catch(() => setStored({ run: next, value: 'failed' }));
  }

  return (
    <RebuildRun
      key={run}
      groupId={groupId}
      active={run > 0}
      stored={stored.run === run ? stored.value : null}
      onStart={start}
    />
  );
}

interface RunProps {
  groupId: string;
  active: boolean;
  stored: Stored;
  onStart: () => void;
}

function RebuildRun({ groupId, active, stored, onStart }: RunProps) {
  const [outcome, setOutcome] = useState<'cancelled' | 'rebuilt' | 'failed' | null>(null);
  const [saving, setSaving] = useState(false);
  const history = useAllExpenses(active ? groupId : null);

  const recount = useMemo(
    () => (active && !history.loading && !history.error
      ? recountSuggestions(history.expenses, history.itemsByExpense)
      : null),
    [active, history.loading, history.error, history.expenses, history.itemsByExpense],
  );
  const current = stored === 'failed' ? null : stored;
  const changes = recount && current ? countSuggestionChanges(current, recount) : null;
  const upToDate = changes !== null && changes.items === 0 && changes.shops === 0;
  const pending = active && outcome === null;
  const loading = pending && !history.error && stored !== 'failed' && changes === null;

  async function rebuild() {
    if (!recount) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      stageSuggestions(batch, groupId, recount);
      await batch.commit();
      writeCache(groupId, recount.items, recount.shops);
      setOutcome('rebuilt');
    } catch {
      setOutcome('failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-ink">Autocomplete</h2>
      <div className="card space-y-3 p-4 sm:p-5">
        <p className="text-sm text-ink-muted">
          Shop and item suggestions are ranked by how often they appear. If they look off,
          recount them from every expense in this group.
        </p>
        <button type="button" onClick={onStart} disabled={loading || saving} className="btn-outline w-full sm:w-auto">
          <RefreshCw size={14} />
          {loading ? 'Counting…' : 'Rebuild autocomplete'}
        </button>
        {pending && history.error && <p className="text-xs text-negative">{history.error}</p>}
        {pending && stored === 'failed' && (
          <p className="text-xs text-negative">Could not load autocomplete. Please try again.</p>
        )}
        {pending && upToDate && <p className="text-xs text-ink-muted">Autocomplete is already up to date.</p>}
        {outcome === 'rebuilt' && <p className="text-xs text-ink-muted">Autocomplete rebuilt.</p>}
        {outcome === 'failed' && <p className="text-xs text-negative">Failed to rebuild. Please try again.</p>}
      </div>
      <ConfirmDialog
        open={pending && changes !== null && !upToDate}
        title="Rebuild autocomplete?"
        message={changes
          ? `Recounting from ${plural(history.expenses.length, 'expense')} changes ${plural(changes.items, 'item suggestion')} and ${plural(changes.shops, 'shop suggestion')}.`
          : ''}
        confirmLabel={saving ? 'Rebuilding…' : 'Rebuild'}
        confirmDisabled={saving}
        tone="primary"
        onConfirm={() => void rebuild()}
        onCancel={() => setOutcome('cancelled')}
      />
    </section>
  );
}
