"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BottomNavigation } from "@/components/mobile/BottomNavigation";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { ExpandedSlip } from "@/components/slip/ExpandedSlip";
import { FloatingSlipButton } from "@/components/slip/FloatingSlipButton";

interface PlaceholderPageProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function PlaceholderPage({ icon, title, description }: PlaceholderPageProps) {
  return (
    <div className="mm-app-layout">
      <MobileHeader />
      <main className="mm-main">
        <div className="mm-placeholder">
          <div className="mm-placeholder-icon">{icon}</div>
          <h1 className="mm-placeholder-title">{title}</h1>
          <p className="mm-placeholder-desc">{description}</p>
          <Link className="mm-placeholder-link" href="/">Back to Home</Link>
        </div>
      </main>
      <FloatingSlipButton />
      <ExpandedSlip />
      <BottomNavigation />
    </div>
  );
}
