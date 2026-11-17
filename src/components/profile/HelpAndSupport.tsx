"use client";

import { BookOpen, LifeBuoy, Mail } from "lucide-react";
import { ProfileMenuItem } from "./ProfileMenuItem";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

const FAQS: { question: string; answer: string }[] = [
  {
    question: "How does MatchMetric produce an analysis?",
    answer:
      "Each analysis is calculated on the server from the statistics MatchMetric holds for a fixture: recent form, head-to-head record, lineups where they are available, and the market prices on offer.",
  },
  {
    question: "Why does an analysis say there is not enough data?",
    answer:
      "MatchMetric only records a recommendation when it has the evidence to support it. If form, head-to-head or lineup data is missing for a fixture, the analysis is withheld and the missing pieces are listed instead.",
  },
  {
    question: "What are Open Games and History?",
    answer:
      "Open Games are predictions you have recorded for fixtures that have not finished. History holds predictions that have been graded against the final result.",
  },
  {
    question: "Is MatchMetric a betting service?",
    answer:
      "No. MatchMetric is an analysis tool. It does not take bets, hold funds or guarantee outcomes.",
  },
];

/** Contact route and short answers about how the product works. */
export function HelpAndSupport() {
  return (
    <>
      <ProfileMenuItem
        icon={LifeBuoy}
        title="Contact support"
        subtitle={
          SUPPORT_EMAIL
            ? `Write to ${SUPPORT_EMAIL} and we will reply as soon as we can.`
            : "A support address has not been published for this deployment yet."
        }
        action={
          SUPPORT_EMAIL ? (
            <a className="outline-button" href={`mailto:${SUPPORT_EMAIL}`}>
              <Mail size={13} /> Email us
            </a>
          ) : undefined
        }
      />

      <div className="settings-field-group">
        <div className="settings-field-label">
          <strong>Frequently asked questions</strong>
          <span>Short answers about how MatchMetric works.</span>
        </div>
        <div className="profile-faq">
          {FAQS.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="profile-note">
        <BookOpen size={13} />
        Support is handled by email only. MatchMetric does not run live chat or a phone line.
      </div>
    </>
  );
}
