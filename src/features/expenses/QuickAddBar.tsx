import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { CategoryDoc, SuggestionEntry } from '../../types/models';
import ItemNameCombobox from './ItemNameCombobox';
import LastPriceHint from './LastPriceHint';
import Select from '../../components/ui/Select';
import Switch from '../../components/ui/Switch';

interface QuickAddBarProps {
  cats: CategoryDoc[];
  suggestions: SuggestionEntry[];
  currency: string;
  onAdd: (item: {
    name: string;
    categoryId: string;
    amount: string;
    quantity: string;
    shared: boolean;
  }) => void;
}

export default function QuickAddBar({ cats, suggestions, currency, onAdd }: QuickAddBarProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [categoryId, setCategoryId] = useState(''); // sticky across adds
  const [shared, setShared] = useState(true); // sticky across adds
  const categoryOptions = [
    { value: '', label: 'No category' },
    ...cats.map((cat) => ({ value: cat.id, label: cat.name })),
  ];
  const [error, setError] = useState('');

  function handleAdd() {
    if (!name.trim()) {
      setError('Enter an item name');
      return;
    }
    const amountNum = Number(amount);
    if (!amount.trim() || isNaN(amountNum) || amountNum <= 0) {
      setError('Enter a unit price');
      return;
    }
    const qtyNum = Math.floor(Number(quantity));
    if (!Number.isFinite(qtyNum) || qtyNum < 1) {
      setError('Enter a quantity of 1 or more');
      return;
    }
    onAdd({ name: name.trim(), categoryId, amount, quantity: String(qtyNum), shared });
    setName('');
    setAmount('');
    setQuantity('1');
    setError('');
    // categoryId and shared intentionally retained (sticky) for the next item.
    // Return focus to the name input for rapid consecutive entry.
    document.getElementById('quickadd-name')?.focus();
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  // One row from lg up; on phones, name/price/qty then category/shared/add.
  return (
    <div className="rounded-[10px] bg-recessed p-2.5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0 flex-1">
            <ItemNameCombobox
              id="quickadd-name"
              value={name}
              suggestions={suggestions}
              currency={currency}
              onEnter={handleAdd}
              onChange={(n, suggestion) => {
                setName(n);
                if (suggestion) setCategoryId(suggestion.categoryId);
              }}
            />
          </div>
          <label htmlFor="qa-amount" className="sr-only">Unit price</label>
          <input
            id="qa-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={onEnter}
            className="field money w-20 lg:w-[72px]"
          />
          <span className="text-sm text-ink-muted" aria-hidden="true">×</span>
          <input
            id="qa-qty"
            type="text"
            inputMode="numeric"
            aria-label="Quantity"
            placeholder="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={onEnter}
            className="field money w-12"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="qa-category" className="sr-only">Category</label>
          <Select
            id="qa-category"
            title="Category"
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            className="flex-1 lg:w-36 lg:flex-none"
          />

          <Switch checked={shared} onChange={(e) => setShared(e.target.checked)}>
            Shared
          </Switch>

          <button
            type="button"
            onClick={handleAdd}
            aria-label="Add item"
            className="grid h-9 w-10 shrink-0 place-items-center rounded-[10px] bg-accent text-on-accent transition hover:brightness-110 motion-safe:active:scale-95"
          >
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-1.5 empty:hidden">
        <LastPriceHint name={name} suggestions={suggestions} currency={currency} />
      </div>
      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
    </div>
  );
}
