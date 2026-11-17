"use client";

import { Check, Save, Share2 } from "lucide-react";
import { slipOddsTotal } from "@/lib/slip-analysis";
import type { SlipEntry } from "@/types/slip";

/**
 * The slip's bottom action area.
 *
 * "Save to Open Games" is deliberately not called "Place bet": MatchMetric does not take
 * stakes. It records the prediction entry so it later appears in Open Games and, after
 * settlement, in History.
 */
export function SlipActionBar({
  entries,
  saving,
  onSave,
  onShare,
}: {
  entries: SlipEntry[];
  saving: boolean;
  onSave: () => void;
  onShare: () => void;
}) {
  const savable = entries.filter((entry) => entry.analysable && entry.matchMetricRecommendation);
  const allSaved = savable.length > 0 && savable.every((entry) => entry.savedPredictionId);
  const total = slipOddsTotal(entries);

  return (
    <div className="slip-action-bar">
      <div className="slip-action-summary">
        <span>
          {entries.length} {entries.length === 1 ? "selection" : "selections"}
          {savable.length < entries.length && (
            <em> · {entries.length - savable.length} awaiting analysis</em>
          )}
        </span>
        <small>
          {total
            ? `Combined price ${total.toFixed(2)}`
            : "Combined price is shown once every selection has a price"}
        </small>
      </div>
      <div className="slip-action-buttons">
        <button type="button" className="slip-share-btn" onClick={onShare} disabled={!entries.length}>
          <Share2 size={15} strokeWidth={2.2} /> Share
        </button>
        <button
          type="button"
          className="slip-save-btn"
          onClick={onSave}
          disabled={saving || !savable.length}
        >
          {saving ? (
            <>
              <span className="spinner" /> Saving...
            </>
          ) : allSaved ? (
            <>
              <Check size={15} strokeWidth={2.6} /> Saved to Open Games
            </>
          ) : (
            <>
              <Save size={15} strokeWidth={2.2} /> Save to Open Games
            </>
          )}
        </button>
      </div>
    </div>
  );
}
