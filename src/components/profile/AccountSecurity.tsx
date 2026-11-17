"use client";

import { BadgeCheck, KeyRound, LogIn, Mail, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Notice, type NoticeMessage } from "./controls";
import { ProfileMenuItem } from "./ProfileMenuItem";

function providerLabel(providerId: string) {
  if (providerId === "password") return "Email & password";
  if (providerId === "google.com") return "Google";
  return providerId;
}

/** Password, sign-in methods and the entry point to account deletion. */
export function AccountSecurity({ onRequestDelete }: { onRequestDelete: () => void }) {
  const { profile } = useUserProfile();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<NoticeMessage | null>(null);

  const providers = firebaseAuth?.currentUser?.providerData.map((item) => item.providerId) ?? [];
  const hasPassword = providers.includes("password");
  const hasGoogle = providers.includes("google.com");
  const methods = providers.map(providerLabel).join(", ") || "Email & password";

  const sendReset = async () => {
    if (!firebaseAuth || !profile?.email) return;
    setSending(true);
    setMessage(null);
    try {
      await sendPasswordResetEmail(firebaseAuth, profile.email);
      setMessage({ tone: "success", text: `A password reset link was sent to ${profile.email}.` });
    } catch {
      setMessage({ tone: "error", text: "The reset email could not be sent. Please try again shortly." });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <ProfileMenuItem
        icon={KeyRound}
        title="Password"
        subtitle={
          hasPassword
            ? "Send a secure reset link to your registered email."
            : "Your account signs in with a linked provider, so there is no password to change."
        }
        action={
          hasPassword ? (
            <button
              type="button"
              className="outline-button"
              disabled={sending}
              onClick={(event) => {
                event.stopPropagation();
                void sendReset();
              }}
            >
              {sending ? (
                <>
                  <span className="spinner" /> Sending
                </>
              ) : (
                <>
                  <Mail size={13} /> Send link
                </>
              )}
            </button>
          ) : undefined
        }
      />

      <ProfileMenuItem
        icon={LogIn}
        title="Sign-in methods"
        subtitle={
          hasGoogle
            ? "Google is connected to this account."
            : "Google is not connected to this account yet."
        }
        value={methods}
      />

      <ProfileMenuItem
        icon={ShieldCheck}
        title="Active session"
        subtitle="You are signed in with a server-verified session cookie that expires automatically."
        action={
          <span className="verified-chip">
            <BadgeCheck size={13} /> Verified
          </span>
        }
      />

      <ProfileMenuItem
        icon={Trash2}
        title="Delete account"
        subtitle="Permanently remove your account and its data. Requires confirmation and reauthentication."
        tone="danger"
        onClick={onRequestDelete}
      />

      <Notice message={message} />
    </>
  );
}
