import { useState } from 'react';
import { X } from 'lucide-react';
import { addTag, hasTag, MAX_TAGS, removeTag, tagKey } from '../../lib/tags';
import { TAG_CHIP_CLASS } from '../../components/ui/TagChip';

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
  const hintId = `${id}-hint`;
  const full = tags.length >= MAX_TAGS;
  const offered = suggestions.filter((s) => !hasTag(tags, s));

  /** Adds each of `values` as a tag and clears the field to `rest`. */
  function commit(values: string[], rest = '') {
    const next = values.reduce(addTag, tags);
    setDraft(rest);
    if (next !== tags) onChange(next);
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label} <span className="font-normal text-ink-muted">(optional)</span>
      </label>
      <div className="field flex min-h-10 flex-wrap items-center gap-1.5 py-1.5">
        {tags.map((tag) => (
          <span key={tagKey(tag)} className={TAG_CHIP_CLASS}>
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
        {/* An input with a datalist is a combobox in its own right. */}
        <input
          id={id}
          list={listId}
          value={draft}
          disabled={full}
          aria-describedby={hint || full ? hintId : undefined}
          onChange={(e) => {
            // A comma ends a tag, so typed or pasted "a, b, c" makes three.
            const parts = e.target.value.split(',');
            const rest = parts.pop() ?? '';
            if (parts.length > 0) commit(parts, rest);
            else setDraft(rest);
          }}
          onKeyDown={(e) => {
            // Enter while an input method is composing picks a character, not a tag.
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (draft.trim() !== '') commit([draft]);
            } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim() !== '') commit([draft]);
          }}
          placeholder={tags.length === 0 ? 'e.g. Holiday 2026' : ''}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none"
        />
        <datalist id={listId}>
          {offered.map((s) => <option key={tagKey(s)} value={s} />)}
        </datalist>
      </div>
      {(hint || full) && (
        <p id={hintId} className="mt-1 text-xs text-ink-muted">
          {full ? `${MAX_TAGS} tags is the most.` : hint}
        </p>
      )}
    </div>
  );
}
