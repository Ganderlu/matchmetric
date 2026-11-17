"use client";

import { AlertTriangle, Trash2 } from "lucide-react";

/**
 * Clearing the slip is destructive and irreversible for this session, so it is never a single
 * tap: the trash icon in the header opens this confirmation.
 */
export function ClearSlipDialog({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="slip-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="slip-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="slip-clear-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="slip-dialog-icon">
          <AlertTriangle size={20} />
        </span>
        <h3 id="slip-clear-title">Clear your slip?</h3>
        <p>
          This removes all {count} {count === 1 ? "selection" : "selections"} from your slip, together with
          their analysis. Your saved predictions in Open Games are not affected.
        </p>
        <div className="slip-dialog-actions">
          <button type="button" className="slip-ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="slip-danger-btn" onClick={onConfirm}>
            <Trash2 size={15} strokeWidth={2.2} /> Clear All
          </button>
        </div>
      </div>
    </div>
  );
}
