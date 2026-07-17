"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trackProductError, trackProductEvent, trackProductTiming } from "@/data/product-analytics";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { PathMomentArtwork, pathMomentAltDescription, type PathMomentPrivacy } from "@/components/path-moment-artwork";
import { pathMomentLayouts, pathMomentTitle, type PathMomentCollection, type PathMomentLayout, type PathMomentNameMode } from "@/lib/path-moments";
import styles from "./path-moment.module.css";
import type { JourneyThemeName } from "@/lib/journey-theme";

type PathMomentCreatorProps = {
  collection: PathMomentCollection;
  theme: "light" | "dark";
  openedAt: number;
  onClose: () => void;
};

function initialPrivacy(collection: PathMomentCollection): PathMomentPrivacy {
  return { ...collection.defaultPrivacy };
}

function downloadName(layout: PathMomentLayout) {
  return `unlocked-path-moment-${layout}.png`;
}

export function PathMomentCreator({ collection, theme, openedAt, onClose }: PathMomentCreatorProps) {
  const [momentId, setMomentId] = useState(collection.moments[0]?.id ?? "");
  const [layout, setLayout] = useState<PathMomentLayout>("story");
  const [exportTheme, setExportTheme] = useState<JourneyThemeName>(theme);
  const [privacy, setPrivacy] = useState<PathMomentPrivacy>(() => initialPrivacy(collection));
  const [busy, setBusy] = useState<"download" | "copy" | "share" | null>(null);
  const [message, setMessage] = useState("");
  const [canCopy, setCanCopy] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const artworkRef = useRef<SVGSVGElement>(null);
  const completedActionRef = useRef(false);
  const moment = useMemo(() => collection.moments.find((item) => item.id === momentId) ?? collection.moments[0], [collection.moments, momentId]);

  useEffect(() => {
    setCanCopy(Boolean(navigator.clipboard && "ClipboardItem" in window));
    setCanShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    trackProductEvent(productIntelligenceEvents.pathMomentCreatorOpened, { format: layout });
    trackProductTiming("path_moment", "dialog_open", Math.max(0, performance.now() - openedAt));
  }, [openedAt]);

  useEffect(() => {
    trackProductEvent(productIntelligenceEvents.pathMomentPreviewRendered, { format: layout });
  }, [layout]);

  function close() {
    if (!completedActionRef.current) trackProductEvent(productIntelligenceEvents.pathMomentCanceled);
    dialogRef.current?.close();
    setBusy(null);
    setMessage("");
    onClose();
  }

  function updatePrivacy(control: string, update: (current: PathMomentPrivacy) => PathMomentPrivacy) {
    setPrivacy(update);
    trackProductEvent(productIntelligenceEvents.pathMomentPrivacyChanged, { control });
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
    const started = performance.now();
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
      completedActionRef.current = true;
      trackProductEvent(productIntelligenceEvents.pathMomentDownloaded, { format: layout });
      trackProductTiming("path_moment", "png_generation", performance.now() - started);
      setMessage("Path Moment downloaded.");
    } catch (error) {
      trackProductError("path_moment", "export", "download");
      setMessage(error instanceof Error ? error.message : "The Path Moment could not be downloaded.");
    } finally {
      setBusy(null);
    }
  }

  async function copyImage() {
    if (!moment || !canCopy) return;
    setBusy("copy");
    setMessage("");
    const started = performance.now();
    try {
      const blob = await imageBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      completedActionRef.current = true;
      trackProductEvent(productIntelligenceEvents.pathMomentCopied, { format: layout });
      trackProductTiming("path_moment", "copy_latency", performance.now() - started);
      setMessage("Path Moment copied as an image.");
    } catch {
      trackProductError("path_moment", "export", "copy");
      setMessage("This browser could not copy the image. Download is still available.");
    } finally {
      setBusy(null);
    }
  }

  async function nativeShare() {
    if (!moment || !canShare) return;
    setBusy("share");
    setMessage("");
    const started = performance.now();
    try {
      const blob = await imageBlob();
      const file = new File([blob], downloadName(layout), { type: "image/png" });
      const payload = { title: "My UnlockED Path Moment", text: moment.headline, files: [file] };
      if (navigator.canShare && !navigator.canShare(payload)) throw new Error("File sharing is not available.");
      await navigator.share(payload);
      completedActionRef.current = true;
      trackProductEvent(productIntelligenceEvents.pathMomentShared, { format: layout });
      trackProductTiming("path_moment", "share_latency", performance.now() - started);
      setMessage("Share sheet opened.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setMessage("Share canceled.");
      else {
        trackProductError("path_moment", "export", "share");
        setMessage("This browser could not open sharing. Download is still available.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (!moment) return null;
  const alt = pathMomentAltDescription(moment, privacy, collection.identity);
  const messageIsError = /could not|not available|not ready|couldn’t/i.test(message);

  return <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-theme={theme}
      aria-labelledby="path-moment-title"
      aria-describedby="path-moment-description"
      onCancel={(event) => { event.preventDefault(); close(); }}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p>Path Moment</p>
            <h2 id="path-moment-title">Share one meaningful step.</h2>
            <span id="path-moment-description">Preview every detail before it leaves UnlockED.</span>
          </div>
          <button type="button" onClick={close} className={styles.close} aria-label="Close Path Moment creator">×</button>
        </header>

        <div className={styles.workspace}>
          <section className={styles.previewColumn} aria-label="Path Moment preview">
            <div className={styles.previewFrame} data-preview-layout={layout} role="img" aria-label={alt} aria-describedby="path-moment-preview-description">
              <PathMomentArtwork ref={artworkRef} moment={moment} layout={layout} privacy={privacy} identity={collection.identity} theme={exportTheme} />
            </div>
            <p id="path-moment-preview-description" className={styles.orderedStory}>{moment.headline} {moment.explanation}</p>
            <p className={styles.previewCaption}>{pathMomentLayouts[layout].label} · {pathMomentLayouts[layout].width} × {pathMomentLayouts[layout].height} PNG</p>
          </section>

          <aside className={styles.controls} aria-label="Path Moment options" aria-busy={busy ? "true" : undefined}>
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
              <legend>Appearance</legend>
              <div className={styles.segmented}>
                {(["light", "dark"] as JourneyThemeName[]).map((item) => <button key={item} type="button" aria-pressed={exportTheme === item} onClick={() => { setExportTheme(item); setMessage(""); trackProductEvent(productIntelligenceEvents.pathMomentAppearanceChanged, { appearance: item }); }}>{item === "light" ? "Light" : "Dark"}</button>)}
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend>Name</legend>
              <div className={styles.segmented}>
                {(["anonymous", "first_name", "full_name"] as PathMomentNameMode[]).map((mode) => <button key={mode} type="button" aria-pressed={privacy.nameMode === mode} onClick={() => updatePrivacy("name", (current) => ({ ...current, nameMode: mode }))}>{mode === "anonymous" ? "Anonymous" : mode === "first_name" ? "First name" : "Full name"}</button>)}
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend>Optional details</legend>
              <div className={styles.checks}>
                <PrivacyCheck label="School" checked={privacy.includeSchool} disabled={!collection.identity.school} onChange={(includeSchool) => updatePrivacy("school", (current) => ({ ...current, includeSchool }))} />
                <PrivacyCheck label="Organization" checked={privacy.includeOrganization} disabled={!moment.organization} onChange={(includeOrganization) => updatePrivacy("organization", (current) => ({ ...current, includeOrganization }))} />
                <PrivacyCheck label="Opportunity" checked={privacy.includeOpportunity} disabled={!moment.opportunity} onChange={(includeOpportunity) => updatePrivacy("opportunity", (current) => ({ ...current, includeOpportunity }))} />
                <PrivacyCheck label="Month and year" checked={privacy.includeDate} onChange={(includeDate) => updatePrivacy("date", (current) => ({ ...current, includeDate }))} />
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
            <p className={styles.status} role={messageIsError ? "alert" : "status"} aria-live={messageIsError ? "assertive" : "polite"}>{message}</p>
          </aside>
        </div>
      </div>
    </dialog>;
}

function PrivacyCheck({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label data-disabled={disabled ? "true" : "false"}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span>{label}</span>
  </label>;
}
