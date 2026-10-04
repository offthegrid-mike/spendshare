import { useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { categoriesCol } from '../../lib/converters';
import { useCategories } from '../../hooks/useCategories';
import { useUIStore } from '../../stores/uiStore';
import LoadingButton from '../../components/LoadingButton';
import CategoryTile from '../../components/ui/CategoryTile';
import { iconForCategory } from '../../lib/categoryIcons';
import type { CategoryDoc } from '../../types/models';

export default function CategoryManager() {
  const { selectedGroupId: gid } = useUIStore();
  const { all, loading } = useCategories(gid);

  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
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
    setEditingId(cat.id);
    setEditName(cat.name);
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
            className={`flex items-center gap-3 px-4 py-3 ${cat.archived ? 'bg-recessed/60' : ''}`}
          >
            <CategoryTile icon={iconForCategory(cat.name)} label={cat.name} />
            {editingId === cat.id ? (
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
                  className="field flex-1 py-1 disabled:cursor-not-allowed disabled:opacity-60"
                />
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
              </>
            ) : (
              <>
                <span
                  className={`flex-1 text-sm ${
                    cat.archived ? 'text-ink-faint line-through' : 'text-ink'
                  }`}
                >
                  {cat.name}
                  {cat.archived && (
                    <span className="ml-2 rounded-full bg-recessed px-2 py-0.5 text-xs font-medium text-ink-muted">
                      archived
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => startEdit(cat)}
                  className="btn-outline h-8 px-3 text-xs"
                >
                  Rename
                </button>
                <LoadingButton
                  loading={archivingIds.has(cat.id)}
                  loadingText={cat.archived ? 'Unarchiving…' : 'Archiving…'}
                  onClick={() => void toggleArchive(cat)}
                  className="btn-outline h-8 px-3 text-xs"
                >
                  {cat.archived ? 'Unarchive' : 'Archive'}
                </LoadingButton>
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
