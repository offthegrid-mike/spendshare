import { useId, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { format, parseISO } from 'date-fns';
import { Banknote, TriangleAlert, X } from 'lucide-react';
import LoadingButton from '../../components/LoadingButton';
import Select from '../../components/ui/Select';
import { useWorkClock } from '../../hooks/useWorkClock';
import { readableWalletRate, walletIdFor, type TripCash as TripCashState, type WalletState } from '../../lib/travel/cash';
import { currencyOptions, formatMinor, toMinor } from '../../lib/travel/currency';
import { lastRates } from '../../lib/travel/tripExpense';
import { tripMemberName } from '../../lib/travel/valueTrip';
import DatePicker from '../expenses/DatePicker';
import { addCash, deleteTopUp } from './cashWrite';
import type { ExpenseDoc, GroupDoc } from '../../types/models';

interface Props {
  trip: GroupDoc;
  user: User;
  cash: TripCashState;
  /** The trip's expenses, to offer the currency last used. */
  expenses: ExpenseDoc[];
}

function owner(trip: GroupDoc, uid: string, viewerUid: string): { name: string; possessive: string } {
  if (uid === viewerUid) return { name: 'You', possessive: 'Your' };
  const name = tripMemberName(trip, uid, viewerUid);
  return { name, possessive: `${name}’s` };
}

function WalletCard({ trip, user, state }: { trip: GroupDoc; user: User; state: WalletState }) {
  const home = trip.currency;
  const { currency } = state.wallet;
  const who = owner(trip, state.wallet.ownerUid, user.uid);
  const title = `${who.possessive} ${currency} cash`;
  const [removing, setRemoving] = useState<string | null>(null);

  return (
    <section aria-label={title} className="card space-y-2 p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {state.left.foreign >= 0 ? (
        <p className="text-xl font-semibold tabular-nums text-ink">{`${formatMinor(state.left.foreign, currency)} left`}</p>
      ) : (
        <p className="flex items-center gap-1.5 text-sm font-medium text-negative">
          <TriangleAlert size={15} aria-hidden="true" />
          {`${formatMinor(-state.left.foreign, currency)} more spent than added`}
        </p>
      )}
      {state.rate ? (
        <p className="text-[13px] text-ink-muted">
          {state.left.home !== null && state.left.foreign > 0 && `Cost ${formatMinor(state.left.home, home)} · `}
          {`Average 1 ${home} = ${readableWalletRate(state.rate, currency, home)} ${currency}`}
        </p>
      ) : (
        <p className="text-[13px] text-warning">{`Add the cash ${who.name === 'You' ? 'you' : who.name} bought, so its payments can be valued.`}</p>
      )}
      <p className="text-xs text-ink-muted">
        {`Bought ${formatMinor(state.paidIn.foreign, currency)} for ${formatMinor(state.paidIn.home, home)} · Spent ${formatMinor(state.spent, currency)}`}
      </p>
      {state.topUps.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {state.topUps.map((t) => {
            const label = `${formatMinor(t.foreignAmount, currency)} for ${formatMinor(t.homeAmount, home)}`;
            const when = format(parseISO(t.date), 'd MMM');
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-[13px] text-ink">
                <span>{`${when} · ${label}`}</span>
                <button
                  type="button"
                  aria-label={`Remove ${formatMinor(t.foreignAmount, currency)} added on ${when}`}
                  disabled={removing === t.id}
                  onClick={() => {
                    setRemoving(t.id);
                    deleteTopUp(trip.id, t.id).catch(() => {}).finally(() => setRemoving(null));
                  }}
                  className="grid h-8 w-8 place-items-center rounded-[10px] text-ink-muted hover:bg-recessed hover:text-ink disabled:opacity-50"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AddCashForm({ trip, user, cash, expenses }: Props) {
  const id = useId();
  const home = trip.currency;
  const { today } = useWorkClock();
  const options = currencyOptions().filter((c) => c.code !== home);
  const mine = cash.wallets.find((w) => w.wallet.ownerUid === user.uid);
  const last = lastRates(expenses, home).currency;
  const [ownerUid, setOwnerUid] = useState(user.uid);
  const [currency, setCurrency] = useState(
    mine?.wallet.currency ?? (last !== home ? last : options[0]?.code ?? 'USD'),
  );
  const [received, setReceived] = useState('');
  const [paid, setPaid] = useState('');
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const foreignAmount = toMinor(received || 'x', currency);
  const homeAmount = toMinor(paid || 'x', home);
  const preview = foreignAmount > 0 && homeAmount > 0
    ? `1 ${home} = ${readableWalletRate({ foreign: foreignAmount, home: homeAmount }, currency, home)} ${currency}`
    : null;
  const payer = ownerUid === user.uid ? 'You' : tripMemberName(trip, ownerUid, user.uid);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!(foreignAmount > 0)) { setError('Enter the cash you received.'); return; }
    if (!(homeAmount >= 0)) { setError(`Enter what was paid in ${home}.`); return; }
    if (!date) { setError('Choose the date.'); return; }
    setSaving(true);
    setError('');
    try {
      const walletExists = cash.wallets.some((w) => w.wallet.id === walletIdFor(ownerUid, currency));
      await addCash({ tripId: trip.id, uid: user.uid, ownerUid, currency, foreignAmount, homeAmount, date, walletExists });
      setReceived('');
      setPaid('');
    } catch {
      setError("Couldn't add the cash. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Add cash" className="card space-y-3 p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Banknote size={16} className="text-accent-ink" aria-hidden="true" />
        Add cash
      </h3>
      <p className="text-xs text-ink-muted">
        Record foreign cash when you buy it. Paying from it later is valued at what the cash cost, not the rate on the day.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p id={`${id}-owner`} className="mb-1 text-sm font-medium text-ink">Whose cash</p>
          <Select
            aria-labelledby={`${id}-owner`}
            title="Whose cash"
            value={ownerUid}
            onChange={setOwnerUid}
            options={trip.memberUids.map((uid) => ({ value: uid, label: tripMemberName(trip, uid, user.uid) }))}
          />
        </div>
        <div>
          <p id={`${id}-currency`} className="mb-1 text-sm font-medium text-ink">Currency</p>
          <Select
            aria-labelledby={`${id}-currency`}
            title="Currency"
            value={currency}
            onChange={setCurrency}
            options={options.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))}
          />
        </div>
        <div>
          <label htmlFor={`${id}-received`} className="mb-1 block text-sm font-medium text-ink">{`Cash received (${currency})`}</label>
          <input
            id={`${id}-received`}
            type="text"
            inputMode="decimal"
            value={received}
            onChange={(e) => { setReceived(e.target.value); setError(''); }}
            className="field tabular-nums"
          />
        </div>
        <div>
          <label htmlFor={`${id}-paid`} className="mb-1 block text-sm font-medium text-ink">{`${payer} paid (${home})`}</label>
          <input
            id={`${id}-paid`}
            type="text"
            inputMode="decimal"
            value={paid}
            onChange={(e) => { setPaid(e.target.value); setError(''); }}
            className="field tabular-nums"
          />
        </div>
        <div>
          <label htmlFor={`${id}-date`} className="mb-1 block text-sm font-medium text-ink">Date</label>
          <DatePicker id={`${id}-date`} value={date} onChange={setDate} />
        </div>
      </div>
      {preview && <p className="text-[13px] text-ink-muted">{preview}</p>}
      {error && <p role="alert" className="text-sm text-negative">{error}</p>}
      <LoadingButton type="submit" loading={saving} loadingText="Adding…" className="btn-primary">
        Add cash
      </LoadingButton>
    </form>
  );
}

/** A trip's cash wallets: what each person bought, what's left and what it cost, and adding more. */
export default function TripCash(props: Props) {
  const { cash, trip, user } = props;
  return (
    <div className="mx-auto max-w-lg space-y-4">
      {cash.wallets.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm font-semibold text-ink">No cash yet</p>
          <p className="mt-1 text-[13px] text-ink-muted">Add the foreign cash you bought before or during the trip.</p>
        </div>
      ) : (
        cash.wallets.map((state) => <WalletCard key={state.wallet.id} trip={trip} user={user} state={state} />)
      )}
      <AddCashForm {...props} />
    </div>
  );
}
