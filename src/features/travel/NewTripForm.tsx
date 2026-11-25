import { useId, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import LoadingButton from '../../components/LoadingButton';
import Select from '../../components/ui/Select';
import DatePicker from '../expenses/DatePicker';
import { createTrip } from '../../lib/travel/createTrip';
import { currencyOptions } from '../../lib/travel/currency';
import { validateTripInput } from '../../lib/travel/trips';

const CURRENCY_OPTIONS = currencyOptions().map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));

interface Props {
  user: User;
  /** Preselected home currency, such as the household's. */
  defaultCurrency: string;
  onCreated: (tripId: string) => void;
}

/** Name, home currency and dates for a new trip. */
export default function NewTripForm({ user, defaultCurrency, onCreated }: Props) {
  const id = useId();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(
    CURRENCY_OPTIONS.some((o) => o.value === defaultCurrency) ? defaultCurrency : 'AUD',
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input = { name: name.trim(), currency, startDate, endDate };
    const problem = validateTripInput(input);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const tripId = await createTrip(user, input);
      // Stay in the saving state: the host navigates away, and re-enabling the
      // button meanwhile would let a second tap create the trip twice.
      onCreated(tripId);
    } catch {
      setError("Couldn't create the trip. Try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="card space-y-4 p-4 sm:p-5">
      <div>
        <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-medium text-ink">
          Trip name
        </label>
        <input
          id={`${id}-name`}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          placeholder="Japan 2027"
          autoComplete="off"
          className="field"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-start`} className="mb-1 block text-sm font-medium text-ink">
            First day
          </label>
          <DatePicker id={`${id}-start`} name="First day" value={startDate} onChange={(v) => { setStartDate(v); setError(''); }} />
        </div>
        <div>
          <label htmlFor={`${id}-end`} className="mb-1 block text-sm font-medium text-ink">
            Last day
          </label>
          <DatePicker id={`${id}-end`} name="Last day" value={endDate} onChange={(v) => { setEndDate(v); setError(''); }} />
        </div>
      </div>
      <div>
        <label id={`${id}-currency-label`} className="mb-1 block text-sm font-medium text-ink">
          Home currency
        </label>
        <Select
          aria-labelledby={`${id}-currency-label`}
          title="Home currency"
          value={currency}
          onChange={setCurrency}
          options={CURRENCY_OPTIONS}
        />
        <p className="mt-1 text-xs text-ink-muted">
          Balances and settle-up are worked out in this currency. You can still record what you spend in any currency.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-negative">{error}</p>}
      <LoadingButton type="submit" loading={saving} loadingText="Creating…" className="btn-primary h-10 w-full">
        Create trip
      </LoadingButton>
    </form>
  );
}
