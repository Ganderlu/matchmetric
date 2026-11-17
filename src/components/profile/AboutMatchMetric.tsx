"use client";

import { AlertTriangle, FileText, Info, ShieldCheck } from "lucide-react";
import { ProfileMenuItem } from "./ProfileMenuItem";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;
const TERMS_URL = process.env.NEXT_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL;

/** What MatchMetric is, its version and its legal entry points. */
export function AboutMatchMetric() {
  return (
    <>
      <div className="profile-about">
        <p>
          MatchMetric turns football data into clear, explainable match analysis. It reads recent
          form, head-to-head records, lineups and market prices, then reports what the evidence
          supports and says so plainly when it does not support anything.
        </p>
        <p>
          Every analysis is produced on the server, so provider keys and raw provider data never
          reach your browser. Predictions you record are graded against the final result, which is
          how the accuracy figures in MatchMetric are built.
        </p>
      </div>

      <ProfileMenuItem
        icon={Info}
        title="Version"
        subtitle={APP_VERSION ? `MatchMetric ${APP_VERSION}` : "This deployment does not publish a version number."}
      />

      <ProfileMenuItem
        icon={ShieldCheck}
        title="Your data"
        subtitle="Your profile, preferences and predictions are stored privately under your own account."
      />

      <ProfileMenuItem
        icon={FileText}
        title="Terms of use"
        subtitle={
          TERMS_URL
            ? "Read the terms that cover your use of MatchMetric."
            : "Terms have not been published for this deployment yet."
        }
        action={
          TERMS_URL ? (
            <a className="outline-button" href={TERMS_URL} target="_blank" rel="noreferrer">
              Open
            </a>
          ) : undefined
        }
      />

      <ProfileMenuItem
        icon={ShieldCheck}
        title="Privacy policy"
        subtitle={
          PRIVACY_URL
            ? "Read how MatchMetric handles your information."
            : "A privacy policy has not been published for this deployment yet."
        }
        action={
          PRIVACY_URL ? (
            <a className="outline-button" href={PRIVACY_URL} target="_blank" rel="noreferrer">
              Open
            </a>
          ) : undefined
        }
      />

      <div className="profile-note warn">
        <AlertTriangle size={13} />
        MatchMetric provides analysis for information only. It is not betting advice, and no result
        is guaranteed.
      </div>
    </>
  );
}
