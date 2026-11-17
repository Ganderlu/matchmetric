"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  analysisToEntryPatch,
  isAnalysableFixture,
  requestFixtureAnalysis,
} from "@/lib/slip-analysis";
import {
  MAX_SLIP_ENTRIES,
  type NewSlipEntry,
  type SlipEntry,
  type SlipPrediction,
  type SlipTab,
} from "@/types/slip";

/**
 * One slip state for every selection method.
 *
 * The dashboard, the automatic picks panel and the screenshot workflow all commit here, so a
 * mixture of manual, automatic and screenshot entries lives in a single list. Entry `source`
 * decides which controls a card renders; nothing about the list itself is method-specific.
 *
 * Analysis is driven from here rather than from a page, so the same call powers the
 * per-match Analyse button and Analyse All Games. In-flight work is tracked per fixture so a
 * card can show its own progress while the rest of the slip stays interactive.
 */

const STORAGE_KEY = "matchmetric:slip-entries";

interface AddResult {
  ok: boolean;
  merged?: boolean;
  reason?: string;
}

interface AnalyseAllResult {
  analysed: number;
  skipped: number;
}

interface SlipContextValue {
  entries: SlipEntry[];
  count: number;
  isOpen: boolean;
  openSlip: () => void;
  closeSlip: () => void;
  tab: SlipTab;
  setTab: (tab: SlipTab) => void;

  addEntry: (entry: NewSlipEntry | SlipEntry) => AddResult;
  addEntries: (entries: (NewSlipEntry | SlipEntry)[]) => AddResult;
  removeEntry: (fixtureId: string) => void;
  clearAll: () => void;
  hasEntry: (fixtureId: string) => boolean;
  getEntry: (fixtureId: string) => SlipEntry | undefined;

  analyseEntry: (fixtureId: string) => Promise<void>;
  analyseAll: () => Promise<AnalyseAllResult>;
  analysingAll: boolean;
  isAnalysing: (fixtureId: string) => boolean;

  selectPrediction: (fixtureId: string, prediction: SlipPrediction | undefined) => void;
  markSaved: (fixtureId: string, predictionId: string) => void;

  activeFixtureId: string | null;
  openAnalysis: (fixtureId: string) => void;
  closeAnalysis: () => void;

  message: string;
  setMessage: (message: string) => void;
}

const SlipContext = createContext<SlipContextValue | null>(null);

export function SlipProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<SlipEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<SlipTab>("slip");
  const [activeFixtureId, setActiveFixtureId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [restored, setRestored] = useState(false);
  const analysing = useRef(new Set<string>());
  const [analysingIds, setAnalysingIds] = useState<string[]>([]);
  const [analysingAll, setAnalysingAll] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SlipEntry[];
        if (Array.isArray(parsed)) {
          // An analysis that was in flight when the tab reloaded cannot still be running.
          setEntries(parsed.map((entry) => (entry.status === "analysing" ? { ...entry, status: "pending" } : entry)));
        }
      }
    } catch {
      // A slip that cannot be restored simply starts empty.
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // The slip keeps working in memory when storage is unavailable.
    }
  }, [entries, restored]);

  const normalise = useCallback((incoming: NewSlipEntry | SlipEntry): SlipEntry => {
    // A full SlipEntry (an automatic pick) already carries its analysis; a NewSlipEntry does not.
    const analysed = "status" in incoming ? incoming : null;
    return {
      fixtureId: incoming.fixtureId,
      homeTeam: incoming.homeTeam,
      awayTeam: incoming.awayTeam,
      competition: incoming.competition,
      leagueFlag: incoming.leagueFlag,
      kickoff: incoming.kickoff,
      provider: incoming.provider,
      source: incoming.source,
      analysable: isAnalysableFixture(incoming.fixtureId),
      addedAt: analysed?.addedAt ?? new Date().toISOString(),
      status: analysed?.status ?? "pending",
      originalUserSelection: incoming.originalUserSelection,
      matchMetricRecommendation: incoming.matchMetricRecommendation,
      userSelectedPrediction: incoming.userSelectedPrediction,
      highestProbability: analysed?.highestProbability ?? [],
      bestValue: analysed?.bestValue ?? [],
      analysisStatus: analysed?.analysisStatus,
      analysisSource: analysed?.analysisSource,
      dataQuality: analysed?.dataQuality,
      confidence: analysed?.confidence,
      analysisNote: analysed?.analysisNote,
      comparison: analysed?.comparison,
      modelVersion: analysed?.modelVersion,
      generatedAt: analysed?.generatedAt,
      savedPredictionId: analysed?.savedPredictionId,
    };
  }, []);

  const addEntry = useCallback(
    (incoming: NewSlipEntry | SlipEntry): AddResult => {
      const existing = entries.find((entry) => entry.fixtureId === incoming.fixtureId);
      if (existing) {
        if (incoming.originalUserSelection && !existing.originalUserSelection) {
          setEntries((current) =>
            current.map((entry) =>
              entry.fixtureId === incoming.fixtureId
                ? {
                    ...entry,
                    originalUserSelection: incoming.originalUserSelection,
                    comparison: { status: "unverified", note: "Imported again from a screenshot. Confirm the outcome you want to keep." },
                  }
                : entry,
            ),
          );
          return { ok: true, merged: true, reason: "Updated the imported selection for a match already in your slip." };
        }
        return { ok: true, merged: true, reason: "That match is already in your slip." };
      }
      if (entries.length >= MAX_SLIP_ENTRIES) {
        return { ok: false, reason: `Your slip holds up to ${MAX_SLIP_ENTRIES} matches. Remove one to add another.` };
      }
      setEntries((current) => [...current, normalise(incoming)]);
      return { ok: true };
    },
    [entries, normalise],
  );

  const addEntries = useCallback(
    (incoming: (NewSlipEntry | SlipEntry)[]): AddResult => {
      let added = 0;
      let merged = 0;
      let reason: string | undefined;

      setEntries((current) => {
        const next = [...current];
        for (const candidate of incoming) {
          const index = next.findIndex((entry) => entry.fixtureId === candidate.fixtureId);
          if (index >= 0) {
            if (candidate.originalUserSelection && !next[index]?.originalUserSelection) {
              next[index] = { ...next[index], originalUserSelection: candidate.originalUserSelection };
            }
            merged += 1;
            continue;
          }
          if (next.length >= MAX_SLIP_ENTRIES) {
            reason = `Your slip holds up to ${MAX_SLIP_ENTRIES} matches. ${incoming.length - added - merged} were not added.`;
            break;
          }
          next.push(normalise(candidate));
          added += 1;
        }
        return next;
      });

      return { ok: added > 0, merged: merged > 0, reason };
    },
    [normalise],
  );

  const removeEntry = useCallback((fixtureId: string) => {
    setEntries((current) => current.filter((entry) => entry.fixtureId !== fixtureId));
    setActiveFixtureId((current) => (current === fixtureId ? null : current));
  }, []);

  const clearAll = useCallback(() => {
    setEntries([]);
    setActiveFixtureId(null);
    setMessage("");
  }, []);

  const hasEntry = useCallback((fixtureId: string) => entries.some((entry) => entry.fixtureId === fixtureId), [entries]);

  const getEntry = useCallback(
    (fixtureId: string) => entries.find((entry) => entry.fixtureId === fixtureId),
    [entries],
  );

  const patchEntry = useCallback((fixtureId: string, patch: Partial<SlipEntry>) => {
    setEntries((current) =>
      current.map((entry) => (entry.fixtureId === fixtureId ? { ...entry, ...patch } : entry)),
    );
  }, []);

  const analyseEntry = useCallback(
    async (fixtureId: string) => {
      const entry = entries.find((candidate) => candidate.fixtureId === fixtureId);
      if (!entry || analysing.current.has(fixtureId)) return;

      if (!entry.analysable) {
        patchEntry(fixtureId, {
          status: "error",
          analysisNote:
            "This fixture is demonstration data, so MatchMetric will not produce a prediction for it.",
        });
        return;
      }

      analysing.current.add(fixtureId);
      setAnalysingIds(Array.from(analysing.current));
      patchEntry(fixtureId, { status: "analysing", analysisNote: undefined });

      try {
        const { result, source } = await requestFixtureAnalysis(fixtureId);
        patchEntry(fixtureId, analysisToEntryPatch(result, source));
      } catch (error) {
        patchEntry(fixtureId, {
          status: "error",
          analysisNote: error instanceof Error ? error.message : "Analysis failed. Please try again.",
        });
      } finally {
        analysing.current.delete(fixtureId);
        setAnalysingIds(Array.from(analysing.current));
      }
    },
    [entries, patchEntry],
  );

  const analyseAll = useCallback(async (): Promise<AnalyseAllResult> => {
    const pending = entries.filter(
      (entry) => (entry.source === "manual" || entry.source === "screenshot") && entry.status !== "analysed",
    );
    if (!pending.length) return { analysed: 0, skipped: entries.length };

    setAnalysingAll(true);
    let analysed = 0;
    let skipped = 0;
    for (const entry of pending) {
      if (!entry.analysable) {
        patchEntry(entry.fixtureId, {
          status: "error",
          analysisNote: "Demonstration data is never analysed. Add a real provider fixture to run the model.",
        });
        skipped += 1;
        continue;
      }
      await analyseEntry(entry.fixtureId);
      analysed += 1;
    }
    setAnalysingAll(false);
    return { analysed, skipped };
  }, [analyseEntry, entries, patchEntry]);

  const isAnalysing = useCallback((fixtureId: string) => analysingIds.includes(fixtureId), [analysingIds]);

  const selectPrediction = useCallback(
    (fixtureId: string, prediction: SlipPrediction | undefined) => {
      patchEntry(fixtureId, {
        userSelectedPrediction: prediction
          ? { market: prediction.marketLabel, selection: prediction.selection }
          : undefined,
      });
    },
    [patchEntry],
  );

  const markSaved = useCallback(
    (fixtureId: string, predictionId: string) => patchEntry(fixtureId, { savedPredictionId: predictionId }),
    [patchEntry],
  );

  const openSlip = useCallback(() => {
    setMessage("");
    setIsOpen(true);
  }, []);
  const closeSlip = useCallback(() => {
    setIsOpen(false);
    setActiveFixtureId(null);
  }, []);
  const openAnalysis = useCallback((fixtureId: string) => setActiveFixtureId(fixtureId), []);
  const closeAnalysis = useCallback(() => setActiveFixtureId(null), []);

  const value = useMemo<SlipContextValue>(
    () => ({
      entries,
      count: entries.length,
      isOpen,
      openSlip,
      closeSlip,
      tab,
      setTab,
      addEntry,
      addEntries,
      removeEntry,
      clearAll,
      hasEntry,
      getEntry,
      analyseEntry,
      analyseAll,
      analysingAll,
      isAnalysing,
      selectPrediction,
      markSaved,
      activeFixtureId,
      openAnalysis,
      closeAnalysis,
      message,
      setMessage,
    }),
    [
      entries,
      isOpen,
      openSlip,
      closeSlip,
      tab,
      addEntry,
      addEntries,
      removeEntry,
      clearAll,
      hasEntry,
      getEntry,
      analyseEntry,
      analyseAll,
      analysingAll,
      isAnalysing,
      selectPrediction,
      markSaved,
      activeFixtureId,
      openAnalysis,
      closeAnalysis,
      message,
    ],
  );

  return <SlipContext.Provider value={value}>{children}</SlipContext.Provider>;
}

export function useSlip() {
  const context = useContext(SlipContext);
  if (!context) throw new Error("useSlip must be used within a SlipProvider.");
  return context;
}
