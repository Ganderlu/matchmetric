"use client";

import { Check } from "lucide-react";

export type NoticeTone = "success" | "error" | "info";

export interface NoticeMessage {
  tone: NoticeTone;
  text: string;
}

/** Inline status message shared by every Profile block. */
export function Notice({ message }: { message: NoticeMessage | null }) {
  if (!message) return null;
  const tone =
    message.tone === "error" ? "error-notice" : message.tone === "success" ? "success-notice" : "";
  return (
    <div className={`notice ${tone}`} role="status">
      {message.tone === "success" ? (
        <Check size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
      ) : null}
      {message.text}
    </div>
  );
}

/** Touch-friendly switch built on the shared `.switch` styles. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`switch ${checked ? "on" : ""}`}
      style={disabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}

export function initials(name: string) {
  const value = name.trim();
  if (!value) return "MM";
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
