"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trackProductEvent } from "@/data/product-analytics";
import { PathMomentArtwork, pathMomentAltDescription, type PathMomentPrivacy } from "@/components/path-moment-artwork";
import { pathMomentLayouts, pathMomentTitle, type PathMomentCollection, type PathMomentLayout, type PathMomentNameMode } from "@/lib/path-moments";
import styles from "./path-moment.module.css";

type PathMomentCreatorProps = {
  collection: PathMomentCollection;
  theme: "light" | "dark";
};

function initialPrivacy(collection: PathMomentCollection): PathMomentPrivacy {
  return { ...collection.defaultPrivacy };
}

function downloadName(layout: PathMomentLayout) {
  return `unlocked-path-moment-${layout}.png`;
}

export function PathMomentCreator({ collection, theme }: PathMomentCreatorProps) {
  const [open, setOpen] = useState(false);
  const [momentId, setMomentId] = useState(collection.moments[0]?.id ?? "");
  const [layout, setLayout] = useState<PathMomentLayout>("story");
  const [privacy, setPrivacy] = useState<PathMomentPrivacy>(() => initialPrivacy(collection));
  const [busy, setBusy] = useState<"download" | "copy" | "share" | null>(null);
  const [message, setMessage] = useState("");
  const [canCopy, setCanCopy] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const artworkRef = useRef<SVGSVGElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const moment = useMemo(() => collection.moments.find((item) => item.id === momentId) ?? collection.moments[0], [collection.moments, momentId]);

  useEffect(() => {
    setCanCopy(Boolean(navigator.clipboard && "ClipboardItem" in window));
    setCanShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function openCreator() {
    setOpen(true);
    setMessage("");
    trackProductEvent("path_moment_preview_opened", { filterValue: moment?.type });
  }

  function close() {
    dialogRef.current?.close();
    setOpen(false);
    setBusy(null);
    setMessage("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function imageBlob() {
    const svg = artworkRef.current;
    if (!svg) throw new Error("The Path Moment preview is not ready yet.");
    const dimensions = pathMomentLayouts[layout];
    const source = new XMLSerializer().serializeToString(svg);
    const sourceUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.decoding = "async";
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("The Path Moment image could not be prepared."));
        image.src = sourceUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image export is not available in this browser.");
      context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
      if (!blob) throw new Error("The PNG could not be created.");
      return blob;
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  async function download() {
    if (!moment) return;
    setBusy("download");
    setMessage("");
    try {
      const blob = await imageBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadName(layout);
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      trackProductEvent("path_moment_downloaded", { filterValue: layout, reason: moment.type });
      setMessage("Path Moment downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Path Moment could not be downloaded.");
    } finally {
      setBusy(null);
    }
  }

  async function copyImage() {
    if (!moment || !canCopy) return;
    setBusy("copy");
    setMessage("");
    try {
      const blob = await imageBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      trackProductEvent("path_moment_copied", { filterValue: layout, reason: moment.type });
      setMessage("Path Moment copied as an image.");
    } catch {
      setMessage("This browser could not copy the image. Download is still available.");
    } finally {
      setBusy(null);
    }
  }

  async function nativeShare() {
    if (!moment || !canShare) return;
    setBusy("share");
    setMessage("");
    try {
      const blob = await imageBlob();
      const file = new File([blob], downloadName(layout), { type: "image/png" });
      const payload = { title: "My UnlockED Path Moment", text: moment.headline, files: [file] };
      if (navigator.canShare && !navigator.canShare(payload)) throw new Error("File sharing is not available.");
      await navigator.share(payload);
      trackProductEvent("path_moment_shared", { filterValue: layout, reason: moment.type });
      setMessage("Share sheet opened.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setMessage("Share canceled.");
      else setMessage("This browser could not open sharing. Download is still available.");
    } finally {
      setBusy(null);
    }
  }

  if (!moment) return null;
  const alt = pathMomentAltDescription(moment, privacy, collection.identity);

  return <>
    <button ref={triggerRef} type="button" className={styles.trigger} onClick={openCreator}>Create a Path Moment</button>
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-theme={theme}
      aria-labelledby="path-moment-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
    >
      {open ? <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p>Path Moment</p>
            <h2 id="path-moment-title">Share one meaningful step.</h2>
            <span>Preview every detail before it leaves UnlockED.</span>
          </div>
          <button type="button" onClick={close} className={styles.close} aria-label="Close Path Moment creator">×</button>
        </header>

        <div className={styles.workspace}>
          <section className={styles.previewColumn} aria-label="Path Moment preview">
            <div className={styles.previewFrame} data-preview-layout={layout} role="img" aria-label={alt}>
              <PathMomentArtwork ref={artworkRef} moment={moment} layout={layout} privacy={privacy} identity={collection.identity} />
            </div>
            <p className={styles.previewCaption}>{pathMomentLayouts[layout].label} · {pathMomentLayouts[layout].width} × {pathMomentLayouts[layout].height} PNG</p>
          </section>

          <aside className={styles.controls} aria-label="Path Moment options">
            <label className={styles.field}>
              <span>Moment</span>
              <select value={moment.id} onChange={(event) => { setMomentId(event.target.value); setMessage(""); }}>
                {collection.moments.map((item) => <option key={item.id} value={item.id}>{pathMomentTitle(item.type)} · {new Date(item.occurredAt).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}</option>)}
              </select>
            </label>

            <fieldset className={styles.group}>
              <legend>Format</legend>
              <div className={styles.segmented}>
                {(Object.keys(pathMomentLayouts) as PathMomentLayout[]).map((item) => <button key={item} type="button" aria-pressed={layout === item} onClick={() => { setLayout(item); setMessage(""); }}>{item === "story" ? "Story" : item === "square" ? "Square" : "LinkedIn"}</button>)}
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend>Name</legend>
              <div className={styles.segmented}>
                {(["anonymous", "first_name", "full_name"] as PathMomentNameMode[]).map((mode) => <button key={mode} type="button" aria-pressed={privacy.nameMode === mode} onClick={() => setPrivacy((current) => ({ ...current, nameMode: mode }))}>{mode === "anonymous" ? "Anonymous" : mode === "first_name" ? "First name" : "Full name"}</button>)}
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend>Optional details</legend>
              <div className={styles.checks}>
                <PrivacyCheck label="School" checked={privacy.includeSchool} disabled={!collection.identity.school} onChange={(includeSchool) => setPrivacy((current) => ({ ...current, includeSchool }))} />
                <PrivacyCheck label="Organization" checked={privacy.includeOrganization} disabled={!moment.organization} onChange={(includeOrganization) => setPrivacy((current) => ({ ...current, includeOrganization }))} />
                <PrivacyCheck label="Opportunity" checked={privacy.includeOpportunity} disabled={!moment.opportunity} onChange={(includeOpportunity) => setPrivacy((current) => ({ ...current, includeOpportunity }))} />
                <PrivacyCheck label="Month and year" checked={privacy.includeDate} onChange={(includeDate) => setPrivacy((current) => ({ ...current, includeDate }))} />
              </div>
            </fieldset>

            <div className={styles.privacyNote}>
              <strong>Private by default.</strong>
              <p>GPA, notes, application counts, rejection history, internal IDs, and your full Journey are never included.</p>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.primary} disabled={Boolean(busy)} onClick={download}>{busy === "download" ? "Preparing PNG…" : "Download PNG"}</button>
              {canCopy ? <button type="button" disabled={Boolean(busy)} onClick={copyImage}>{busy === "copy" ? "Copying…" : "Copy image"}</button> : null}
              {canShare ? <button type="button" disabled={Boolean(busy)} onClick={nativeShare}>{busy === "share" ? "Opening…" : "Share"}</button> : null}
            </div>
            <p className={styles.status} role="status" aria-live="polite">{message}</p>
          </aside>
        </div>
      </div> : null}
    </dialog>
  </>;
}

function PrivacyCheck({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label data-disabled={disabled ? "true" : "false"}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span>{label}</span>
  </label>;
}
