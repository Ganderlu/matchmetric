"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ProfileMenuItemProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Right-aligned value, e.g. a saved preference. */
  value?: string;
  /** Rendered in place of the chevron, e.g. a button. */
  action?: ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger";
}

/**
 * A single row inside a settings section. Renders as a button when it is tappable and as a
 * static row when it only displays information.
 */
export function ProfileMenuItem({
  icon: Icon,
  title,
  subtitle,
  value,
  action,
  onClick,
  tone = "default",
}: ProfileMenuItemProps) {
  const interactive = Boolean(onClick);
  const iconColor = tone === "danger" ? "#ff9eaa" : undefined;
  const titleColor = tone === "danger" ? "#ff9eaa" : undefined;

  const content = (
    <>
      <span className="profile-row-icon" style={iconColor ? { color: iconColor } : undefined}>
        <Icon size={16} strokeWidth={1.9} />
      </span>
      <span className="profile-row-copy">
        <span className="profile-row-title" style={titleColor ? { color: titleColor } : undefined}>
          {title}
        </span>
        {subtitle ? <span className="profile-row-sub">{subtitle}</span> : null}
      </span>
      {value ? <span className="profile-row-value">{value}</span> : null}
      {action ?? null}
      {interactive ? <ChevronRight size={16} className="profile-row-chevron" /> : null}
    </>
  );

  if (!interactive) {
    return <div className="profile-row static">{content}</div>;
  }

  return (
    <button type="button" className="profile-row" onClick={onClick}>
      {content}
    </button>
  );
}
