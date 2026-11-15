import "server-only";

import { marketCategories } from "./markets";
import type { FormResult, MarketCategoryKey, OddsMarket } from "./types";
import type { MatchDetailView } from "./views";
import type {
  EvaluatedMarket,
  ManualPredictionResult,
  PredictionDataQuality,
  SettlementTarget,
} from "../manual-predictions";

export const MANUAL_MODEL_VERSION = "form-poisson-odds-1.0.0";
const MAX_GOALS = 10;
const MIN_FORM_MATCHES = 3;
/** The single totals line this model estimates; graded identically by accuracy tracking. */
const OVER_UNDER_LINE = 2.5;

interface FormMetrics {
  count: number;
  scored: number;
  conceded: number;
  homeCount: number;
  homeScored: number;
  homeConceded: number;
  awayCount: number;
  awayScored: number;
  awayConceded: number;
  homeSequence: string;
  awaySequence: string;
  sequence: string;
}

interface MarketCandidate {
  category: MarketCategoryKey;
  market: string;
  selection: string;
  settlement: SettlementTarget;
  probability: number;
  odds: number;
}

/**
 * Estimates score and market probabilities from recent, completed scorelines.
 * The current fixture's statistics are deliberately excluded to prevent leakage.
 */
export function generateManualPrediction(detail: MatchDetailView): ManualPredictionResult {
  const fixture = detail.fixture;
  const home = formMetrics(detail.homeForm);
  const away = formMetrics(detail.awayForm);
  const generatedAt = new Date().toISOString();
  const sampleCount = Math.min(home.count, away.count);
  const dataQuality: PredictionDataQuality =
    sampleCount < MIN_FORM_MATCHES
      ? "Insufficient"
      : sampleCount >= 5 && detail.odds.length > 0
        ? "Good"
        : "Limited";
  const weakest = [
    home.count < MIN_FORM_MATCHES
      ? `${fixture.home.name} has only ${home.count} recent completed scorelines; at least ${MIN_FORM_MATCHES} are required.`
      : "",
    away.count < MIN_FORM_MATCHES
      ? `${fixture.away.name} has only ${away.count} recent completed scorelines; at least ${MIN_FORM_MATCHES} are required.`
      : "",
  ].filter(Boolean);

  if (dataQuality === "Insufficient") {
    return baseResult(detail, generatedAt, dataQuality, home, away, {
      analysisStatus: "insufficient",
      keyInsights: ["A probability is withheld because recent, scored form is missing for at least one team."],
      weakeningFactors: [...weakest, "No recommendation is generated from mock data or an incomplete form sample."],
    });
  }

  const homeExpectedGoals = venueAdjustedRate(home, "home", "scored", away, "away", "conceded");
  const awayExpectedGoals = venueAdjustedRate(away, "away", "scored", home, "home", "conceded");
  const scoreProbabilities = poissonScoreProbabilities(homeExpectedGoals, awayExpectedGoals);
  const outcome = outcomeProbabilities(scoreProbabilities);
  const candidates = createMarketCandidates(detail.odds, detail, outcome);
  const evaluated = candidates
    .map((candidate) => {
      const expectedValue = candidate.probability * candidate.odds - 1;
      return {
        category: candidate.category,
        market: candidate.market,
        selection: candidate.selection,
        settlement: candidate.settlement,
        estimatedProbability: percent(candidate.probability),
        impliedProbability: percent(1 / candidate.odds),
        odds: candidate.odds,
        expectedValue,
      } satisfies EvaluatedMarket;
    })
    .sort((left, right) => right.expectedValue - left.expectedValue);

  const positiveValue = evaluated.filter((candidate) => candidate.expectedValue > 0);
  const recommendation = positiveValue[0];
  const confidence =
    home.count >= 5 && away.count >= 5 && Boolean(recommendation) ? "Medium" : "Low";
  const keyInsights = [
    `${fixture.home.name}: ${home.sequence} in its ${home.count} most recent scored matches; weighted average ${home.scored.toFixed(2)} goals scored and ${home.conceded.toFixed(2)} conceded.`,
    `${fixture.away.name}: ${away.sequence} in its ${away.count} most recent scored matches; weighted average ${away.scored.toFixed(2)} goals scored and ${away.conceded.toFixed(2)} conceded.`,
    `Recent-scoreline model estimates ${homeExpectedGoals.toFixed(2)} home goals and ${awayExpectedGoals.toFixed(2)} away goals.`,
  ];

  if (home.homeCount || away.awayCount) {
    keyInsights.push(
      `Venue form: ${fixture.home.name} home results ${home.homeSequence || "not available"} (${home.homeCount} matches); ${fixture.away.name} away results ${away.awaySequence || "not available"} (${away.awayCount} matches).`,
    );
  }
  if (detail.headToHead?.played) {
    keyInsights.push(
      `Provider head-to-head record: ${detail.headToHead.homeWins} home-team wins, ${detail.headToHead.draws} draws and ${detail.headToHead.awayWins} away-team wins across ${detail.headToHead.played} meetings. Used as context, not as an independent pick.`,
    );
  }
  const relevantUnavailablePlayers = detail.sidelined.filter(
    (player) => player.teamId === fixture.home.id || player.teamId === fixture.away.id,
  );
  if (relevantUnavailablePlayers.length) {
    keyInsights.push(
      `Provider unavailable-player report: ${relevantUnavailablePlayers
        .map((player) => `${player.playerName} (${player.kind}${player.reason ? `: ${player.reason}` : ""})`)
        .join("; ")}. Player impact is not estimated.`,
    );
  }
  if (detail.available.lineups && detail.lineups) {
    keyInsights.push("The provider returned lineup information; individual player impact is not included in this model.");
  }
  if (recommendation) {
    keyInsights.push(
      `${recommendation.market}: ${recommendation.selection} at ${recommendation.odds.toFixed(2)} has an estimated ${recommendation.estimatedProbability.toFixed(1)}% probability, raw implied price probability ${recommendation.impliedProbability.toFixed(1)}%, and ${(recommendation.expectedValue * 100).toFixed(1)}% expected return per unit stake.`,
    );
  } else {
    keyInsights.push(
      evaluated.length
        ? "No offered selection has positive estimated expected value at the provider's listed price."
        : "No supported, priced market was returned for this fixture.",
    );
  }

  const weakeningFactors = [
    ...(home.count < 5 ? [`Only ${home.count} recent scored matches are available for ${fixture.home.name}.`] : []),
    ...(away.count < 5 ? [`Only ${away.count} recent scored matches are available for ${fixture.away.name}.`] : []),
    ...(detail.headToHead ? [] : ["No provider head-to-head sample is available."]),
    ...["No historical team-level expected-goals series is exposed to this pre-match model; current-fixture xG is not used."],
    ...(relevantUnavailablePlayers.length
      ? [`Provider lists ${relevantUnavailablePlayers.length} relevant unavailable players; their minutes and team impact are not estimated.`]
      : ["No relevant injury or suspension information was returned."]),
    ...(!detail.available.lineups ? ["Confirmed lineups are not available; none are assumed."] : []),
    "The model has not yet been calibrated against a verified historical prediction set, so High confidence is intentionally withheld.",
  ];

  return {
    ...baseResult(detail, generatedAt, dataQuality, home, away, {
      analysisStatus: recommendation ? "recommended" : "no-value",
      keyInsights,
      weakeningFactors,
    }),
    recommendedMarket: recommendation?.category ?? null,
    marketLabel: recommendation ? marketCategories[recommendation.category].label : null,
    recommendedSelection: recommendation?.selection ?? null,
    recommendedSettlement: recommendation?.settlement ?? null,
    estimatedProbability: recommendation?.estimatedProbability ?? null,
    confidence: recommendation ? confidence : null,
    ...(recommendation
      ? { availableOdds: recommendation.odds, expectedValue: recommendation.expectedValue }
      : {}),
    bestAvailableMarkets: evaluated.slice(0, 5),
  };
}

function baseResult(
  detail: MatchDetailView,
  generatedAt: string,
  dataQuality: PredictionDataQuality,
  home: FormMetrics,
  away: FormMetrics,
  extras: Pick<ManualPredictionResult, "analysisStatus" | "keyInsights" | "weakeningFactors">,
): ManualPredictionResult {
  return {
    fixtureId: detail.fixture.id,
    homeTeam: detail.fixture.home,
    awayTeam: detail.fixture.away,
    leagueName: detail.fixture.league.name,
    kickoff: detail.fixture.kickoff,
    analysisStatus: extras.analysisStatus,
    recommendedMarket: null,
    marketLabel: null,
    recommendedSelection: null,
    recommendedSettlement: null,
    estimatedProbability: null,
    confidence: null,
    dataQuality,
    homeFormSummary: `${home.sequence || "No scored form"} (${home.count} matches)`,
    awayFormSummary: `${away.sequence || "No scored form"} (${away.count} matches)`,
    keyInsights: extras.keyInsights,
    weakeningFactors: extras.weakeningFactors,
    bestAvailableMarkets: [],
    modelVersion: MANUAL_MODEL_VERSION,
    generatedAt,
  };
}

function formMetrics(form: FormResult[]): FormMetrics {
  const scored = form
    .map((entry) => {
      const [goalsFor, goalsAgainst] = entry.score.split("-").map(Number);
      if (!Number.isFinite(goalsFor) || !Number.isFinite(goalsAgainst)) return null;
      return { entry, goalsFor, goalsAgainst };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const weights = scored.map((_, index) => 1 / (index + 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const weightedAverage = (pick: (item: (typeof scored)[number]) => number) =>
    totalWeight
      ? scored.reduce((sum, item, index) => sum + pick(item) * (weights[index] ?? 0), 0) / totalWeight
      : 0;
  const homeResults = scored.filter((item) => item.entry.home);
  const awayResults = scored.filter((item) => !item.entry.home);
  const venueAverage = (items: typeof scored, pick: (item: (typeof scored)[number]) => number) =>
    items.length ? items.reduce((sum, item) => sum + pick(item), 0) / items.length : 0;

  return {
    count: scored.length,
    scored: weightedAverage((item) => item.goalsFor),
    conceded: weightedAverage((item) => item.goalsAgainst),
    homeCount: homeResults.length,
    homeScored: venueAverage(homeResults, (item) => item.goalsFor),
    homeConceded: venueAverage(homeResults, (item) => item.goalsAgainst),
    awayCount: awayResults.length,
    awayScored: venueAverage(awayResults, (item) => item.goalsFor),
    awayConceded: venueAverage(awayResults, (item) => item.goalsAgainst),
    homeSequence: homeResults.map((item) => item.entry.result).join(" · "),
    awaySequence: awayResults.map((item) => item.entry.result).join(" · "),
    sequence: scored.map((item) => item.entry.result).join(" · "),
  };
}

function venueAdjustedRate(
  attack: FormMetrics,
  attackVenue: "home" | "away",
  attackMetric: "scored",
  defence: FormMetrics,
  defenceVenue: "home" | "away",
  defenceMetric: "conceded",
) {
  const overallAttack = attack[attackMetric];
  const overallDefence = defence[defenceMetric];
  const venueAttackCount = attackVenue === "home" ? attack.homeCount : attack.awayCount;
  const venueDefenceCount = defenceVenue === "home" ? defence.homeCount : defence.awayCount;
  const venueAttack = attackVenue === "home" ? attack.homeScored : attack.awayScored;
  const venueDefence = defenceVenue === "home" ? defence.homeConceded : defence.awayConceded;
  const attackWeight = venueAttackCount / (venueAttackCount + 3);
  const defenceWeight = venueDefenceCount / (venueDefenceCount + 3);
  const adjustedAttack = overallAttack * (1 - attackWeight) + venueAttack * attackWeight;
  const adjustedDefence = overallDefence * (1 - defenceWeight) + venueDefence * defenceWeight;
  return clamp((adjustedAttack + adjustedDefence) / 2, 0.15, 4);
}

function poissonScoreProbabilities(homeRate: number, awayRate: number) {
  const home = poissonSeries(homeRate);
  const away = poissonSeries(awayRate);
  return home.map((homeProbability) =>
    away.map((awayProbability) => homeProbability * awayProbability),
  );
}

function poissonSeries(rate: number) {
  const values = [Math.exp(-rate)];
  for (let goals = 1; goals <= MAX_GOALS; goals += 1) {
    values.push((values[goals - 1] ?? 0) * rate / goals);
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.map((value) => value / total);
}

function outcomeProbabilities(scores: number[][]) {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let homeGoals = 0; homeGoals < scores.length; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals < (scores[homeGoals]?.length ?? 0); awayGoals += 1) {
      const probability = scores[homeGoals]?.[awayGoals] ?? 0;
      if (homeGoals > awayGoals) home += probability;
      else if (homeGoals === awayGoals) draw += probability;
      else away += probability;
    }
  }
  return {
    home,
    draw,
    away,
    homeDraw: home + draw,
    homeAway: home + away,
    awayDraw: away + draw,
    bttsYes: bttsProbability(scores, true),
    bttsNo: bttsProbability(scores, false),
    over25: totalGoalsProbability(scores, (total) => total >= 3),
    under25: totalGoalsProbability(scores, (total) => total <= 2),
  };
}

function bttsProbability(scores: number[][], bothScore: boolean) {
  let probability = 0;
  scores.forEach((homeRow, homeGoals) => {
    homeRow.forEach((scoreProbability, awayGoals) => {
      if ((homeGoals > 0 && awayGoals > 0) === bothScore) probability += scoreProbability;
    });
  });
  return probability;
}

function totalGoalsProbability(scores: number[][], include: (total: number) => boolean) {
  let probability = 0;
  scores.forEach((homeRow, homeGoals) => {
    homeRow.forEach((scoreProbability, awayGoals) => {
      if (include(homeGoals + awayGoals)) probability += scoreProbability;
    });
  });
  return probability;
}

function createMarketCandidates(
  odds: OddsMarket[],
  detail: MatchDetailView,
  outcome: ReturnType<typeof outcomeProbabilities>,
): MarketCandidate[] {
  const candidates: MarketCandidate[] = [];
  const homeName = normalise(detail.fixture.home.name);
  const awayName = normalise(detail.fixture.away.name);
  const push = (
    category: MarketCategoryKey,
    market: OddsMarket,
    selection: string,
    settlement: SettlementTarget,
    probability: number,
    price: number,
  ) => {
    if (!Number.isFinite(price) || price <= 1 || !Number.isFinite(probability)) return;
    candidates.push({ category, market: market.name, selection, settlement, probability, odds: price });
  };

  for (const market of odds) {
    for (const offered of market.selections) {
      const label = normalise(offered.label);
      if (market.category === "match-winner") {
        if (isHomeLabel(label, homeName)) push(market.category, market, offered.label, { market: "1x2", side: "home" }, outcome.home, offered.price);
        else if (isAwayLabel(label, awayName)) push(market.category, market, offered.label, { market: "1x2", side: "away" }, outcome.away, offered.price);
        else if (isDrawLabel(label)) push(market.category, market, offered.label, { market: "1x2", side: "draw" }, outcome.draw, offered.price);
      } else if (market.category === "double-chance") {
        if (isHomeDrawLabel(label)) push(market.category, market, offered.label, { market: "double-chance", side: "home-draw" }, outcome.homeDraw, offered.price);
        else if (isHomeAwayLabel(label)) push(market.category, market, offered.label, { market: "double-chance", side: "home-away" }, outcome.homeAway, offered.price);
        else if (isAwayDrawLabel(label)) push(market.category, market, offered.label, { market: "double-chance", side: "away-draw" }, outcome.awayDraw, offered.price);
      } else if (market.category === "btts") {
        if (label === "yes") push(market.category, market, offered.label, { market: "btts", side: "yes" }, outcome.bttsYes, offered.price);
        if (label === "no") push(market.category, market, offered.label, { market: "btts", side: "no" }, outcome.bttsNo, offered.price);
      } else if (market.category === "over-under" && marketHasLine(market, offered.label)) {
        if (/\bover\b/.test(label)) push(market.category, market, offered.label, { market: "over-under", side: "over", line: OVER_UNDER_LINE }, outcome.over25, offered.price);
        if (/\bunder\b/.test(label)) push(market.category, market, offered.label, { market: "over-under", side: "under", line: OVER_UNDER_LINE }, outcome.under25, offered.price);
      } else if (market.category === "draw-no-bet") {
        const decisiveTotal = outcome.home + outcome.away;
        if (decisiveTotal > 0 && isHomeLabel(label, homeName)) {
          push(market.category, market, offered.label, { market: "dnb", side: "home" }, outcome.home / decisiveTotal, offered.price);
        }
        if (decisiveTotal > 0 && isAwayLabel(label, awayName)) {
          push(market.category, market, offered.label, { market: "dnb", side: "away" }, outcome.away / decisiveTotal, offered.price);
        }
      }
    }
  }
  return candidates;
}

function marketHasLine(market: OddsMarket, selection: string) {
  const line = market.line ?? selection.match(/\b2\.5\b/)?.[0];
  return line === "2.5";
}

function isHomeLabel(label: string, homeName: string) {
  return label === "1" || label === "home" || label === "home win" || label === homeName;
}

function isAwayLabel(label: string, awayName: string) {
  return label === "2" || label === "away" || label === "away win" || label === awayName;
}

function isDrawLabel(label: string) {
  return label === "x" || label === "draw";
}

function isHomeDrawLabel(label: string) {
  return label === "1x" || label === "home or draw" || label === "home/draw";
}

function isHomeAwayLabel(label: string) {
  return label === "12" || label === "home or away" || label === "home/away";
}

function isAwayDrawLabel(label: string) {
  return label === "x2" || label === "away or draw" || label === "away/draw";
}

function normalise(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function percent(probability: number) {
  return Number((probability * 100).toFixed(1));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
