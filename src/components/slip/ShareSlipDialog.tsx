"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { composeSlipSummary } from "@/lib/slip-analysis";
import type { SlipEntry } from "@/types/slip";

/**
 * Share interface.
 *
 * Image export and native sharing are not wired to a service yet, so this builds the shareable
 * MatchMetric summary as text and offers a copy action. It intentionally contains no account
 * information and never suggests the slip places a real bet.
 */
export function ShareSlipDialog({ entries, onClose }: { entries: SlipEntry[]; onClose: () => void }) {
  const summary = composeSlipSummary(entries);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      // The summary stays visible so it can still be copied by hand.
      setCopied(false);
    }
  };

  return (
    <div className="slip-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="slip-dialog slip-share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slip-share-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="slip-dialog-icon slip-dialog-icon-share">
          <Share2 size={20} />
        </span>
        <h3 id="slip-share-title">Share your slip</h3>
        <p>
          MatchMetric analysis is a data-led estimate, not a guarantee. Sharing this slip does not place a bet.
        </p>
        <pre className="slip-share-summary">{summary}</pre>
        <div className="slip-dialog-actions">
          <button type="button" className="slip-ghost-btn" onClick={onClose}>
            Close
          </button>
          <button type="button" className="slip-save-btn" onClick={copy}>
            {copied ? (
              <>
                <Check size={15} strokeWidth={2.6} /> Copied
              </>
            ) : (
              <>
                <Copy size={15} strokeWidth={2.2} /> Copy summary
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
