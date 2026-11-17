"use client";

import { ArrowLeft, PlayCircle, Plus, ShieldQuestion, X } from "lucide-react";
import type { ExtractedSelection, ScreenshotExtraction } from "@/types/slip";

/**
 * Verification screen.
 *
 * Nothing is trusted straight from the image. Each recognised selection is listed with how
 * confidently it was read and matched, uncertain rows are flagged for correction, and only then
 * does the user choose between adding the fixtures or replaying them against MatchMetric.
 */
export function ExtractedSelections({
  extraction,
  onAddToSlip,
  onReplay,
  onRemove,
  onBack,
}: {
  extraction: ScreenshotExtraction;
  onAddToSlip: () => void;
  onReplay: () => void;
  onRemove: (id: string) => void;
  onBack: () => void;
}) {
  const matched = extraction.selections.filter((selection) => selection.fixtureId).length;

  return (
    <div className="screenshot-verify">
      <div className="screenshot-verify-head">
        <button type="button" className="slip-back-btn" onClick={onBack} aria-label="Back to upload">
          <ArrowLeft size={16} />
        </button>
        <div>
          <span className="slip-eyebrow">Verify extraction</span>
          <h3>{extraction.selections.length} selections found</h3>
          <small>
            {matched} matched to a MatchMetric fixture
            {extraction.selections.length - matched > 0
              ? ` · ${extraction.selections.length - matched} need your attention`
              : ""}
          </small>
        </div>
      </div>

      {extraction.demonstration && (
        <p className="screenshot-demo-note">
          <ShieldQuestion size={14} strokeWidth={2.2} /> Demonstration extraction. The image was not read by OCR —
          these selections are samples for you to confirm or discard.
        </p>
      )}

      <div className="screenshot-selection-list">
        {extraction.selections.map((selection) => (
          <ExtractedRow key={selection.id} selection={selection} onRemove={() => onRemove(selection.id)} />
        ))}
        {!extraction.selections.length && (
          <p className="slip-section-note">No selections remained in this extraction.</p>
        )}
      </div>

      <div className="screenshot-verify-actions">
        <button type="button" className="slip-analyse-all" onClick={onAddToSlip} disabled={!extraction.selections.length}>
          <Plus size={16} strokeWidth={2.6} /> Add to Slip
        </button>
        <button type="button" className="slip-replay-btn" onClick={onReplay} disabled={!extraction.selections.length}>
          <PlayCircle size={16} strokeWidth={2.2} /> Replay Game
        </button>
        <p className="slip-section-note">
          Add to Slip keeps your original selection and gives you manual-style controls. Replay Game compares your
          selections with MatchMetric&rsquo;s own evaluation first.
        </p>
      </div>
    </div>
  );
}

function ExtractedRow({
  selection,
  onRemove,
}: {
  selection: ExtractedSelection;
  onRemove: () => void;
}) {
  const unmatched = !selection.fixtureId;
  const label =
    selection.confidence === "high" ? "Confident read" : selection.confidence === "medium" ? "Check this" : "Low confidence";

  return (
    <article className={`screenshot-selection ${unmatched ? "screenshot-selection-flagged" : ""}`}>
      <div className="screenshot-selection-head">
        <div>
          <strong>
            {selection.homeTeam} <span>vs</span> {selection.awayTeam}
          </strong>
          <small>{selection.competition}</small>
        </div>
        <button
          type="button"
          className="slip-card-remove"
          onClick={onRemove}
          aria-label={`Remove ${selection.homeTeam} vs ${selection.awayTeam}`}
        >
          <X size={15} />
        </button>
      </div>
      <div className="screenshot-selection-body">
        <span className="screenshot-selection-market">{selection.market}</span>
        <strong className="screenshot-selection-pick">{selection.selection}</strong>
        {typeof selection.odds === "number" && <span className="slip-odds">{selection.odds.toFixed(2)}</span>}
      </div>
      <div className="screenshot-selection-foot">
        <span className={`screenshot-confidence screenshot-confidence-${selection.confidence}`}>{label}</span>
        {unmatched && <span className="screenshot-unmatched">Not matched to a fixture</span>}
        {selection.note && <small>{selection.note}</small>}
      </div>
    </article>
  );
}
