"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Goal, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { user, signIn, register, configured } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [returnTo, setReturnTo] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/account";
    setReturnTo(destination === "/account" ? "" : destination);
    if (user) {
      router.replace(destination);
    }
  }, [user, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "register") await register(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
      const requested = new URLSearchParams(window.location.search).get("next");
      router.replace(requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/account");
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "Something went wrong. Please try again.";
      setError(code.replace("Firebase: ", "").replace(/\(auth\/[^)]+\)\.?/g, "").trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="brand auth-brand">
          <span className="brand-mark"><Goal /></span>
          <span><span className="brand-name">MatchMetric</span><span className="brand-caption">Football intelligence, made clear</span></span>
        </Link>
        <Link href="/" className="back-link"><ArrowLeft size={13} /> Back to dashboard</Link>
        <div className="auth-heading">
          <div className="auth-lock"><LockKeyhole size={19} /></div>
          <div className="eyebrow">{mode === "login" ? "Welcome back" : "Your matchday workspace"}</div>
          <h1>{mode === "login" ? "Log in to MatchMetric" : "Create your account"}</h1>
          <p>{mode === "login" ? "Continue to your saved picks and analysis." : "Save selections and access member analysis tools."}</p>
        </div>
        <form className="form-stack" onSubmit={submit}>
          {mode === "register" && <div className="form-field"><label htmlFor="display-name">Your name</label><input id="display-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></div>}
          <div className="form-field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <div className="form-field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /><span className="field-help">Use at least 6 characters.</span></div>
          {error && <div className="notice error-notice">{error}</div>}
          {!configured && <div className="notice">Firebase Authentication is not configured. Add the values from <code>.env.example</code> to enable sign in and registration.</div>}
          <button className="primary-button auth-submit" type="submit" disabled={busy || !configured}>{busy ? <><span className="spinner" /> Working</> : <>{mode === "login" ? "Log in" : "Create account"} <ArrowRight size={14} /></>}</button>
        </form>
        <p className="auth-switch">
          {mode === "login" ? "New to MatchMetric?" : "Already have an account?"}{" "}
          <Link
            className="text-link"
            href={`${mode === "login" ? "/register" : "/login"}${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`}
          >
            {mode === "login" ? "Create an account" : "Log in"}
          </Link>
        </p>
        <p className="auth-footnote">Your account is for personal analysis tools. Match insights are informational and do not guarantee outcomes.</p>
      </div>
    </main>
  );
}
