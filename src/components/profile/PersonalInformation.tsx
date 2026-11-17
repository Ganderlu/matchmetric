"use client";

import { Camera, Save } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { updateProfile } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useUserProfile } from "@/hooks/useUserProfile";
import { firebaseAuth, firebaseStorage, firebaseStorageConfigured } from "@/lib/firebase";
import { cleanUsername } from "@/types/userProfile";
import { Notice, type NoticeMessage } from "./controls";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Edit the display name, username and profile picture; the email is read-only. */
export function PersonalInformation() {
  const { profile, save, saving } = useUserProfile();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<NoticeMessage | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setUsername(profile?.username ?? "");
  }, [profile?.displayName, profile?.username]);

  if (!profile) return null;

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    const name = displayName.trim();
    if (name.length < 2) {
      setMessage({ tone: "error", text: "Enter a display name of at least two characters." });
      return;
    }

    let nextUsername: string | undefined;
    if (username.trim()) {
      const cleaned = cleanUsername(username);
      if (!cleaned) {
        setMessage({
          tone: "error",
          text: "Usernames are 3–24 characters using letters, numbers, dot, dash or underscore.",
        });
        return;
      }
      nextUsername = cleaned;
    }

    if (firebaseAuth?.currentUser) {
      await updateProfile(firebaseAuth.currentUser, { displayName: name }).catch(() => undefined);
    }

    const stored = await save({ displayName: name, username: nextUsername });
    setMessage(
      stored
        ? { tone: "success", text: "Your profile was updated." }
        : { tone: "error", text: "Your profile could not be updated. Please try again." },
    );
  };

  const handlePhoto = async (file: File) => {
    setMessage(null);
    if (!file.type.startsWith("image/")) {
      setMessage({ tone: "error", text: "Choose an image file for your profile picture." });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage({ tone: "error", text: "Profile pictures must be smaller than 4 MB." });
      return;
    }
    if (!firebaseStorage || !firebaseAuth?.currentUser) {
      setMessage({ tone: "error", text: "Profile picture uploads are not configured yet." });
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(firebaseStorage, `users/${profile.uid}/avatar`);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      await updateProfile(firebaseAuth.currentUser, { photoURL: url }).catch(() => undefined);
      const stored = await save({ photoURL: url });
      setMessage(
        stored
          ? { tone: "success", text: "Your profile picture was updated." }
          : { tone: "error", text: "Your picture uploaded but the profile could not be saved." },
      );
    } catch {
      setMessage({ tone: "error", text: "Your profile picture could not be uploaded. Please try again." });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="profile-subpanel">
      <div className="profile-row static">
        <span
          className="profile-identity-avatar"
          style={
            profile.photoURL
              ? {
                  backgroundImage: `url("${profile.photoURL}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  color: "transparent",
                }
              : undefined
          }
        >
          {profile.photoURL ? "" : (profile.displayName || profile.email).slice(0, 1).toUpperCase()}
        </span>
        <span className="profile-row-copy">
          <span className="profile-row-title">Profile picture</span>
          <span className="profile-row-sub">
            {firebaseStorageConfigured
              ? "JPG or PNG, up to 4 MB. Stored privately in your account."
              : "Uploads need Firebase Storage configured on this deployment."}
          </span>
        </span>
        <span className="profile-row-actions">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handlePhoto(file);
            }}
          />
          <button
            type="button"
            className="outline-button"
            disabled={uploading || !firebaseStorageConfigured}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? (
              <>
                <span className="spinner" /> Uploading
              </>
            ) : (
              <>
                <Camera size={13} /> Change
              </>
            )}
          </button>
        </span>
      </div>

      <form className="settings-form" onSubmit={handleSave}>
        <div className="form-field">
          <label htmlFor="profile-name">Full name</label>
          <input
            id="profile-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Add your name"
            autoComplete="name"
          />
        </div>

        <div className="form-field">
          <label htmlFor="profile-username">Username</label>
          <input
            id="profile-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Optional"
            autoComplete="username"
          />
          <span className="field-help">Shown as @username on your account. Letters, numbers, dot, dash or underscore.</span>
        </div>

        <div className="form-field">
          <label htmlFor="profile-email">Registered email</label>
          <input id="profile-email" value={profile.email} readOnly disabled />
          <span className="field-help">Your email is used for sign-in and cannot be changed here.</span>
        </div>

        <Notice message={message} />
        <div className="settings-actions">
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? (
              <>
                <span className="spinner" /> Saving
              </>
            ) : (
              <>
                <Save size={13} /> Save changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
