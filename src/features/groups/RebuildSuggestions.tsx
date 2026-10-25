import { useMemo, useState } from 'react';
import { getDoc, writeBatch } from 'firebase/firestore';
import { RefreshCw } from 'lucide-react';
import { db } from '../../lib/firebase';
import { suggestionsDocRef } from '../../lib/converters';
import { countSuggestionChanges, rebuildSuggestions, type SuggestionLists } from '../../lib/suggestions';
import { stageSuggestions } from '../../lib/suggestionsWrite';
import { useAllExpenses } from '../../hooks/useAllExpenses';
import { writeCache } from '../../hooks/useItemSuggestions';
import ConfirmDialog from '../../components/ConfirmDialog';

interface Props { groupId: string; }

type Outcome = 'cancelled' | 'rebuilt' | 'failed';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Recounts the group's autocomplete suggestions from its whole expense history
 * and, after a confirm, replaces the stored counts with the recount. Repairs
 * counts that drifted, for example from deletes made before they were counted.
 */
export default function RebuildSuggestions({ groupId }: Props) {
  const [requested, setRequested] = useState(false);
  const [current, setCurrent] = useState<SuggestionLists | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saving, setSaving] = useState(false);
  const history = useAllExpenses(requested ? groupId : null);

  const recount = useMemo(
    () => (requested && !history.loading && !history.error
      ? rebuildSuggestions(history.expenses, history.itemsByExpense)
      : null),
    [requested, history.loading, history.error, history.expenses, history.itemsByExpense],
  );
  const changes = recount && current ? countSuggestionChanges(current, recount) : null;
  const upToDate = changes !== null && changes.items === 0 && changes.shops === 0;
  const pending = requested && outcome === null;
  const loading = pending && !history.error && changes === null;

  function start() {
    setRequested(true);
    setCurrent(null);
    setOutcome(null);
    // Read the stored counts from the server: the cached copy can be a day old.
    getDoc(suggestionsDocRef(groupId))
      .then((snap) => {
        const data = snap.exists() ? snap.data() : null;
        setCurrent({ items: data?.items ?? [], shops: data?.shops ?? [] });
      })
      .catch(() => setOutcome('failed'));
  }

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
        <button type="button" onClick={start} disabled={loading || saving} className="btn-outline w-full sm:w-auto">
          <RefreshCw size={14} />
          {loading ? 'Counting…' : 'Rebuild autocomplete'}
        </button>
        {pending && history.error && <p className="text-xs text-negative">{history.error}</p>}
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
        onConfirm={rebuild}
        onCancel={() => setOutcome('cancelled')}
      />
    </section>
  );
}
