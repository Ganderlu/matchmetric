"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface ProfileSectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  defaultOpen?: boolean;
  /** Controlled open state; omit to let the section manage its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/**
 * An expandable settings card. Sections are collapsed by default on mobile so the whole
 * Profile page stays scannable, and they keep the same grouped look on desktop.
 */
export function ProfileSection({
  icon: Icon,
  title,
  description,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
}: ProfileSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section className="profile-section">
      <button
        type="button"
        className="profile-section-toggle"
        aria-expanded={isOpen}
        onClick={toggle}
      >
        <span className="profile-section-icon">
          <Icon size={18} strokeWidth={1.9} />
        </span>
        <span className="profile-section-copy">
          <span className="profile-section-title">{title}</span>
          <span className="profile-section-desc">{description}</span>
        </span>
        <ChevronDown size={18} className={`profile-section-chevron ${isOpen ? "open" : ""}`} />
      </button>
      {isOpen ? <div className="profile-section-body">{children}</div> : null}
    </section>
  );
}
