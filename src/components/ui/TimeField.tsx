import { useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import Popover from './Popover';
import { parseTime } from '../../lib/parseTime';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

interface Props {
  id: string;
  /** "HH:mm", or '' when unset. */
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the picker button. */
  pickerLabel: string;
}

/** Scrolls the list that holds the chosen option so the option sits in view. */
function centerInList(el: HTMLElement | null) {
  const list = el?.parentElement;
  if (el && list) list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
}

const optionClass = (on: boolean) =>
  `flex h-9 w-full cursor-pointer items-center justify-center rounded-lg text-sm money transition-colors ${
    on ? 'bg-accent font-semibold text-on-accent' : 'text-ink hover:bg-recessed'
  }`;

/**
 * A 24-hour time field: type it, or pick the hour and minute from a themed
 * popover. Replaces the browser's `<input type="time">`, whose spinner UI
 * and 12/24-hour behaviour differ between devices.
 */
export default function TimeField({ id, value, onChange, pickerLabel }: Props) {
  const [open, setOpen] = useState(false);
  // What was typed, remembered with the value it produced so a change from
  // elsewhere (a computed finish time) replaces it instead of being hidden.
  const [draft, setDraft] = useState<{ text: string; basis: string } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const shown = draft && draft.basis === value ? draft.text : value;
  const [hour, minute] = value ? value.split(':') : ['', ''];

  function type(text: string) {
    const parsed = parseTime(text);
    if (parsed !== null) {
      setDraft({ text, basis: parsed });
      onChange(parsed);
    } else if (text === '') {
      setDraft(null);
      onChange('');
    } else {
      setDraft({ text, basis: value });
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="HH:MM"
        value={shown}
        onChange={(e) => type(e.target.value)}
        onBlur={() => setDraft(null)}
        className="field money pr-10"
      />
      <button
        ref={buttonRef}
        type="button"
        aria-label={pickerLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-[10px] text-ink-muted transition hover:text-ink"
      >
        <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={wrapRef} title={pickerLabel} matchAnchorWidth minWidth={200}>
        <div className="grid grid-cols-2 gap-2 p-2">
          <div>
            <p className="px-1 pb-1 text-xs font-medium text-ink-muted">Hour</p>
            <div role="listbox" aria-label="Hour" className="relative grid max-h-60 grid-cols-1 gap-0.5 overflow-y-auto pr-1">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  role="option"
                  ref={h === hour ? centerInList : undefined}
                  aria-selected={h === hour}
                  onClick={() => onChange(`${h}:${minute || '00'}`)}
                  className={optionClass(h === hour)}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="px-1 pb-1 text-xs font-medium text-ink-muted">Minute</p>
            <div role="listbox" aria-label="Minute" className="relative grid max-h-60 grid-cols-1 gap-0.5 overflow-y-auto pr-1">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="option"
                  ref={m === minute ? centerInList : undefined}
                  aria-selected={m === minute}
                  onClick={() => {
                    onChange(`${hour || '09'}:${m}`);
                    setOpen(false);
                    buttonRef.current?.focus();
                  }}
                  className={optionClass(m === minute)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Popover>
    </div>
  );
}
