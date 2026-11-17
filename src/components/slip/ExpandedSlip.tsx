"use client";

import { useEffect, useState } from "react";
import { useSlip } from "@/context/SlipContext";
import { useSlipActions } from "@/hooks/use-slip-actions";
import { ScreenshotWorkflow } from "@/components/screenshot/ScreenshotWorkflow";
import { AutoPicksSection } from "@/components/slip/AutoPicksSection";
import { ClearSlipDialog } from "@/components/slip/ClearSlipDialog";
import { GameSlipSection } from "@/components/slip/GameSlipSection";
import { MatchAnalysisPanel } from "@/components/slip/MatchAnalysisPanel";
import { ShareSlipDialog } from "@/components/slip/ShareSlipDialog";
import { SlipActionBar } from "@/components/slip/SlipActionBar";
import { SlipHeader } from "@/components/slip/SlipHeader";
import { SlipTabs } from "@/components/slip/SlipTabs";

/**
 * The expanded slip.
 *
 * One container hosts the Game Slip list, the automatic picks configuration, the per-fixture
 * analysis panel and the screenshot workflow. Which of those is visible is the only difference
 * between them — they all read and write the same unified slip state.
 *
 * On mobile this is a bottom sheet; on desktop it is a right-side panel. The bottom navigation
 * is never covered on mobile because the sheet stops above it.
 */
export function ExpandedSlip() {
  const {
    isOpen,
    closeSlip,
    entries,
    count,
    tab,
    setTab,
    clearAll,
    removeEntry,
    analyseEntry,
    analyseAll,
    analysingAll,
    isAnalysing,
    selectPrediction,
    activeFixtureId,
    openAnalysis,
    closeAnalysis,
    message,
    setMessage,
  } = useSlip();
  const { save, saving } = useSlipActions();

  const [screenshot, setScreenshot] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [share, setShare] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSlip();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSlip, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setScreenshot(false);
      setConfirmClear(false);
      setShare(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeEntry = activeFixtureId
    ? entries.find((entry) => entry.fixtureId === activeFixtureId)
    : undefined;
  const autoCount = entries.filter((entry) => entry.source === "automatic").length;
  const showActionBar = !screenshot && !activeEntry && tab === "slip";

  return (
    <div className="slip-backdrop" onClick={closeSlip}>
      <section
        className="slip-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slip-title"
        onClick={(event) => event.stopPropagation()}
      >
        <SlipHeader
          count={count}
          onClose={closeSlip}
          onScreenshot={() => {
            setMessage("");
            setScreenshot(true);
          }}
          onClear={() => setConfirmClear(true)}
          disabled={!count}
        />

        <div className="slip-panel-body">
          {message && (
            <p className="slip-msg" role="status">
              {message}
            </p>
          )}

          {screenshot ? (
            <ScreenshotWorkflow onClose={() => setScreenshot(false)} />
          ) : activeEntry ? (
            <MatchAnalysisPanel
              entry={activeEntry}
              busy={isAnalysing(activeEntry.fixtureId)}
              onBack={closeAnalysis}
              onAnalyse={() => void analyseEntry(activeEntry.fixtureId)}
              onSelect={(prediction) => selectPrediction(activeEntry.fixtureId, prediction)}
            />
          ) : (
            <>
              <SlipTabs tab={tab} slipCount={entries.length} autoCount={autoCount} onChange={setTab} />
              {tab === "slip" ? (
                <GameSlipSection
                  entries={entries}
                  isAnalysing={isAnalysing}
                  analysingAll={analysingAll}
                  onAnalyse={(fixtureId) => void analyseEntry(fixtureId)}
                  onAnalyseAll={() => void analyseAll()}
                  onOpen={openAnalysis}
                  onRemove={removeEntry}
                  onResetSelection={(fixtureId) => selectPrediction(fixtureId, undefined)}
                />
              ) : (
                <AutoPicksSection />
              )}
            </>
          )}
        </div>

        {showActionBar && (
          <SlipActionBar
            entries={entries}
            saving={saving}
            onSave={() => void save(entries)}
            onShare={() => setShare(true)}
          />
        )}
      </section>

      {confirmClear && (
        <ClearSlipDialog
          count={count}
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            clearAll();
            setConfirmClear(false);
          }}
        />
      )}
      {share && <ShareSlipDialog entries={entries} onClose={() => setShare(false)} />}
    </div>
  );
}
