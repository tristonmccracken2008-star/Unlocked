"use client";

import { useEffect, useRef, useState } from "react";
import { JourneyCardArtwork, journeyCardAltDescription } from "@/components/journey-card-artwork";
import { journeyCardLayouts, type JourneyCardData, type JourneyCardLayout, type JourneyCardPrivacy } from "@/lib/journey-timeline";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { trackProductError, trackProductEvent } from "@/data/product-analytics";
import styles from "./path-moment.module.css";

function fileName(layout: JourneyCardLayout) {
  return `unlocked-journey-card-${layout}.png`;
}

export function JourneyCardCreator({ card, theme, onClose }: { card: JourneyCardData; theme: "light" | "dark"; onClose: () => void }) {
  const [layout, setLayout] = useState<JourneyCardLayout>("story");
  const [exportTheme, setExportTheme] = useState<"light" | "dark">(theme);
  const [privacy, setPrivacy] = useState<JourneyCardPrivacy>({ nameMode: "first_name", includeSchool: Boolean(card.identity.school), includeDates: true });
  const [busy, setBusy] = useState<"download" | "copy" | "share" | null>(null);
  const [message, setMessage] = useState("");
  const [canCopy, setCanCopy] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const artworkRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setCanCopy(Boolean(navigator.clipboard && "ClipboardItem" in window));
    setCanShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      try {
        if (!dialog.open && typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      } catch {
        dialog.setAttribute("open", "");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [canCopy, canShare]);

  function close() {
    const dialog = dialogRef.current;
    if (dialog && typeof dialog.close === "function") dialog.close();
    else dialog?.removeAttribute("open");
    setBusy(null);
    setMessage("");
    onClose();
  }

  async function imageBlob() {
    const svg = artworkRef.current;
    if (!svg) throw new Error("The Journey Card preview is not ready yet.");
    const dimensions = journeyCardLayouts[layout];
    const source = new XMLSerializer().serializeToString(svg);
    const sourceUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.decoding = "async";
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("The Journey Card image could not be prepared."));
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
    setBusy("download");
    setMessage("");
    try {
      const blob = await imageBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(layout);
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setMessage("Journey Card downloaded.");
      trackProductEvent(productIntelligenceEvents.journeyCardDownloaded, { format: layout });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Journey Card could not be downloaded.");
      trackProductError("journey_card", "export", "download");
    } finally {
      setBusy(null);
    }
  }

  async function copyImage() {
    if (!canCopy) return;
    setBusy("copy");
    setMessage("");
    try {
      const blob = await imageBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setMessage("Journey Card copied as an image.");
      trackProductEvent(productIntelligenceEvents.journeyCardCopied, { format: layout });
    } catch {
      setMessage("This browser could not copy the image. Download is still available.");
      trackProductError("journey_card", "export", "copy");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (!canShare) return;
    setBusy("share");
    setMessage("");
    try {
      const blob = await imageBlob();
      const file = new File([blob], fileName(layout), { type: "image/png" });
      const payload = { title: "My UnlockED Journey", text: card.headline, files: [file] };
      if (navigator.canShare && !navigator.canShare(payload)) throw new Error("File sharing is not available.");
      await navigator.share(payload);
      setMessage("Share sheet opened.");
      trackProductEvent(productIntelligenceEvents.journeyCardShared, { format: layout });
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "AbortError" ? "Share canceled." : "This browser could not open sharing. Download is still available.");
      if (!(error instanceof DOMException && error.name === "AbortError")) trackProductError("journey_card", "export", "share");
    } finally {
      setBusy(null);
    }
  }

  const alt = journeyCardAltDescription(card, privacy);
  const messageIsError = /could not|not available|not ready|couldn’t/i.test(message);
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="journey-card-title" aria-describedby="journey-card-description" onCancel={(event) => { event.preventDefault(); close(); }}>
    <div className={styles.shell} data-journey-card-creator="">
      <header className={styles.header}>
        <div><p>Journey Card</p><h2 id="journey-card-title">Share the progress you made.</h2><span id="journey-card-description">Preview the card and choose what personal details to include.</span></div>
        <button type="button" onClick={close} className={styles.close} aria-label="Close Journey Card creator">×</button>
      </header>
      <div className={styles.workspace}>
        <section className={styles.previewColumn} aria-label="Journey Card preview">
          <div className={styles.previewFrame} data-preview-layout={layout} role="img" aria-label={alt}>
            <JourneyCardArtwork ref={artworkRef} card={card} layout={layout} privacy={privacy} theme={exportTheme} />
          </div>
          <p className={styles.previewCaption}>{journeyCardLayouts[layout].label} · {journeyCardLayouts[layout].width} × {journeyCardLayouts[layout].height} PNG</p>
        </section>
        <aside className={styles.controls} aria-label="Journey Card options" aria-busy={busy ? "true" : undefined}>
          <fieldset className={styles.group}><legend>Format</legend><div className={styles.segmented}>{(Object.keys(journeyCardLayouts) as JourneyCardLayout[]).map((item) => <button key={item} type="button" aria-pressed={layout === item} onClick={() => { setLayout(item); setMessage(""); }}>{item === "story" ? "Story" : item === "square" ? "Square" : "LinkedIn"}</button>)}</div></fieldset>
          <fieldset className={styles.group}><legend>Appearance</legend><div className={styles.segmented}>{(["light", "dark"] as const).map((item) => <button key={item} type="button" aria-pressed={exportTheme === item} onClick={() => { setExportTheme(item); setMessage(""); }}>{item === "light" ? "Cream" : "Forest"}</button>)}</div></fieldset>
          <fieldset className={styles.group}><legend>Name</legend><div className={styles.segmented}>{(["anonymous", "first_name", "full_name"] as const).map((mode) => <button key={mode} type="button" aria-pressed={privacy.nameMode === mode} onClick={() => setPrivacy((current) => ({ ...current, nameMode: mode }))}>{mode === "anonymous" ? "Anonymous" : mode === "first_name" ? "First name" : "Full name"}</button>)}</div></fieldset>
          <fieldset className={styles.group}><legend>Optional details</legend><div className={styles.checks}>
            <PrivacyCheck label="School" checked={privacy.includeSchool} disabled={!card.identity.school} onChange={(includeSchool) => setPrivacy((current) => ({ ...current, includeSchool }))} />
            <PrivacyCheck label="Dates" checked={privacy.includeDates} onChange={(includeDates) => setPrivacy((current) => ({ ...current, includeDates }))} />
          </div></fieldset>
          <div className={styles.privacyNote}><strong>Private until you share it.</strong><p>The card includes only the details shown in this preview. It never includes email, GPA, profile answers, application notes, or internal account data.</p></div>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} disabled={Boolean(busy)} onClick={download}>{busy === "download" ? "Preparing PNG…" : "Download PNG"}</button>
            {canCopy ? <button type="button" disabled={Boolean(busy)} onClick={copyImage}>{busy === "copy" ? "Copying…" : "Copy image"}</button> : null}
            {canShare ? <button type="button" disabled={Boolean(busy)} onClick={share}>{busy === "share" ? "Opening…" : "Share"}</button> : null}
          </div>
          <p className={styles.status} role={messageIsError ? "alert" : "status"} aria-live={messageIsError ? "assertive" : "polite"}>{message}</p>
        </aside>
      </div>
    </div>
  </dialog>;
}

function PrivacyCheck({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label data-disabled={disabled ? "true" : "false"}><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}
