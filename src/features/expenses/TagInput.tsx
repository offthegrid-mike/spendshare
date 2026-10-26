import { useState } from 'react';
import { X } from 'lucide-react';
import { addTag, removeTag, tagKey } from '../../lib/tags';

interface Props {
  id: string;
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  /** Earlier tags to offer; ones already here are left out. */
  suggestions: string[];
  hint?: string;
}

/** Tags as removable chips, with a field that adds one on Enter, a comma or leaving it. */
export default function TagInput({ id, label, tags, onChange, suggestions, hint }: Props) {
  const [draft, setDraft] = useState('');
  const listId = `${id}-suggestions`;
  const offered = suggestions.filter((s) => !tags.some((t) => tagKey(t) === tagKey(s)));

  function commit() {
    if (draft.trim() === '') return;
    const next = addTag(tags, draft);
    setDraft('');
    if (next !== tags) onChange(next);
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label} <span className="font-normal text-ink-muted">(optional)</span>
      </label>
      <div className="field flex min-h-10 flex-wrap items-center gap-1.5 py-1.5">
        {tags.map((tag) => (
          <span key={tagKey(tag)} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink">
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(removeTag(tags, tag))}
              className="rounded-full hover:bg-accent/15"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          role="combobox"
          aria-expanded={false}
          list={listId}
          value={draft}
          onChange={(e) => {
            const value = e.target.value;
            // A comma ends the tag being typed.
            if (value.endsWith(',')) {
              const next = addTag(tags, value.slice(0, -1));
              setDraft('');
              if (next !== tags) onChange(next);
            } else {
              setDraft(value);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={commit}
          placeholder={tags.length === 0 ? 'e.g. Holiday 2026' : ''}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none"
        />
        <datalist id={listId}>
          {offered.map((s) => <option key={tagKey(s)} value={s} />)}
        </datalist>
      </div>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
