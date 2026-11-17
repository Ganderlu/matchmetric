"use client";

import { Sparkles, TicketCheck, Wand2 } from "lucide-react";
import { AutomaticMatchCard, SlipMatchCard } from "@/components/slip/SlipMatchCard";
import type { SlipEntry } from "@/types/slip";

/**
 * The general selection area.
 *
 * Every source lands in this one list. The card that renders is chosen by the entry's source,
 * which is what keeps a single slip honest: manual and screenshot entries expose Analyse
 * controls, automatic entries arrive analysed and expose removal only.
 */
export function GameSlipSection({
  entries,
  isAnalysing,
  analysingAll,
  onAnalyse,
  onAnalyseAll,
  onOpen,
  onRemove,
  onResetSelection,
}: {
  entries: SlipEntry[];
  isAnalysing: (fixtureId: string) => boolean;
  analysingAll: boolean;
  onAnalyse: (fixtureId: string) => void;
  onAnalyseAll: () => void;
  onOpen: (fixtureId: string) => void;
  onRemove: (fixtureId: string) => void;
  onResetSelection: (fixtureId: string) => void;
}) {
  if (!entries.length) {
    return (
      <div className="slip-empty">
        <span className="slip-empty-icon">
          <TicketCheck size={26} />
        </span>
        <strong>Your slip is empty</strong>
        <span>Add matches from the dashboard, generate auto picks, or import a bookmaker screenshot.</span>
      </div>
    );
  }

  const analysable = entries.filter(
    (entry) => (entry.source === "manual" || entry.source === "screenshot") && entry.analysable,
  );
  const pending = analysable.filter((entry) => entry.status !== "analysed");
  const hasAutomatic = entries.some((entry) => entry.source === "automatic");

  return (
    <div className="slip-section">
      <div className="slip-entry-list">
        {entries.map((entry) =>
          entry.source === "automatic" ? (
            <AutomaticMatchCard
              key={entry.fixtureId}
              entry={entry}
              onRemove={() => onRemove(entry.fixtureId)}
            />
          ) : (
            <SlipMatchCard
              key={entry.fixtureId}
              entry={entry}
              busy={isAnalysing(entry.fixtureId)}
              onAnalyse={() => onAnalyse(entry.fixtureId)}
              onOpen={() => onOpen(entry.fixtureId)}
              onRemove={() => onRemove(entry.fixtureId)}
              onResetSelection={() => onResetSelection(entry.fixtureId)}
            />
          ),
        )}
      </div>

      <div className="slip-section-actions">
        <button
          type="button"
          className="slip-analyse-all"
          onClick={onAnalyseAll}
          disabled={analysingAll || pending.length === 0}
        >
          {analysingAll ? (
            <>
              <span className="spinner" /> Analysing every game...
            </>
          ) : pending.length ? (
            <>
              <Wand2 size={16} strokeWidth={2.4} /> Analyse All Games ({pending.length})
            </>
          ) : (
            <>
              <Sparkles size={16} strokeWidth={2.4} /> All games analysed
            </>
          )}
        </button>
        {pending.length === 0 && analysable.length > 0 && (
          <p className="slip-section-note">
            Re-analyse an individual match from its card when its data is no longer current.
          </p>
        )}
        {!analysable.length && hasAutomatic && (
          <p className="slip-section-note">
            Automatic picks already include their analysis, so there is nothing left to run.
          </p>
        )}
      </div>
    </div>
  );
}
