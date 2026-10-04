interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  /** `danger` for destructive confirms (the default), `primary` otherwise. */
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmDisabled = false,
  tone = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-ink/40"
        data-testid="confirm-backdrop"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-pop"
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-ink">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm text-ink-muted">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={onConfirm}
            className={
              tone === 'primary'
                ? 'btn-primary'
                : `inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-negative px-4
              text-sm font-semibold text-on-accent transition
              hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60
              motion-safe:active:scale-[0.98]`
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
