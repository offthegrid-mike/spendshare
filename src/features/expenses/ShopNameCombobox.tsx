import { useState, useRef, useEffect, useId } from 'react';
import type { ShopEntry } from '../../types/models';
import { findMatchIndex, highlightMatch } from './comboboxUtils';

interface ShopNameComboboxProps {
  value: string;
  onChange: (name: string) => void;
  suggestions: ShopEntry[];
  placeholder?: string;
  id?: string;
  'aria-label'?: string;
}

export default function ShopNameCombobox({
  value,
  onChange,
  suggestions,
  placeholder = 'Shop name',
  id,
  'aria-label': ariaLabel,
}: ShopNameComboboxProps) {
  // Internal display value tracks what the user has typed; syncs with prop on external changes.
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const optionPrefix = useId();

  // Sync prop → internal when controlled parent updates (e.g. after selection)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

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
        id={id}
        type="text"
        dir="auto"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={activeId}
        aria-label={ariaLabel}
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
