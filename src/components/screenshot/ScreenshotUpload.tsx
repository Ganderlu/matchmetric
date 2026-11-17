"use client";

import { ImageUp, RefreshCw, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

/**
 * Screenshot upload and preview.
 *
 * Uploading is only a staged file here; the parent owns the extraction step so this component
 * stays presentational. The preview is a local object URL and is revoked as soon as the file is
 * replaced, removed or the workflow closes.
 */
export function ScreenshotUpload({
  busy,
  error,
  onExtract,
}: {
  busy: boolean;
  error?: string;
  onExtract: (file: File, previewUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const accept = (candidate: File | undefined) => {
    if (!candidate || !candidate.type.startsWith("image/")) return;
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(candidate);
    });
    setFile(candidate);
  };

  const clear = () => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="screenshot-upload">
      <div className="screenshot-upload-head">
        <span className="slip-eyebrow">Screenshot Selection</span>
        <h3>Import a bookmaker slip</h3>
        <p>Upload a screenshot of a slip you have already built elsewhere to compare it with MatchMetric.</p>
      </div>

      {!file ? (
        <div
          className={`screenshot-drop ${dragging ? "dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <ImageUp size={30} strokeWidth={1.9} />
          <strong>Drop your slip screenshot here</strong>
          <span>PNG or JPG, one slip per image.</span>
          <button type="button" className="slip-ghost-btn" onClick={() => inputRef.current?.click()}>
            <Upload size={14} strokeWidth={2.2} /> Choose image
          </button>
        </div>
      ) : (
        <div className="screenshot-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Your uploaded slip preview" />
          <div className="screenshot-preview-meta">
            <span>{file.name}</span>
            <div className="screenshot-preview-actions">
              <button type="button" className="slip-ghost-btn" onClick={() => inputRef.current?.click()}>
                <RefreshCw size={13} strokeWidth={2.2} /> Replace
              </button>
              <button type="button" className="slip-card-remove" onClick={clear} aria-label="Remove image">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="screenshot-file-input"
        onChange={(event: ChangeEvent<HTMLInputElement>) => accept(event.target.files?.[0])}
      />

      {error && <p className="slip-notice slip-notice-error">{error}</p>}

      <div className="screenshot-note">
        OCR and image recognition are not connected yet, so extraction returns clearly labelled
        demonstration selections for you to verify before anything is added to your slip.
      </div>

      <button
        type="button"
        className="slip-analyse-all"
        disabled={!file || busy}
        onClick={() => file && onExtract(file, previewUrl)}
      >
        {busy ? (
          <>
            <span className="spinner" /> Reading your slip...
          </>
        ) : (
          <>
            <ImageUp size={16} strokeWidth={2.3} /> Extract selections
          </>
        )}
      </button>
    </div>
  );
}
