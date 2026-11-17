import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import Popover from './Popover';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  /** Fires on every pick, including re-picking the current option. */
  onChange: (value: string) => void;
  options: SelectOption[];
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** Heading of the bottom sheet shown on phones. Defaults to the aria-label. */
  title?: string;
  placeholder?: string;
  disabled?: boolean;
  /** `field` looks like a text input; `bare` is just the label and chevron, styled by `className`. */
  variant?: 'field' | 'bare';
  className?: string;
}

const TYPEAHEAD_RESET_MS = 700;

/**
 * A themed dropdown that replaces the browser's native `<select>`, whose
 * popup can't be styled and looks foreign on every platform. Keeps the
 * combobox/listbox semantics and keyboard behaviour.
 */
export default function Select({
  value,
  onChange,
  options,
  id,
  title,
  placeholder = 'Select…',
  disabled = false,
  variant = 'field',
  className = '',
  ...aria
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const uid = useId();
  const optionId = (i: number) => `${uid}-opt-${i}`;

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
    // optionId is derived from uid, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  function openList() {
    if (disabled) return;
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function pick(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close();
  }

  function onTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openList();
    }
  }

  function onListKeyDown(e: KeyboardEvent) {
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((a) => Math.min(last, a + 1));
        return;
      case 'ArrowUp':
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        return;
      case 'Home':
        e.preventDefault();
        setActive(0);
        return;
      case 'End':
        e.preventDefault();
        setActive(last);
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        pick(active);
        return;
      case 'Tab':
        e.preventDefault();
        close();
        return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = e.timeStamp;
      const t = typed.current;
      t.text = now - t.at > TYPEAHEAD_RESET_MS ? e.key : t.text + e.key;
      t.at = now;
      const needle = t.text.toLowerCase();
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(needle));
      if (hit >= 0) setActive(hit);
    }
  }

  const base =
    variant === 'field'
      ? 'field flex items-center justify-between gap-2 text-left'
      : 'inline-flex items-center gap-1 text-left';

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${uid}-list` : undefined}
        aria-label={aria['aria-label']}
        aria-labelledby={aria['aria-labelledby']}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
        className={`${base} ${className}`}
      >
        <span className={`min-w-0 truncate ${selected ? '' : 'text-ink-faint'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={variant === 'field' ? 16 : 14}
          strokeWidth={1.75}
          className={`shrink-0 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <Popover
        open={open}
        onClose={close}
        anchorRef={triggerRef}
        title={title ?? aria['aria-label'] ?? placeholder}
        matchAnchorWidth
        minWidth={variant === 'bare' ? 200 : 0}
      >
        <div
          ref={listRef}
          id={`${uid}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label={aria['aria-label']}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKeyDown}
          className="max-h-[min(20rem,60vh)] overflow-y-auto p-1 outline-none"
        >
          {options.map((o, i) => {
            const isSelected = i === selectedIndex;
            return (
              <div
                key={o.value}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                onMouseMove={() => active !== i && setActive(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm sm:py-2 ${
                  i === active ? 'bg-recessed' : ''
                } ${isSelected ? 'font-semibold text-ink' : 'text-ink'}`}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && <Check size={16} strokeWidth={2.25} className="shrink-0 text-accent" aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
