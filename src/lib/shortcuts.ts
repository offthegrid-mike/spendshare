/** One row of the Keyboard shortcuts help. `keys` are pressed together. */
export interface ShortcutHelp { keys: string[]; description: string; }

/** Every keyboard shortcut, grouped by where it works. The help dialog lists these. */
export const SHORTCUTS: { title: string; shortcuts: ShortcutHelp[] }[] = [
  {
    title: 'Anywhere in SpendShare',
    shortcuts: [
      { keys: ['N'], description: 'New expense' },
      { keys: ['/'], description: 'Search' },
      { keys: ['⌘', 'K'], description: 'Search (Ctrl K on Windows)' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
  {
    title: 'Expenses, Summary and Income',
    shortcuts: [
      { keys: ['←'], description: 'Previous month' },
      { keys: ['→'], description: 'Next month' },
    ],
  },
  {
    title: 'Expense list',
    shortcuts: [
      { keys: ['↑'], description: 'Previous expense' },
      { keys: ['↓'], description: 'Next expense' },
      { keys: ['E'], description: 'Edit the selected expense' },
    ],
  },
  {
    title: 'Dialogs',
    shortcuts: [{ keys: ['Esc'], description: 'Close' }],
  },
];

export interface ShortcutOptions {
  /** The shortcut is pressed with ⌘ or Ctrl, such as ⌘K. */
  mod?: boolean;
  /** Still fires while typing in a field. */
  whileTyping?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Whether a keydown should be left alone rather than treated as a shortcut:
 * another control already handled it, a dialog is open on top of the page,
 * the user is typing in a field, or modifier keys don't match. Shift is
 * allowed, since keys like ? need it.
 */
export function ignoreShortcut(event: KeyboardEvent, { mod = false, whileTyping = false }: ShortcutOptions = {}): boolean {
  if (event.defaultPrevented) return true;
  if (document.querySelector('[aria-modal="true"]')) return true;
  if (!whileTyping && isTypingTarget(event.target)) return true;
  if (event.altKey) return true;
  const modPressed = event.metaKey || event.ctrlKey;
  return mod ? !modPressed : modPressed;
}
