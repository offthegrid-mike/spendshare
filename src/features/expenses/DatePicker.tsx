import { useState, useRef, useEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, parse, isValid } from 'date-fns';
import { Calendar } from 'lucide-react';
import 'react-day-picker/style.css';

interface Props {
  id?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  error?: string;
}

export default function DatePicker({ id, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function handleSelect(date: Date | undefined) {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
      setOpen(false);
    }
  }

  const label = selected ? format(selected, 'MMM d, yyyy') : 'Pick a date';

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        aria-label={`Date: ${label}`}
        onClick={() => setOpen((o) => !o)}
        className="field flex w-full items-center justify-between text-left"
      >
        <span>{label}</span>
        <Calendar size={16} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
          />
        </div>
      )}
      {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
