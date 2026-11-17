"use client";

import { useCallback, useState } from "react";
import { useSlip } from "@/context/SlipContext";
import {
  effectivePrediction,
  effectiveSelection,
  saveSlipPredictions,
  type SavedSelectionInput,
} from "@/lib/slip-analysis";
import type { SlipEntry } from "@/types/slip";

/**
 * Saving a slip to Open Games.
 *
 * MatchMetric is not a bookmaker, so "saving" records the prediction entry the user can later
 * find in Open Games and History. The request keeps three things apart — the engine's
 * recommendation, the selection the user finally chose, and where the entry came from — so the
 * ledger can grade the user's actual choice without losing MatchMetric's own pick.
 */
export function useSlipActions() {
  const { markSaved, setMessage } = useSlip();
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (entries: SlipEntry[]): Promise<boolean> => {
      const savable = entries.filter((entry) => entry.analysable && entry.matchMetricRecommendation);
      if (!savable.length) {
        setMessage("Analyse at least one real-provider match before saving it to Open Games.");
        return false;
      }

      const fixtureIds = savable.map((entry) => entry.fixtureId);
      const selections: SavedSelectionInput[] = savable.map((entry) => {
        const chosen = effectiveSelection(entry);
        const priced = effectivePrediction(entry);
        const recommendation = entry.matchMetricRecommendation;
        return {
          fixtureId: entry.fixtureId,
          market: chosen?.market ?? recommendation?.marketLabel ?? "",
          selection: chosen?.selection ?? recommendation?.selection ?? "",
          source: entry.source,
          // Odds and probability are captured at save time, straight from the engine's result.
          odds: priced?.odds ?? recommendation?.odds,
          probability: priced?.probability ?? recommendation?.probability,
        };
      });

      setSaving(true);
      setMessage("");
      try {
        const { id } = await saveSlipPredictions(fixtureIds, selections);
        savable.forEach((entry) => markSaved(entry.fixtureId, id));
        setMessage(
          `Saved ${savable.length} ${savable.length === 1 ? "selection" : "selections"} to Open Games.`,
        );
        return true;
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The prediction could not be saved.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [markSaved, setMessage],
  );

  return { save, saving };
}
