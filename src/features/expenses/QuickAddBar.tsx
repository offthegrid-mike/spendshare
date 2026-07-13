import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { CategoryDoc, SuggestionEntry } from '../../types/models';
import ItemNameCombobox from './ItemNameCombobox';

interface QuickAddBarProps {
  cats: CategoryDoc[];
  suggestions: SuggestionEntry[];
  onAdd: (item: {
    name: string;
    categoryId: string;
    amount: string;
    quantity: string;
    shared: boolean;
  }) => void;
}

export default function QuickAddBar({ cats, suggestions, onAdd }: QuickAddBarProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [categoryId, setCategoryId] = useState(''); // sticky across adds
  const [shared, setShared] = useState(true); // sticky across adds
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

  return (
    <div className="rounded-xl border border-brand-300 bg-white p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600">
        Quick add
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <ItemNameCombobox
            id="quickadd-name"
            value={name}
            suggestions={suggestions}
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="field w-20"
        />
        <label htmlFor="qa-qty" className="sr-only">Quantity</label>
        <div className="flex items-center">
          <span className="mr-1 text-sm text-slate-400">×</span>
          <input
            id="qa-qty"
            type="text"
            inputMode="numeric"
            aria-label="Quantity"
            placeholder="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="field w-12"
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <label htmlFor="qa-category" className="sr-only">Category</label>
        <select
          id="qa-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="field flex-1"
        >
          <option value="">No category</option>
          {cats.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-700">
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/40"
          />
          Shared
        </label>

        <button
          type="button"
          onClick={handleAdd}
          aria-label="Add item"
          className="flex h-9 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-brand transition hover:opacity-90"
        >
          <Plus size={18} />
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
