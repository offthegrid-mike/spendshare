import { useId, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import LoadingButton from '../../components/LoadingButton';
import Select from '../../components/ui/Select';
import { useWorkClock } from '../../hooks/useWorkClock';
import { walletIdFor, type WalletState } from '../../lib/travel/cash';
import { formatMinor, minorDigits, toMinor } from '../../lib/travel/currency';
import { valueCash } from '../../lib/travel/wallet';
import { handOverCash } from './cashWrite';
import type { GroupDoc } from '../../types/models';

interface Props {
  trip: GroupDoc;
  user: User;
  fromUid: string;
  toUid: string;
  /** What's owed, in home minor units. */
  owed: number;
  /** The giver's wallets with cash left. */
  wallets: WalletState[];
  /** Wallet ids that exist, to know whether the receiver already has cash in a currency. */
  walletIds: string[];
  onDone: () => void;
}

/** The foreign cash, up to what's left, that covers `owed` at the wallet's average for the cash left. */
function suggested(w: WalletState, owed: number): number {
  const rate = w.leftRate;
  if (!rate || rate.home <= 0) return w.left.foreign;
  return Math.min(w.left.foreign, Math.ceil((owed * rate.foreign) / rate.home));
}

/** Pays back a settle-up line in foreign cash, valued at what the cash cost the giver. */
export default function CashHandoverForm({ trip, user, fromUid, toUid, owed, wallets, walletIds, onDone }: Props) {
  const id = useId();
  const home = trip.currency;
  const { today } = useWorkClock();
  const [currency, setCurrency] = useState(wallets[0]?.wallet.currency ?? '');
  const wallet = wallets.find((w) => w.wallet.currency === currency);
  const asText = (amount: number) => (amount / 10 ** minorDigits(currency)).toFixed(minorDigits(currency));
  const [amount, setAmount] = useState(wallet ? asText(suggested(wallet, owed)) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const foreignAmount = toMinor(amount || 'x', currency);
  const value = wallet?.leftRate && foreignAmount > 0 ? valueCash(foreignAmount, wallet.leftRate) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!(foreignAmount > 0)) { setError('Enter the cash to hand over.'); return; }
    if (wallet && foreignAmount > wallet.left.foreign) {
      setError(`Only ${formatMinor(wallet.left.foreign, currency)} is left to hand over.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await handOverCash({
        tripId: trip.id, uid: user.uid, fromUid, toUid, currency, foreignAmount, date: today,
        receiverHasWallet: walletIds.includes(walletIdFor(toUid, currency)),
      });
      onDone();
    } catch {
      setError("Couldn't record the cash. Try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Pay in cash" className="mt-2 space-y-2 rounded-[12px] bg-recessed p-3">
      {wallets.length > 1 && (
        <div>
          <p id={`${id}-currency`} className="mb-1 text-xs font-medium text-ink-muted">Currency</p>
          <Select
            aria-labelledby={`${id}-currency`}
            title="Currency"
            value={currency}
            onChange={(c) => {
              setCurrency(c);
              const w = wallets.find((x) => x.wallet.currency === c);
              if (w) setAmount((suggested(w, owed) / 10 ** minorDigits(c)).toFixed(minorDigits(c)));
            }}
            options={wallets.map((w) => ({ value: w.wallet.currency, label: w.wallet.currency }))}
          />
        </div>
      )}
      <label htmlFor={`${id}-amount`} className="block text-xs font-medium text-ink-muted">{`Cash to hand over (${currency})`}</label>
      <div className="flex gap-2">
        <input
          id={`${id}-amount`}
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError(''); }}
          className="field min-w-0 flex-1 tabular-nums"
        />
        <LoadingButton type="submit" loading={saving} loadingText="Saving…" className="btn-primary shrink-0">
          Hand over
        </LoadingButton>
      </div>
      {value !== null && (
        <p className="text-xs text-ink-muted">{`≈ ${formatMinor(value, home)} of the ${formatMinor(owed, home)} owed`}</p>
      )}
      {error && <p role="alert" className="text-sm text-negative">{error}</p>}
    </form>
  );
}
