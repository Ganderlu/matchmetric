"use client";

import { useCallback, useState } from "react";
import { useSlip } from "@/context/SlipContext";
import { fetchFixtureFeed } from "@/lib/football-client";
import {
  analysisToEntryPatch,
  buildDemonstrationExtraction,
  isAnalysableFixture,
  requestFixtureAnalysis,
} from "@/lib/slip-analysis";
import { ScreenshotComparison } from "@/components/screenshot/ScreenshotComparison";
import { ExtractedSelections } from "@/components/screenshot/ExtractedSelections";
import { ScreenshotUpload } from "@/components/screenshot/ScreenshotUpload";
import type {
  ExtractedSelection,
  ScreenshotComparisonRow,
  ScreenshotExtraction,
  SlipEntry,
  SlipPrediction,
  SlipSelection,
} from "@/types/slip";

/**
 * Screenshot workflow: upload, verify, then either Add to Slip or Replay Game.
 *
 * Comparison state lives here rather than in the shared slip, which is what separates temporary
 * comparison data from the user's own selections: nothing reaches the slip until the user either
 * adds the fixtures or explicitly converts the comparison.
 */

type Stage = "upload" | "verify" | "compare";

const isoDate = (offsetDays: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function compareSelections(
  user: SlipSelection,
  prediction: SlipPrediction | undefined,
  analysisNote?: string,
): { status: ScreenshotComparisonRow["status"]; note: string } {
  if (!prediction) {
    return {
      status: "unverified",
      note:
        analysisNote ??
        "MatchMetric has no priced recommendation for this fixture, so there is nothing to compare.",
    };
  }
  const userOutcome = normalise(user.selection);
  const engineOutcome = normalise(prediction.selection);
  if (userOutcome && engineOutcome && (userOutcome === engineOutcome || userOutcome.includes(engineOutcome) || engineOutcome.includes(userOutcome))) {
    return {
      status: "match",
      note: `MatchMetric's evaluation agrees with this selection at ${prediction.probability.toFixed(1)}%.`,
    };
  }
  return {
    status: "change",
    note: `MatchMetric rates ${prediction.marketLabel} — ${prediction.selection} at ${prediction.probability.toFixed(1)}%. This is a suggested alternative, not a guaranteed mistake.`,
  };
}

function rowToEntry(row: ScreenshotComparisonRow): SlipEntry | null {
  if (!row.fixtureId) return null;
  const entry: SlipEntry = {
    fixtureId: row.fixtureId,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    competition: row.competition,
    kickoff: row.kickoff,
    source: "screenshot",
    status: "pending",
    analysable: row.analysable,
    addedAt: new Date().toISOString(),
    originalUserSelection: row.userSelection,
    highestProbability: [],
    bestValue: [],
    ...(row.analysis ?? {}),
    comparison: { status: row.status, note: row.note },
  };
  if (row.status === "change" && row.recommendation) {
    entry.userSelectedPrediction = {
      market: row.recommendation.marketLabel,
      selection: row.recommendation.selection,
    };
  }
  return entry;
}

export function ScreenshotWorkflow({ onClose }: { onClose: () => void }) {
  const { addEntries, setTab, setMessage } = useSlip();
  const [stage, setStage] = useState<Stage>("upload");
  const [extraction, setExtraction] = useState<ScreenshotExtraction | null>(null);
  const [rows, setRows] = useState<ScreenshotComparisonRow[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");

  const extract = useCallback(async (_file: File, previewUrl: string) => {
    setExtracting(true);
    setError("");
    try {
      const payload = await fetchFixtureFeed({ from: isoDate(0), to: isoDate(3), perPage: 60 });
      const fixtures = payload.fixtures.filter((fixture) => isAnalysableFixture(fixture.id));
      if (!fixtures.length) {
        setError(
          payload.notice ??
            "No provider-backed fixtures are available to match your slip against. Screenshot comparison needs real fixture data.",
        );
        return;
      }
      setExtraction(buildDemonstrationExtraction(fixtures, _file.name, previewUrl));
      setStage("verify");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The screenshot could not be processed.");
    } finally {
      setExtracting(false);
    }
  }, []);

  const removeSelection = (id: string) =>
    setExtraction((current) =>
      current ? { ...current, selections: current.selections.filter((selection) => selection.id !== id) } : current,
    );

  const addToSlip = () => {
    if (!extraction) return;
    const entries: SlipEntry[] = extraction.selections
      .filter((selection): selection is ExtractedSelection & { fixtureId: string } => Boolean(selection.fixtureId))
      .map((selection) => ({
        fixtureId: selection.fixtureId,
        homeTeam: selection.homeTeam,
        awayTeam: selection.awayTeam,
        competition: selection.competition,
        kickoff: selection.kickoff,
        source: "screenshot",
        status: "pending",
        analysable: isAnalysableFixture(selection.fixtureId),
        addedAt: new Date().toISOString(),
        originalUserSelection: { market: selection.market, selection: selection.selection },
        highestProbability: [],
        bestValue: [],
      }));

    if (!entries.length) {
      setError("None of these selections could be matched to a MatchMetric fixture.");
      return;
    }
    const result = addEntries(entries);
    if (!result.ok && result.reason) {
      setError(result.reason);
      return;
    }
    setMessage(`${entries.length} screenshot ${entries.length === 1 ? "selection" : "selections"} added to your Game Slip.`);
    setTab("slip");
    onClose();
  };

  const replay = async () => {
    if (!extraction) return;
    setStage("compare");
    setComparing(true);
    setError("");
    try {
      const compared: ScreenshotComparisonRow[] = await Promise.all(
        extraction.selections.map(async (selection) => {
          const base: Omit<ScreenshotComparisonRow, "status" | "note"> = {
            id: selection.id,
            fixtureId: selection.fixtureId,
            homeTeam: selection.homeTeam,
            awayTeam: selection.awayTeam,
            competition: selection.competition,
            kickoff: selection.kickoff,
            analysable: Boolean(selection.fixtureId && isAnalysableFixture(selection.fixtureId)),
            userSelection: { market: selection.market, selection: selection.selection },
          };

          if (!base.analysable || !selection.fixtureId) {
            return {
              ...base,
              status: "unverified" as const,
              note:
                selection.note ??
                "This selection could not be resolved to a provider-backed MatchMetric fixture, so no comparison was made.",
            };
          }

          try {
            const { result, source } = await requestFixtureAnalysis(selection.fixtureId);
            const analysis = analysisToEntryPatch(result, source);
            const recommendation = analysis.matchMetricRecommendation;
            const comparison = compareSelections(base.userSelection, recommendation, analysis.analysisNote);
            return { ...base, analysis, recommendation, status: comparison.status, note: comparison.note };
          } catch (cause) {
            return {
              ...base,
              status: "unverified" as const,
              note: cause instanceof Error ? cause.message : "Comparison failed for this fixture.",
            };
          }
        }),
      );
      setRows(compared);
    } finally {
      setComparing(false);
    }
  };

  const convert = () => {
    setConverting(true);
    const entries = rows.map(rowToEntry).filter((entry): entry is SlipEntry => entry !== null);
    if (!entries.length) {
      setError("None of the compared selections could be converted.");
      setConverting(false);
      return;
    }
    const result = addEntries(entries);
    if (!result.ok && result.reason) {
      setError(result.reason);
      setConverting(false);
      return;
    }
    setMessage(`${entries.length} converted ${entries.length === 1 ? "fixture" : "fixtures"} moved into your Game Slip.`);
    setTab("slip");
    onClose();
  };

  if (stage === "verify" && extraction) {
    return (
      <ExtractedSelections
        extraction={extraction}
        onAddToSlip={addToSlip}
        onReplay={replay}
        onRemove={removeSelection}
        onBack={() => {
          setStage("upload");
          setError("");
        }}
      />
    );
  }

  if (stage === "compare") {
    return (
      <ScreenshotComparison
        rows={rows}
        loading={comparing}
        converting={converting}
        onConvert={convert}
        onCancel={() => {
          setStage("verify");
          setError("");
        }}
        onRemove={(id) => setRows((current) => current.filter((row) => row.id !== id))}
      />
    );
  }

  return <ScreenshotUpload busy={extracting} error={error} onExtract={extract} />;
}
