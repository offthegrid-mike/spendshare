import { useState } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { categoriesCol } from '../../lib/converters';
import { useCategories } from '../../hooks/useCategories';
import { useUIStore } from '../../stores/uiStore';
import type { CategoryDoc } from '../../types/models';

export default function CategoryManager() {
  const { selectedGroupId: gid } = useUIStore();
  const { all, loading } = useCategories(gid);

  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

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
    if (!gid) return;
    const name = editName.trim();
    if (!name) {
      setError('Name cannot be empty.');
      return;
    }
    setError('');
    try {
      await updateDoc(doc(categoriesCol(gid), cat.id), { name });
      setEditingId(null);
    } catch {
      setError('Failed to rename category.');
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
  }

  async function toggleArchive(cat: CategoryDoc) {
    if (!gid) return;
    setError('');
    try {
      await updateDoc(doc(categoriesCol(gid), cat.id), { archived: !cat.archived });
    } catch {
      setError('Failed to update category.');
    }
  }

  if (!gid) return <div className="p-4 text-gray-500">No group selected.</div>;
  if (loading) return <div className="p-4 text-gray-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">Categories</h2>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <ul className="mb-6 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {all.length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-400">No categories yet.</li>
        )}
        {all.map((cat) => (
          <li
            key={cat.id}
            className={`flex items-center gap-3 px-4 py-3 ${cat.archived ? 'bg-gray-50' : ''}`}
          >
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
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="button"
                  onClick={() => void saveEdit(cat)}
                  className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span
                  className={`flex-1 text-sm ${
                    cat.archived ? 'text-gray-400 line-through' : 'text-gray-800'
                  }`}
                >
                  {cat.name}
                  {cat.archived && (
                    <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-500">
                      archived
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => startEdit(cat)}
                  className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => void toggleArchive(cat)}
                  className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  {cat.archived ? 'Unarchive' : 'Archive'}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={(e) => void handleAdd(e)} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>
    </div>
  );
}
