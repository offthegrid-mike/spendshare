interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
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
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        data-testid="confirm-backdrop"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-card-hover"
      >
        <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-900">
          {title}
        </h2>
        <p id="confirm-dialog-message" className="mt-2 text-sm text-slate-500">
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
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2
              text-sm font-semibold text-white shadow-sm transition
              hover:bg-rose-700 active:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
