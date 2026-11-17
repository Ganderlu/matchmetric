"use client";

import type { SlipTab } from "@/types/slip";

/** Game Slip is the general selection area; Auto Picks configures generated selections. */
export function SlipTabs({
  tab,
  slipCount,
  autoCount,
  onChange,
}: {
  tab: SlipTab;
  slipCount: number;
  autoCount: number;
  onChange: (tab: SlipTab) => void;
}) {
  return (
    <div className="slip-tabs" role="tablist" aria-label="Slip sections">
      <button
        type="button"
        role="tab"
        aria-selected={tab === "slip"}
        className={`slip-tab ${tab === "slip" ? "active" : ""}`}
        onClick={() => onChange("slip")}
      >
        Game Slip <span>{slipCount}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "auto"}
        className={`slip-tab ${tab === "auto" ? "active" : ""}`}
        onClick={() => onChange("auto")}
      >
        Auto Picks {autoCount > 0 && <span>{autoCount}</span>}
      </button>
    </div>
  );
}
