"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BottomNavigation } from "@/components/mobile/BottomNavigation";
import { FloatingSlip } from "@/components/mobile/FloatingSlip";
import { MobileHeader } from "@/components/mobile/MobileHeader";

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
      <FloatingSlip />
      <BottomNavigation />
    </div>
  );
}
