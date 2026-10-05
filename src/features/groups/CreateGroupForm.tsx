import { useId, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { createGroup, CURRENCIES } from '../../lib/createGroup';
import LoadingButton from '../../components/LoadingButton';

interface Props {
  user: User;
  /** Preselected currency; falls back to AUD when not one of CURRENCIES. */
  defaultCurrency?: string;
  onCreated: (groupId: string, name: string) => void;
  /** The host is still acting on a previous submit; keep the button disabled. */
  busy?: boolean;
}

/** Name + currency form, shared by first run and the group picker. */
export default function CreateGroupForm({ user, defaultCurrency, onCreated, busy = false }: Props) {
  const id = useId();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(
    (CURRENCIES as readonly string[]).includes(defaultCurrency ?? '') ? defaultCurrency! : 'AUD',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a group name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const gid = await createGroup(user, { name: trimmed, currency });
      // Stay in the saving state on success: the host unmounts this form, and
      // re-enabling it meanwhile would let a second tap create the group twice.
      onCreated(gid, trimmed);
    } catch {
      setError("Couldn't create the group. Try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-medium text-ink">
          Group name
        </label>
        <input
          id={`${id}-name`}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          placeholder="Our household"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="field"
        />
      </div>
      <div>
        <label htmlFor={`${id}-currency`} className="mb-1 block text-sm font-medium text-ink">
          Currency
        </label>
        <select
          id={`${id}-currency`}
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="field"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      {error && <p id={`${id}-error`} className="text-sm text-negative">{error}</p>}
      <LoadingButton type="submit" loading={saving} loadingText="Creating…" disabled={busy} className="btn-primary h-10 w-full">
        Create group
      </LoadingButton>
      <p className="text-center text-xs text-ink-muted">You'll switch to it, then you can invite people.</p>
    </form>
  );
}
