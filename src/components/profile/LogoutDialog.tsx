"use client";

import { LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";

/** Confirmation before ending the session. */
export function LogoutDialog({ onClose }: { onClose: () => void }) {
  const { logOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await logOut();
    } finally {
      router.replace("/login");
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section className="modal profile-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title">
        <div className="modal-header">
          <div>
            <h2 id="logout-title">Log out?</h2>
            <p>You will need to sign in again to analyse matches and view your saved predictions.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog" disabled={busy}>
            <X size={16} />
          </button>
        </div>

        <div className="profile-dialog-actions">
          <button className="outline-button" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={() => void confirm()} disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" /> Logging out
              </>
            ) : (
              <>
                <LogOut size={13} /> Log out
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
