import { useState } from 'react';
import { deleteField, doc, setDoc, updateDoc } from 'firebase/firestore';
import { categoriesCol } from '../../lib/converters';
import { hasBudget, parseBudgetInput } from '../../lib/budget';
import { formatMoney, plainSigned } from '../../lib/money';
import { useCategories } from '../../hooks/useCategories';
import { useGroup } from '../../hooks/useGroup';
import { useUIStore } from '../../stores/uiStore';
import LoadingButton from '../../components/LoadingButton';
import CategoryTile from '../../components/ui/CategoryTile';
import { iconForCategory } from '../../lib/categoryIcons';
import type { CategoryDoc } from '../../types/models';

export default function CategoryManager() {
  const { selectedGroupId: gid } = useUIStore();
  const { all, loading } = useCategories(gid);
  const { group } = useGroup(gid);

  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  // Budget edits are one-at-a-time with renames, so each start closes the other.
  const [budgetEditingId, setBudgetEditingId] = useState<string | null>(null);
  const [budgetText, setBudgetText] = useState('');
  const [error, setError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [archivingIds, setArchivingIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!gid) return;
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError('');
    try {
      const maxOrder = all.length > 0 ? Math.max(...all.map((c) => c.order)) : -1;
      const newRef = doc(categoriesCol(gid));
      const newDoc: CategoryDoc = {
        id: newRef.id,
        name,
        order: maxOrder + 1,
        archived: false,
      };
      await setDoc(newRef, newDoc);
      setNewName('');
    } catch {
      setError('Failed to add category.');
    } finally {
      setAdding(false);
    }
  }

  function startEdit(cat: CategoryDoc) {
    setBudgetEditingId(null);
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  function startBudgetEdit(cat: CategoryDoc) {
    setEditingId(null);
    setError('');
    setBudgetEditingId(cat.id);
    setBudgetText(hasBudget(cat) ? plainSigned(cat.monthlyBudget) : '');
  }

  function cancelBudgetEdit() {
    setBudgetEditingId(null);
    setError('');
  }

  /** Blank (or Remove) takes the budget off; an amount sets it in whole cents. */
  async function saveBudget(cat: CategoryDoc, text: string) {
    if (!gid || savingEdit) return;
    const parsed = parseBudgetInput(text);
    if (parsed === 'invalid') {
      setError('Enter an amount like 400 or 400.50.');
      return;
    }
    setError('');
    // Nothing to remove from a category that has no budget.
    if (parsed === null && cat.monthlyBudget === undefined) {
      setBudgetEditingId(null);
      return;
    }
    setSavingEdit(true);
    try {
      await updateDoc(doc(categoriesCol(gid), cat.id), { monthlyBudget: parsed === null ? deleteField() : parsed });
      setBudgetEditingId(null);
    } catch {
      setError('Failed to save budget.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveEdit(cat: CategoryDoc) {
    if (!gid || savingEdit) return;
    const name = editName.trim();
    if (!name) {
      setError('Name cannot be empty.');
      return;
    }
    setError('');
    setSavingEdit(true);
    try {
      await updateDoc(doc(categoriesCol(gid), cat.id), { name });
      setEditingId(null);
    } catch {
      setError('Failed to rename category.');
    } finally {
      setSavingEdit(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
  }

  async function toggleArchive(cat: CategoryDoc) {
    if (!gid) return;
    setError('');
    setArchivingIds((prev) => new Set(prev).add(cat.id));
    try {
      await updateDoc(doc(categoriesCol(gid), cat.id), { archived: !cat.archived });
    } catch {
      setError('Failed to update category.');
    } finally {
      setArchivingIds((prev) => {
        const next = new Set(prev);
        next.delete(cat.id);
        return next;
      });
    }
  }

  if (!gid) return <div className="p-4 text-ink-muted">No group selected.</div>;
  if (loading) return <div className="p-4 text-ink-muted">Loading…</div>;

  const activeCategories = all.filter((category) => !category.archived);
  const archivedCategories = all.filter((category) => category.archived);
  const visibleCategories = showArchived ? all : activeCategories;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h2 className="text-xl font-semibold tracking-tight text-ink">Categories</h2>

      {error && <p className="text-sm text-negative">{error}</p>}

      <div className="card overflow-hidden">
        <ul className="divide-y divide-line">
        {visibleCategories.length === 0 && (
          <li className="px-4 py-3 text-sm text-ink-muted">No categories yet.</li>
        )}
        {visibleCategories.map((cat) => (
          <li
            key={cat.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${cat.archived ? 'bg-recessed/60' : ''}`}
          >
            <CategoryTile icon={iconForCategory(cat.name)} label={cat.name} />
            {budgetEditingId === cat.id ? (
              <>
                <input
                  type="text"
                  inputMode="decimal"
                  value={budgetText}
                  onChange={(e) => setBudgetText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveBudget(cat, budgetText);
                    if (e.key === 'Escape') cancelBudgetEdit();
                  }}
                  aria-label={`Monthly budget for ${cat.name}`}
                  placeholder="No budget"
                  autoFocus
                  disabled={savingEdit}
                  className="field min-w-0 flex-1 basis-32 py-1 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <div className="ml-auto flex items-center gap-2">
                  <LoadingButton
                    loading={savingEdit}
                    loadingText="Saving…"
                    onClick={() => void saveBudget(cat, budgetText)}
                    className="btn-primary h-8 px-3 text-xs"
                  >
                    Save
                  </LoadingButton>
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={cancelBudgetEdit}
                    className="btn-outline h-8 px-3 text-xs"
                  >
                    Cancel
                  </button>
                  {hasBudget(cat) && (
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => void saveBudget(cat, '')}
                      aria-label={`Remove budget for ${cat.name}`}
                      className="btn-ghost h-8 px-2.5 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </>
            ) : editingId === cat.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveEdit(cat);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  autoFocus
                  disabled={savingEdit}
                  className="field min-w-0 flex-1 basis-32 py-1 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <div className="ml-auto flex items-center gap-2">
                  <LoadingButton
                    loading={savingEdit}
                    loadingText="Saving…"
                    onClick={() => void saveEdit(cat)}
                    className="btn-primary h-8 px-3 text-xs"
                  >
                    Save
                  </LoadingButton>
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={cancelEdit}
                    className="btn-outline h-8 px-3 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <span
                  className={`min-w-0 flex-1 basis-28 text-sm ${
                    cat.archived ? 'text-ink-faint line-through' : 'text-ink'
                  }`}
                >
                  {cat.name}
                  {cat.archived && (
                    <span className="ml-2 rounded-full bg-recessed px-2 py-0.5 text-xs font-medium text-ink-muted">
                      archived
                    </span>
                  )}
                  {!cat.archived && hasBudget(cat) && group && (
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      Budget <span className="money">{formatMoney(cat.monthlyBudget, group.currency)}</span> a month
                    </span>
                  )}
                </span>
                {/* ml-auto keeps the buttons to the right, on their own line when the row is too narrow for all three. */}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={() => startEdit(cat)}
                    className="btn-outline h-8 px-3 text-xs"
                  >
                    Rename
                  </button>
                  {!cat.archived && (
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => startBudgetEdit(cat)}
                      aria-label={`Budget for ${cat.name}`}
                      className="btn-outline h-8 px-3 text-xs"
                    >
                      Budget
                    </button>
                  )}
                  <LoadingButton
                    loading={archivingIds.has(cat.id)}
                    loadingText={cat.archived ? 'Unarchiving…' : 'Archiving…'}
                    onClick={() => void toggleArchive(cat)}
                    className="btn-outline h-8 px-3 text-xs"
                  >
                    {cat.archived ? 'Unarchive' : 'Archive'}
                  </LoadingButton>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {archivedCategories.length > 0 && (
        <button
          type="button"
          onClick={() => setShowArchived((shown) => !shown)}
          className="btn-ghost mx-2 mb-2"
          aria-expanded={showArchived}
        >
          Archived ({archivedCategories.length})
        </button>
      )}
      <form onSubmit={(e) => void handleAdd(e)} className="flex gap-2 border-t border-line p-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="field flex-1"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="btn-primary"
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>
      </div>
    </div>
  );
}
