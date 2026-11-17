import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { SavedPredictions } from "./saved-predictions";
import { ModelAccuracy } from "./performance";

export default function AccountPage() {
  return (
    <main className="account-page">
      <div className="account-card">
        <span className="account-icon"><ShieldCheck size={22} /></span>
        <div className="eyebrow">Member workspace</div>
        <h1>Your MatchMetric account</h1>
        <p>Your verified session is active. Saved manual analyses are private to your account.</p>
        <div className="notice success-notice"><CheckCircle2 size={14} style={{ verticalAlign: "-3px", marginRight: 5 }} />You are signed in with a server-verified session.</div>
        <ModelAccuracy />
        <SavedPredictions />
        <div className="account-actions">
          <Link className="primary-button" href="/">Return to dashboard <ArrowLeft size={14} /></Link>
        </div>
      </div>
    </main>
  );
}
