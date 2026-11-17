"use client";

import { Check, Info, Minus, Plus } from "lucide-react";
import { marketCategories, marketCategoryOrder } from "@/lib/football/markets";
import { trackedCompetitions } from "@/lib/football/leagues";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { MAX_PICK_COUNT, MIN_PICK_COUNT } from "@/types/userProfile";
import { Toggle } from "./controls";

const CATEGORIES = [
  { value: "highest_probability", label: "Highest probability", hint: "Most likely outcomes" },
  { value: "best_value", label: "Best value", hint: "Price versus probability" },
] as const;

const PROBABILITY_DISPLAYS = [
  { value: "percent", label: "Percentage", hint: "62%" },
  { value: "decimal", label: "Decimal", hint: "0.62" },
] as const;

/** Default view, preferred markets, Auto Picks defaults and display options. */
export function PredictionPreferences() {
  const { prediction, setPrediction } = useUserPreferences();

  if (!prediction) return null;

  const toggleMarket = (key: (typeof marketCategoryOrder)[number]) => {
    setPrediction({
      preferredMarkets: prediction.preferredMarkets.includes(key)
        ? prediction.preferredMarkets.filter((item) => item !== key)
        : [...prediction.preferredMarkets, key],
    });
  };

  const toggleCompetition = (slug: string) => {
    setPrediction({
      defaultCompetitions: prediction.defaultCompetitions.includes(slug)
        ? prediction.defaultCompetitions.filter((item) => item !== slug)
        : [...prediction.defaultCompetitions, slug],
    });
  };

  return (
    <>
      <div className="settings-field-group">
        <div className="settings-field-label">
          <strong>Preferred prediction category</strong>
          <span>Which view opens first. This changes the default display only, never the engine.</span>
        </div>
        <div className="segmented two">
          {CATEGORIES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segment ${prediction.defaultCategory === option.value ? "active" : ""}`}
              onClick={() => setPrediction({ defaultCategory: option.value })}
            >
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-field-group">
        <div className="settings-field-label">
          <strong>Preferred markets</strong>
          <span>Market families to organise the interface around. Leave empty to compare them all.</span>
        </div>
        <div className="chip-row">
          {marketCategoryOrder.map((key) => {
            const selected = prediction.preferredMarkets.includes(key);
            return (
              <button
                key={key}
                type="button"
                className={`chip-toggle ${selected ? "selected" : ""}`}
                aria-pressed={selected}
                onClick={() => toggleMarket(key)}
              >
                {selected ? <Check size={12} /> : null}
                {marketCategories[key].label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-field-group">
        <div className="settings-field-label">
          <strong>Automatic pick defaults</strong>
          <span>Your preferred starting values for the Auto Picks workflow.</span>
        </div>

        <div className="profile-row static">
          <span className="profile-row-copy">
            <span className="profile-row-title">Number of selections</span>
            <span className="profile-row-sub">
              Between {MIN_PICK_COUNT} and {MAX_PICK_COUNT}.
            </span>
          </span>
          <span className="profile-stepper">
            <button
              type="button"
              aria-label="Fewer selections"
              disabled={prediction.defaultPickCount <= MIN_PICK_COUNT}
              onClick={() =>
                setPrediction({ defaultPickCount: Math.max(MIN_PICK_COUNT, prediction.defaultPickCount - 1) })
              }
            >
              <Minus size={15} />
            </button>
            <span className="profile-stepper-value">{prediction.defaultPickCount}</span>
            <button
              type="button"
              aria-label="More selections"
              disabled={prediction.defaultPickCount >= MAX_PICK_COUNT}
              onClick={() =>
                setPrediction({ defaultPickCount: Math.min(MAX_PICK_COUNT, prediction.defaultPickCount + 1) })
              }
            >
              <Plus size={15} />
            </button>
          </span>
        </div>

        <div className="settings-field-label">
          <strong>Preferred competitions</strong>
          <span>Competitions the Auto Picks workflow pre-selects.</span>
        </div>
        <div className="chip-row">
          {trackedCompetitions.map((competition) => {
            const selected = prediction.defaultCompetitions.includes(competition.slug);
            return (
              <button
                key={competition.slug}
                type="button"
                className={`chip-toggle ${selected ? "selected" : ""}`}
                aria-pressed={selected}
                onClick={() => toggleCompetition(competition.slug)}
              >
                {selected ? <Check size={12} /> : null}
                {competition.name}
              </button>
            );
          })}
        </div>

        <div className="switch-list">
          <div className="switch-row">
            <div className="switch-copy">
              <strong>One selection per league</strong>
              <span>Limit Auto Picks to a single match from each competition.</span>
            </div>
            <Toggle
              checked={prediction.oneSelectionPerLeague}
              label="One selection per league"
              onChange={(next) => setPrediction({ oneSelectionPerLeague: next })}
            />
          </div>
        </div>
      </div>

      <div className="settings-field-group">
        <div className="settings-field-label">
          <strong>Display preferences</strong>
          <span>How probabilities and analysis detail are presented.</span>
        </div>
        <div className="segmented two">
          {PROBABILITY_DISPLAYS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segment ${prediction.probabilityDisplay === option.value ? "active" : ""}`}
              onClick={() => setPrediction({ probabilityDisplay: option.value })}
            >
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </button>
          ))}
        </div>
        <div className="switch-list">
          <div className="switch-row">
            <div className="switch-copy">
              <strong>Confidence indicator</strong>
              <span>Show how much data supports each analysis.</span>
            </div>
            <Toggle
              checked={prediction.showConfidenceIndicator}
              label="Confidence indicator"
              onChange={(next) => setPrediction({ showConfidenceIndicator: next })}
            />
          </div>
          <div className="switch-row">
            <div className="switch-copy">
              <strong>Advanced analysis</strong>
              <span>Reveal detailed supporting information in match analysis.</span>
            </div>
            <Toggle
              checked={prediction.showAdvancedAnalysis}
              label="Advanced analysis"
              onChange={(next) => setPrediction({ showAdvancedAnalysis: next })}
            />
          </div>
        </div>
      </div>

      <div className="profile-note">
        <Info size={13} />
        These preferences are saved to your account. They are never used as evidence of a higher
        probability, and they do not change the prediction engine.
      </div>
    </>
  );
}
