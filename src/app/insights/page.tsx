"use client";

import { useState } from "react";
import { EngineInsightsPanel } from "@/components/insights/EngineInsightsPanel";
import { InsightsControls, InsightsScopeNote } from "@/components/insights/InsightsControls";
import { PersonalInsightsPanel } from "@/components/insights/PersonalInsightsPanel";
import { BottomNavigation } from "@/components/mobile/BottomNavigation";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { ExpandedSlip } from "@/components/slip/ExpandedSlip";
import { FloatingSlipButton } from "@/components/slip/FloatingSlipButton";
import { DEFAULT_INSIGHTS_QUERY, useInsights } from "@/hooks/use-insights";
import type { InsightsTab } from "@/lib/insights/types";

/**
 * Insights.
 *
 * Two datasets, one screen, never merged: "My Performance" grades the member's own saved
 * history, "MatchMetric Performance" grades the engine's archived recommendations. The
 * statistics themselves are calculated by the analytics service behind `/api/insights`; this
 * page only presents them.
 */
export default function InsightsPage() {
  const [tab, setTab] = useState<InsightsTab>("mine");
  const [query, setQuery] = useState(DEFAULT_INSIGHTS_QUERY);
  const { payload, loading, error } = useInsights(query);

  const filterActive = Boolean(
    query.competition || query.market || query.source || query.range !== "all",
  );

  return (
    <div className="mm-app-layout">
      <div className="mm-main-wrap">
        <MobileHeader />

        <main className="mm-main">
          <div className="insights-page">
            <header className="insights-head">
              <p className="insights-eyebrow">Analytics</p>
              <h1>Insights</h1>
              <p>Your own record and the MatchMetric engine&rsquo;s, reported separately and never combined.</p>
            </header>

            <InsightsControls
              tab={tab}
              onTab={setTab}
              query={query}
              onChange={setQuery}
              filters={payload?.filters}
            />

            {loading ? (
              <div className="insights-loading">
                <div className="skeleton" style={{ height: 138, borderRadius: 16 }} />
                <div className="skeleton" style={{ height: 196, borderRadius: 16 }} />
                <div className="skeleton" style={{ height: 168, borderRadius: 16 }} />
              </div>
            ) : error ? (
              <div className="notice error-notice" role="status">
                {error}
              </div>
            ) : payload ? (
              <>
                {tab === "mine" ? (
                  <PersonalInsightsPanel personal={payload.personal} filterActive={filterActive} />
                ) : (
                  <EngineInsightsPanel engine={payload.engine} />
                )}
                <InsightsScopeNote rangeLabel={payload.range.label} />
              </>
            ) : null}
          </div>
        </main>
      </div>

      <FloatingSlipButton />
      <ExpandedSlip />
      <BottomNavigation />
    </div>
  );
}
