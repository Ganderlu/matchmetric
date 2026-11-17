"use client";

import { CalendarDays, ChevronRight, Plus, TrendingUp } from "lucide-react";
import type { FixtureView } from "@/lib/football/views";
import { useSlip } from "@/context/SlipContext";
import { entryFromFixture } from "@/lib/slip-analysis";

function TeamBadge({ team }: { team: FixtureView["home"] }) {
  if (team.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="mm-card-badge" src={team.logoUrl} alt="" loading="lazy" />;
  }
  return (
    <span className="mm-card-badge mm-card-badge-fallback">
      {team.short ?? team.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

interface MatchCardProps {
  fixture: FixtureView;
  onOpenMatch: (fixture: FixtureView) => void;
}

function MatchCard({ fixture, onOpenMatch }: MatchCardProps) {
  const { addEntry, removeEntry, hasEntry } = useSlip();
  const inSlip = hasEntry(fixture.id);
  const isLive = fixture.status === "live" || fixture.status === "halftime";
  const isFinished = fixture.status === "finished";

  const toggleSlip = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (inSlip) {
      removeEntry(fixture.id);
      return;
    }
    addEntry(entryFromFixture(fixture, "manual"));
  };

  const time = new Date(fixture.kickoff);
  const kickoffLabel = time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <article className="mm-match-card" onClick={() => onOpenMatch(fixture)}>
      <div className="mm-match-head">
        <span className="mm-match-league">{fixture.league.flag} {fixture.league.name}</span>
        <span className="mm-match-time">
          {isLive ? (
            <span className="mm-live-pill"><span className="mm-live-dot" />{fixture.minute ? `${fixture.minute}'` : "LIVE"}</span>
          ) : isFinished && fixture.score ? (
            <span className="mm-score-pill">FT {fixture.score.home}–{fixture.score.away}</span>
          ) : (
            kickoffLabel
          )}
        </span>
      </div>
      <div className="mm-match-body">
        <div className="mm-match-team">
          <TeamBadge team={fixture.home} />
          <span className="mm-match-team-name">{fixture.home.name}</span>
        </div>
        <span className="mm-match-vs">
          {isLive && fixture.score ? `${fixture.score.home}–${fixture.score.away}` : "VS"}
        </span>
        <div className="mm-match-team away">
          <TeamBadge team={fixture.away} />
          <span className="mm-match-team-name">{fixture.away.name}</span>
        </div>
        <button
          className={`mm-plus-btn ${inSlip ? "added" : ""}`}
          onClick={toggleSlip}
          aria-label={inSlip ? "Remove from slip" : "Add to slip"}
        >
          <Plus size={18} strokeWidth={2.6} />
        </button>
      </div>
      {fixture.sample && (
        <div className="mm-match-foot">
          <span className="mm-match-confidence"><TrendingUp size={12} strokeWidth={2} /> Sample preview</span>
          <span className="mm-match-odds">· {fixture.sample.marketLabel}</span>
        </div>
      )}
    </article>
  );
}

interface TodaysFixturesProps {
  fixtures: FixtureView[];
  onOpenMatch: (fixture: FixtureView) => void;
}

export function TodaysFixtures({ fixtures, onOpenMatch }: TodaysFixturesProps) {
  // Group by league
  const grouped = fixtures.reduce<Record<string, FixtureView[]>>((acc, fixture) => {
    const key = fixture.league.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(fixture);
    return acc;
  }, {});

  return (
    <section className="mm-section">
      <div className="mm-section-head">
        <h2 className="mm-section-title"><CalendarDays size={18} strokeWidth={2} /> Today&rsquo;s Fixtures</h2>
        <button className="mm-see-all">See all <ChevronRight size={14} strokeWidth={2} /></button>
      </div>
      {fixtures.length === 0 ? (
        <div className="mm-empty">
          <strong>No fixtures for today</strong>
          <span>Try another date or league.</span>
        </div>
      ) : (
        <div className="mm-fixture-list">
          {Object.values(grouped).map((group) =>
            group.map((fixture) => (
              <MatchCard key={fixture.id} fixture={fixture} onOpenMatch={onOpenMatch} />
            )),
          )}
        </div>
      )}
    </section>
  );
}
