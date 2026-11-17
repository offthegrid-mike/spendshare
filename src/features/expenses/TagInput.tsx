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
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const listId = `${id}-suggestions`;
  const hintId = `${id}-hint`;
  const full = tags.length >= MAX_TAGS;
  const needle = draft.trim().toLowerCase();
  const offered = suggestions
    .filter((s) => !hasTag(tags, s) && (needle === '' || s.toLowerCase().includes(needle)))
    .slice(0, 8);
  const listOpen = focused && !full && offered.length > 0;

  /** Adds each of `values` as a tag and clears the field to `rest`. */
  function commit(values: string[], rest = '') {
    const next = values.reduce(addTag, tags);
    setDraft(rest);
    setHighlight(-1);
    if (next !== tags) onChange(next);
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label} <span className="font-normal text-ink-muted">(optional)</span>
      </label>
      <div className="relative">
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
        <input
          id={id}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={listOpen && highlight >= 0 ? `${listId}-${highlight}` : undefined}
          value={draft}
          disabled={full}
          aria-describedby={hint || full ? hintId : undefined}
          onChange={(e) => {
            // A comma ends a tag, so typed or pasted "a, b, c" makes three.
            const parts = e.target.value.split(',');
            const rest = parts.pop() ?? '';
            if (parts.length > 0) commit(parts, rest);
            else setDraft(rest);
            setHighlight(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && listOpen) {
              e.preventDefault();
              setHighlight((h) => Math.min(offered.length - 1, h + 1));
            } else if (e.key === 'ArrowUp' && listOpen) {
              e.preventDefault();
              setHighlight((h) => Math.max(-1, h - 1));
            } else if (e.key === 'Escape' && listOpen) {
              e.stopPropagation();
              setFocused(false);
            } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              // (While an input method is composing, Enter picks a character, not a tag.)
              e.preventDefault();
              if (listOpen && highlight >= 0) commit([offered[highlight]]);
              else if (draft.trim() !== '') commit([draft]);
            } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (draft.trim() !== '') commit([draft]);
          }}
          placeholder={tags.length === 0 ? 'e.g. Holiday 2026' : ''}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {listOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-pop motion-safe:animate-menu-in"
        >
          {offered.map((s, i) => (
            <li
              key={tagKey(s)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === highlight}
              // Keep focus in the field, so picking doesn't blur it first.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit([s])}
              onMouseMove={() => setHighlight(i)}
              className={`cursor-pointer truncate rounded-lg px-3 py-2 text-sm text-ink ${i === highlight ? 'bg-recessed' : ''}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
      </div>
      {(hint || full) && (
        <p id={hintId} className="mt-1 text-xs text-ink-muted">
          {full ? `${MAX_TAGS} tags is the most.` : hint}
        </p>
      )}
    </div>
  );
}
