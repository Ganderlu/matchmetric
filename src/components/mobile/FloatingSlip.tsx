"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { TicketCheck, X } from "lucide-react";
import { useSlip } from "@/context/SlipContext";

const POSITION_KEY = "matchmetric:slip-position";
const ANALYZE_ON_LOAD_KEY = "matchmetric:manual-auto-analyze";
const SELECTION_STORAGE_KEY = "matchmetric:manual-selection";
const MAX_ANALYSIS_SELECTIONS = 5;

interface FloatPosition {
  left: number;
  top: number;
}

function clampPosition(left: number, top: number): FloatPosition {
  const buttonSize = 76;
  return {
    left: Math.max(8, Math.min(left, window.innerWidth - buttonSize - 8)),
    top: Math.max(76, Math.min(top, window.innerHeight - buttonSize - 76)),
  };
}

export function FloatingSlip() {
  const { entries, count, isOpen, openSlip, closeSlip, removeEntry } = useSlip();
  const [message, setMessage] = useState("");
  const [position, setPosition] = useState<FloatPosition | null>(null);
  const [dockedSide, setDockedSide] = useState<"left" | "right">("right");
  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    let side: "left" | "right" = "right";
    let top = Math.round(window.innerHeight * 0.52);
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { side?: string; top?: number };
        if ((parsed.side === "left" || parsed.side === "right") && Number.isFinite(parsed.top)) {
          side = parsed.side;
          top = parsed.top as number;
        }
      }
    } catch {
      // Keep the default position when local storage is unavailable.
    }
    setDockedSide(side);
    setPosition(clampPosition(side === "left" ? 8 : window.innerWidth - 84, top));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSlip();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSlip, isOpen]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => {
        if (!current) return current;
        return clampPosition(dockedSide === "left" ? 8 : window.innerWidth - 84, current.top);
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [dockedSide]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top };
    draggedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const origin = dragRef.current;
    if (!origin) return;
    const deltaX = event.clientX - origin.startX;
    const deltaY = event.clientY - origin.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) draggedRef.current = true;
    if (draggedRef.current) setPosition(clampPosition(origin.left + deltaX, origin.top + deltaY));
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || !position) return;
    dragRef.current = null;
    const side = position.left + 38 < window.innerWidth / 2 ? "left" : "right";
    const snapped = clampPosition(side === "left" ? 8 : window.innerWidth - 84, position.top);
    setDockedSide(side);
    setPosition(snapped);
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify({ side, top: snapped.top }));
    } catch {
      // The slip remains usable even when its position cannot be saved.
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleAnalyse = useCallback(() => {
    if (count === 0) {
      setMessage("Add at least one match to analyse.");
      return;
    }
    if (count > MAX_ANALYSIS_SELECTIONS) {
      setMessage(`Remove ${count - MAX_ANALYSIS_SELECTIONS} selection${count - MAX_ANALYSIS_SELECTIONS === 1 ? "" : "s"} to analyse up to ${MAX_ANALYSIS_SELECTIONS} matches at a time.`);
      return;
    }
    setMessage("");
    try {
      sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(entries.map((entry) => entry.fixtureId)));
      sessionStorage.setItem(ANALYZE_ON_LOAD_KEY, "1");
    } catch {
      setMessage("Your selections could not be prepared for analysis. Please try again.");
      return;
    }
    closeSlip();
    window.location.assign("/manual-analysis#analysis-panel");
  }, [closeSlip, count, entries]);

  return (
    <>
      <button
        type="button"
        className={`mm-slip-fab ${position ? "positioned" : ""}`}
        style={position ? { left: position.left, top: position.top } : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { dragRef.current = null; draggedRef.current = false; }}
        onClick={() => {
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }
          setMessage("");
          openSlip();
        }}
        aria-label={`Open match slip with ${count} selection${count === 1 ? "" : "s"}. Drag to move.`}
        aria-expanded={isOpen}
        title="Open slip. Drag to move."
      >
        <TicketCheck size={34} strokeWidth={2.2} aria-hidden="true" />
        <span className="mm-slip-fab-count" aria-hidden="true">{count}</span>
      </button>

      {isOpen && (
        <div className="mm-slip-backdrop" onClick={closeSlip}>
          <section
            className={`mm-slip-sheet mm-slip-sheet-${dockedSide}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mm-slip-title"
          >
            <div className="mm-slip-sheet-head">
              <div>
                <span className="mm-slip-eyebrow">MATCHMETRIC</span>
                <h2 id="mm-slip-title">Your slip <span>{count}</span></h2>
              </div>
              <button className="mm-icon-button" onClick={closeSlip} aria-label="Close slip"><X size={18} /></button>
            </div>
            {count === 0 ? (
              <div className="mm-empty">
                <TicketCheck size={28} />
                <strong>No selections yet</strong>
                <span>Tap the + button on any match to add it to your slip.</span>
              </div>
            ) : (
              <div className="mm-slip-list">
                {entries.map((entry) => (
                  <div className="mm-slip-row" key={entry.fixtureId}>
                    <div className="mm-slip-row-info">
                      <strong>{entry.homeTeam} <span>vs</span> {entry.awayTeam}</strong>
                      <small>{entry.competition}</small>
                    </div>
                    <button
                      className="mm-slip-remove"
                      onClick={() => removeEntry(entry.fixtureId)}
                      aria-label={`Remove ${entry.homeTeam} vs ${entry.awayTeam}`}
                      title="Remove selection"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {message && <p className="mm-slip-msg" role="status">{message}</p>}
            <div className="mm-slip-sheet-footer">
              <span>
                {count > MAX_ANALYSIS_SELECTIONS
                  ? `Remove ${count - MAX_ANALYSIS_SELECTIONS} selection${count - MAX_ANALYSIS_SELECTIONS === 1 ? "" : "s"} to continue.`
                  : `Up to ${MAX_ANALYSIS_SELECTIONS} matches per analysis`}
              </span>
              <button className="mm-analyse-btn mm-analyse-full" onClick={handleAnalyse} disabled={count === 0 || count > MAX_ANALYSIS_SELECTIONS}>
                Analyse {count ? `${count} match${count === 1 ? "" : "es"}` : "selections"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
