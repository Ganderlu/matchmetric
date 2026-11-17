"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { useAuth } from "@/components/auth-provider";
import { firebaseAuth } from "@/lib/firebase";
import { clearCachedProfile } from "@/services/profileService";
import { Notice, type NoticeMessage } from "./controls";

const PHRASE = "DELETE";

function reauthMessage(error: unknown) {
  const code = (error as { code?: string }).code ?? "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "That password was not correct. Nothing has been deleted.";
  }
  if (code.includes("too-many-requests")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (code.includes("network-request-failed")) {
    return "Your connection dropped. Nothing has been deleted.";
  }
  return "We could not verify it is you. Nothing has been deleted.";
}

/**
 * Deliberate account deletion.
 *
 * The member has to type the confirmation phrase and re-enter their password, which also
 * refreshes the reauthentication timestamp the server checks before removing anything.
 */
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const { logOut } = useAuth();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<NoticeMessage | null>(null);

  const user = firebaseAuth?.currentUser ?? null;
  const email = user?.email ?? "";
  const hasPassword = (user?.providerData ?? []).some((item) => item.providerId === "password");

  const confirm = async () => {
    setMessage(null);
    if (confirmation.trim() !== PHRASE) {
      setMessage({ tone: "error", text: `Type ${PHRASE} to confirm.` });
      return;
    }
    if (!user || !email) {
      setMessage({ tone: "error", text: "Your session has ended. Please sign in again." });
      return;
    }
    if (!hasPassword) {
      setMessage({
        tone: "error",
        text: "Deleting this account needs a password sign-in, which this account does not use.",
      });
      return;
    }
    if (!password) {
      setMessage({ tone: "error", text: "Enter your password to confirm it is you." });
      return;
    }

    setBusy(true);

    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, password));
    } catch (error) {
      setMessage({ tone: "error", text: reauthMessage(error) });
      setBusy(false);
      return;
    }

    let response: Response;
    try {
      const idToken = await user.getIdToken(true);
      response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: PHRASE, idToken }),
      });
    } catch {
      setMessage({ tone: "error", text: "The request could not reach MatchMetric. Nothing has been deleted." });
      setBusy(false);
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setMessage({ tone: "error", text: payload.error ?? "Your account could not be deleted." });
      setBusy(false);
      return;
    }

    clearCachedProfile(user.uid);
    await logOut().catch(() => undefined);
    router.replace("/");
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section className="modal profile-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <div className="modal-header">
          <div>
            <h2 id="delete-title">Delete your account</h2>
            <p>This permanently removes your MatchMetric account. It cannot be undone.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog" disabled={busy}>
            <X size={16} />
          </button>
        </div>

        <div className="notice error-notice">
          <AlertTriangle size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
          The following is deleted permanently:
        </div>
        <ul className="profile-danger-list">
          <li>Your profile and saved preferences</li>
          <li>Your saved predictions and their results</li>
          <li>Your profile picture, if you added one</li>
          <li>Your sign-in record, so the email can register again</li>
        </ul>

        <div className="settings-form" style={{ marginTop: 14 }}>
          <div className="form-field">
            <label htmlFor="delete-confirmation">Type {PHRASE} to confirm</label>
            <input
              id="delete-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={PHRASE}
              autoComplete="off"
              disabled={busy}
            />
          </div>

          <div className="form-field">
            <label htmlFor="delete-password">Your password</label>
            <input
              id="delete-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Re-enter your password"
              autoComplete="current-password"
              disabled={busy}
            />
            <span className="field-help">
              Confirming your password proves it is you. Nothing is deleted until this succeeds.
            </span>
          </div>
        </div>

        <Notice message={message} />

        <div className="profile-dialog-actions">
          <button className="outline-button" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="primary-button danger-button"
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
          >
            {busy ? (
              <>
                <span className="spinner" /> Deleting
              </>
            ) : (
              <>
                <Trash2 size={13} /> Delete account
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
