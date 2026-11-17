"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { TicketCheck } from "lucide-react";
import { useSlip } from "@/context/SlipContext";

/**
 * The closed slip: a floating green ticket button.
 *
 * It keeps the existing MatchMetric appearance and behaviour — draggable, docked to whichever
 * edge it is released nearest, with its position persisted so it stays put between visits — and
 * updates its counter the moment a match is added or removed.
 */

const POSITION_KEY = "matchmetric:slip-position";
const BUTTON_SIZE = 76;

interface FloatPosition {
  left: number;
  top: number;
}

function clampPosition(left: number, top: number): FloatPosition {
  const dockLeft = left + BUTTON_SIZE / 2 < window.innerWidth / 2;
  return {
    left: dockLeft ? 8 : window.innerWidth - BUTTON_SIZE - 8,
    top: Math.max(76, Math.min(top, window.innerHeight - BUTTON_SIZE - 76)),
  };
}

export function FloatingSlipButton() {
  const { count, isOpen, openSlip } = useSlip();
  const [position, setPosition] = useState<FloatPosition | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    let left = window.innerWidth - BUTTON_SIZE - 8;
    let top = Math.round(window.innerHeight * 0.52);
    try {
      const saved = localStorage.getItem(POSITION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { side?: string; top?: number };
        if ((parsed.side === "left" || parsed.side === "right") && Number.isFinite(parsed.top)) {
          left = parsed.side === "left" ? 8 : window.innerWidth - BUTTON_SIZE - 8;
          top = parsed.top as number;
        }
      }
    } catch {
      // Keep the default position when local storage is unavailable.
    }
    setPosition(clampPosition(left, top));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => (current ? clampPosition(current.left, current.top) : current));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    const origin = dragRef.current;
    dragRef.current = null;
    if (origin) {
      const rect = event.currentTarget.getBoundingClientRect();
      const dockLeft = rect.left + BUTTON_SIZE / 2 < window.innerWidth / 2;
      try {
        localStorage.setItem(POSITION_KEY, JSON.stringify({ side: dockLeft ? "left" : "right", top: rect.top }));
      } catch {
        // The slip remains usable even when its position cannot be saved.
      }
      setPosition(clampPosition(rect.left, rect.top));
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleClick = useCallback(() => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    openSlip();
  }, [openSlip]);

  return (
    <button
      type="button"
      className={`mm-slip-fab ${position ? "positioned" : ""}`}
      style={position ? { left: position.left, top: position.top } : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
        draggedRef.current = false;
      }}
      onClick={handleClick}
      aria-label={`Open MatchMetric slip with ${count} selection${count === 1 ? "" : "s"}. Drag to move.`}
      aria-expanded={isOpen}
      title="Open slip. Drag to move."
    >
      <TicketCheck size={34} strokeWidth={2.2} aria-hidden="true" />
      <span className="mm-slip-fab-count" aria-hidden="true">
        {count}
      </span>
    </button>
  );
}
