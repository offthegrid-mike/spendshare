import { useState, useRef, useEffect, useId } from 'react';
import type { SuggestionEntry } from '../../types/models';

interface ItemNameComboboxProps {
  value: string;
  onChange: (name: string, suggestion?: SuggestionEntry) => void;
  suggestions: SuggestionEntry[];
  id?: string;
  placeholder?: string;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', usage: 'search' });

function findMatchIndex(haystack: string, needle: string): number {
  const h = haystack.normalize('NFC');
  const n = needle.normalize('NFC');
  if (n.length === 0) return -1;
  for (let i = 0; i <= h.length - n.length; i++) {
    if (collator.compare(h.slice(i, i + n.length), n) === 0) return i;
  }
  return -1;
}

function highlightMatch(name: string, query: string): React.ReactNode {
  const normName = name.normalize('NFC');
  const normQuery = query.normalize('NFC');
  const idx = findMatchIndex(normName, normQuery);
  if (idx === -1) return <span>{name}</span>;
  const before = normName.slice(0, idx);
  const match  = normName.slice(idx, idx + normQuery.length);
  const after  = normName.slice(idx + normQuery.length);
  return <span>{before}<strong>{match}</strong>{after}</span>;
}

export default function ItemNameCombobox({
  value,
  onChange,
  suggestions,
  id,
  placeholder = 'Item name',
}: ItemNameComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const optionPrefix = useId();

  const filtered = value.length > 0
    ? suggestions.filter((s) => findMatchIndex(s.name, value) !== -1).slice(0, 5)
    : [];
  const isOpen = open && filtered.length > 0;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function handleSelect(suggestion: SuggestionEntry) {
    onChange(suggestion.name, suggestion);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && filtered.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        e.preventDefault();
        break;
      case 'ArrowUp':
        setActiveIndex((i) => Math.max(i - 1, -1));
        e.preventDefault();
        break;
      case 'Enter':
        if (activeIndex >= 0) {
          handleSelect(filtered[activeIndex]);
          e.preventDefault();
        }
        break;
      case 'Tab':
        if (activeIndex >= 0) handleSelect(filtered[activeIndex]);
        break;
      case 'Escape':
        setOpen(false);
        setActiveIndex(-1);
        e.preventDefault();
        break;
    }
  }

  const activeId = activeIndex >= 0 ? `${optionPrefix}-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        dir="auto"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        value={value}
        placeholder={placeholder}
        className="field"
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActiveIndex(-1); }}
        onFocus={() => { if (filtered.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {filtered.map((s, i) => (
            <li
              key={`${s.name}|${s.categoryId}`}
              id={`${optionPrefix}-${i}`}
              role="option"
              dir="auto"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              className={`flex cursor-pointer items-center justify-between px-3 py-2 text-sm ${
                i === activeIndex ? 'bg-emerald-50' : 'hover:bg-slate-50'
              }`}
            >
              {highlightMatch(s.name, value)}
              <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {s.category}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
