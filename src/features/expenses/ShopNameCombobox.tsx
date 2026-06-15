import { useState, useRef, useEffect, useId } from 'react';
import type { ShopEntry } from '../../types/models';

interface ShopNameComboboxProps {
  value: string;
  onChange: (name: string) => void;
  suggestions: ShopEntry[];
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

export default function ShopNameCombobox({
  value,
  onChange,
  suggestions,
  placeholder = 'Shop name',
}: ShopNameComboboxProps) {
  // Internal display value tracks what the user has typed; syncs with prop on external changes.
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(value.length > 0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const optionPrefix = useId();

  // Sync prop → internal when controlled parent updates (e.g. after selection)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Focus input on mount when it has an initial value so keyboard events work immediately
  useEffect(() => {
    if (value.length > 0) {
      inputRef.current?.focus();
    }
    // intentionally run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = inputValue.length > 0
    ? suggestions.filter((s) => findMatchIndex(s.name, inputValue) !== -1).slice(0, 5)
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

  function handleSelect(suggestion: ShopEntry) {
    onChange(suggestion.name);
    setInputValue(suggestion.name);
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
        if (activeIndex >= 0 && activeIndex < filtered.length) {
          handleSelect(filtered[activeIndex]);
        }
        e.preventDefault();
        break;
      case 'Tab':
        if (activeIndex >= 0 && activeIndex < filtered.length) handleSelect(filtered[activeIndex]);
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
        ref={inputRef}
        type="text"
        dir="auto"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        value={inputValue}
        placeholder={placeholder}
        className="field"
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          setInputValue(v);
          onChange(v);
          setOpen(true);
          setActiveIndex(-1);
        }}
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
              key={s.name}
              id={`${optionPrefix}-${i}`}
              role="option"
              dir="auto"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              className={`flex cursor-pointer items-center px-3 py-2 text-sm ${
                i === activeIndex ? 'bg-emerald-50' : 'hover:bg-slate-50'
              }`}
            >
              <span aria-hidden="true">{highlightMatch(s.name, inputValue)}</span>
              <span className="sr-only">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
