"use client";

import { Camera, TicketCheck, Trash2, X } from "lucide-react";

/**
 * Slip header.
 *
 * The screenshot importer and the clear-all control live here rather than beside every match,
 * so an individual card keeps a single removal affordance (its X).
 */
export function SlipHeader({
  count,
  onClose,
  onScreenshot,
  onClear,
  disabled,
}: {
  count: number;
  onClose: () => void;
  onScreenshot: () => void;
  onClear: () => void;
  disabled: boolean;
}) {
  return (
    <div className="slip-header">
      <div className="slip-header-title">
        <span className="slip-header-mark">
          <TicketCheck size={16} strokeWidth={2.4} />
        </span>
        <div>
          <span className="slip-eyebrow">MatchMetric</span>
          <h2 id="slip-title">
            Game Slip <span>{count}</span>
          </h2>
        </div>
      </div>
      <div className="slip-header-actions">
        <button type="button" className="slip-icon-btn" onClick={onScreenshot} aria-label="Import a bookmaker slip screenshot">
          <Camera size={17} />
        </button>
        <button
          type="button"
          className="slip-icon-btn"
          onClick={onClear}
          disabled={disabled}
          aria-label="Clear every selection from your slip"
        >
          <Trash2 size={17} />
        </button>
        <button type="button" className="slip-icon-btn" onClick={onClose} aria-label="Close slip">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
