"use client";

import { CheckCircle2, ChevronRight, Flame, Plus, TrendingUp } from "lucide-react";
import type { FixtureView } from "@/lib/football/views";
import { useSlip } from "@/context/SlipContext";
import { entryFromFixture } from "@/lib/slip-analysis";

function TeamBadge({ team }: { team: FixtureView["home"] }) {
  if (team.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="mm-team-badge" src={team.logoUrl} alt="" loading="lazy" />;
  }
  return (
    <span className="mm-team-badge mm-team-badge-fallback">
      {team.short ?? team.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

interface HotPicksProps {
  featured: FixtureView | null;
  onOpenMatch: (fixture: FixtureView) => void;
}

export function HotPicks({ featured, onOpenMatch }: HotPicksProps) {
  const { addEntry, hasEntry } = useSlip();

  if (!featured) return null;

  const inSlip = hasEntry(featured.id);

  const handleAdd = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (inSlip) return;
    addEntry(entryFromFixture(featured, "manual"));
  };

  const time = new Date(featured.kickoff);
  const kickoffLabel = `${time.toLocaleDateString(undefined, { weekday: "short" })} ${time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <section className="mm-section">
      <div className="mm-section-head">
        <h2 className="mm-section-title"><Flame size={18} strokeWidth={2} /> Hot Picks</h2>
        <button className="mm-see-all">See all <ChevronRight size={14} strokeWidth={2} /></button>
      </div>
      <article className="mm-featured-card" onClick={() => onOpenMatch(featured)}>
        <div className="mm-featured-badge">
          <CheckCircle2 size={13} strokeWidth={2.2} /> Analysis Ready
        </div>
        <div className="mm-featured-teams">
          <div className="mm-featured-team">
            <TeamBadge team={featured.home} />
            <span className="mm-featured-team-name">{featured.home.name}</span>
          </div>
          <div className="mm-featured-vs">
            <span className="mm-featured-kickoff">{kickoffLabel}</span>
            <span className="mm-featured-league">{featured.league.flag} {featured.league.name}</span>
          </div>
          <div className="mm-featured-team">
            <TeamBadge team={featured.away} />
            <span className="mm-featured-team-name">{featured.away.name}</span>
          </div>
        </div>
        <div className="mm-featured-foot">
          <span className="mm-confidence"><TrendingUp size={14} strokeWidth={2} /> MatchMetric sample preview</span>
          <button
            className={`mm-add-btn ${inSlip ? "added" : ""}`}
            onClick={handleAdd}
            aria-label={inSlip ? "Already in slip" : "Add to slip"}
          >
            <Plus size={16} strokeWidth={2.4} /> {inSlip ? "Added" : "Add"}
          </button>
        </div>
      </article>
    </section>
  );
}
