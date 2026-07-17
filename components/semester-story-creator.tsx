"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trackProductError, trackProductEvent, trackProductTiming } from "@/data/product-analytics";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { SemesterStoryArtwork, semesterStoryAltDescription } from "@/components/semester-story-artwork";
import {
  semesterStoryLayouts,
  type SemesterStoryCollection,
  type SemesterStoryLayout,
  type SemesterStoryPrivacy,
} from "@/lib/semester-story";
import styles from "./path-moment.module.css";
import type { JourneyThemeName } from "@/lib/journey-theme";

type SemesterStoryCreatorProps = {
  collection: SemesterStoryCollection;
  theme: "light" | "dark";
  openedAt: number;
  onClose: () => void;
};

function downloadName(layout: SemesterStoryLayout) {
  return `unlocked-semester-story-${layout}.png`;
}

export function SemesterStoryCreator({ collection, theme, openedAt, onClose }: SemesterStoryCreatorProps) {
  const [storyId, setStoryId] = useState(collection.selectedTermId ? collection.stories.find((story) => story.term.id === collection.selectedTermId)?.id ?? collection.stories[0]?.id : collection.stories[0]?.id ?? "");
  const [layout, setLayout] = useState<SemesterStoryLayout>("story");
  const [exportTheme, setExportTheme] = useState<JourneyThemeName>(theme);
  const [privacy, setPrivacy] = useState<SemesterStoryPrivacy>({ ...collection.defaultPrivacy });
  const [busy, setBusy] = useState<"download" | "copy" | "share" | null>(null);
  const [message, setMessage] = useState("");
  const [canCopy, setCanCopy] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const artworkRef = useRef<SVGSVGElement>(null);
  const completedActionRef = useRef(false);
  const viewedStoriesRef = useRef(new Set<string>());
  const story = useMemo(() => collection.stories.find((item) => item.id === storyId) ?? collection.stories[0], [collection.stories, storyId]);

  useEffect(() => {
    setCanCopy(Boolean(navigator.clipboard && "ClipboardItem" in window));
    setCanShare(typeof navigator.share === "function");
    dialogRef.current?.showModal();
    trackProductEvent(productIntelligenceEvents.semesterStoryCreatorOpened, { format: layout });
    trackProductTiming("semester_story", "dialog_open", Math.max(0, performance.now() - openedAt));
  }, [openedAt]);

  function close() {
    if (!completedActionRef.current) trackProductEvent(productIntelligenceEvents.semesterStoryCanceled);
    dialogRef.current?.close();
    setBusy(null);
    setMessage("");
    onClose();
  }

  function selectStory(nextStoryId: string) {
    setStoryId(nextStoryId);
    setMessage("");
    const selected = collection.stories.find((item) => item.id === nextStoryId);
    if (!selected || viewedStoriesRef.current.has(selected.id)) return;
    viewedStoriesRef.current.add(selected.id);
    if (selected.term.id !== collection.selectedTermId) {
      trackProductEvent(productIntelligenceEvents.semesterStoryPreviousViewed, { semesterRelation: "previous" });
    }
    if (selected.comparison) trackProductEvent(productIntelligenceEvents.semesterStoryComparisonViewed);
  }

  function updatePrivacy(control: string, update: (current: SemesterStoryPrivacy) => SemesterStoryPrivacy) {
    setPrivacy(update);
    trackProductEvent(productIntelligenceEvents.semesterStoryPrivacyChanged, { control });
  }

  async function imageBlob() {
    const svg = artworkRef.current;
    if (!svg) throw new Error("The Semester Story preview is not ready yet.");
    const dimensions = semesterStoryLayouts[layout];
    const source = new XMLSerializer().serializeToString(svg);
    const sourceUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.decoding = "async";
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("The Semester Story image could not be prepared."));
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
      trackProductEvent(productIntelligenceEvents.semesterStoryDownloaded, { format: layout });
      trackProductTiming("semester_story", "png_generation", performance.now() - started);
      setMessage("Semester Story downloaded.");
    } catch (error) {
      trackProductError("semester_story", "export", "download");
      setMessage(error instanceof Error ? error.message : "The Semester Story could not be downloaded.");
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
      completedActionRef.current = true;
      setMessage("Semester Story copied as an image.");
    } catch {
      trackProductError("semester_story", "export", "copy");
      setMessage("This browser could not copy the image. Download is still available.");
    } finally {
      setBusy(null);
    }
  }

  async function nativeShare() {
    if (!canShare || !story) return;
    setBusy("share");
    setMessage("");
    const started = performance.now();
    try {
      const blob = await imageBlob();
      const file = new File([blob], downloadName(layout), { type: "image/png" });
      const payload = { title: `My ${story.term.label} Semester Story`, text: story.opening, files: [file] };
      if (navigator.canShare && !navigator.canShare(payload)) throw new Error("File sharing is not available.");
      await navigator.share(payload);
      completedActionRef.current = true;
      trackProductEvent(productIntelligenceEvents.semesterStoryShared, { format: layout });
      trackProductTiming("semester_story", "share_latency", performance.now() - started);
      setMessage("Share sheet opened.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setMessage("Share canceled.");
      else {
        trackProductError("semester_story", "export", "share");
        setMessage("This browser could not open sharing. Download is still available.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (!story) return null;
  const alt = semesterStoryAltDescription(story, privacy, collection.identity);
  const messageIsError = /could not|not available|not ready|couldn’t/i.test(message);

  return <dialog
    ref={dialogRef}
    className={styles.dialog}
    data-theme={theme}
    aria-labelledby="semester-story-title"
    aria-describedby="semester-story-description"
    onCancel={(event) => { event.preventDefault(); close(); }}
  >
    <div className={styles.shell} data-semester-story-creator="">
      <header className={styles.header}>
        <div>
          <p>Semester Story</p>
          <h2 id="semester-story-title">See how your path changed.</h2>
          <span id="semester-story-description">Only meaningful progress from this academic term appears here.</span>
        </div>
        <button type="button" onClick={close} className={styles.close} aria-label="Close Semester Story creator">×</button>
      </header>

      <div className={styles.workspace}>
        <section className={styles.previewColumn} aria-label="Semester Story preview">
          <div className={styles.previewFrame} data-preview-layout={layout} role="img" aria-label={alt} aria-describedby="semester-story-ordered-recap">
            <SemesterStoryArtwork ref={artworkRef} story={story} layout={layout} privacy={privacy} identity={collection.identity} theme={exportTheme} />
          </div>
          <p className={styles.previewCaption}>{semesterStoryLayouts[layout].label} · {semesterStoryLayouts[layout].width} × {semesterStoryLayouts[layout].height} PNG</p>
          <div id="semester-story-ordered-recap" className={styles.orderedStory}>
            <h3>{story.heading}</h3>
            <p>{story.opening}</p>
            <ol>{story.moments.map((moment) => <li key={moment.id}>{moment.headline} {moment.explanation}</li>)}</ol>
            <p><strong>What changed:</strong> {story.whatChanged.join(" ")}</p>
          </div>
        </section>

        <aside className={styles.controls} aria-label="Semester Story options" aria-busy={busy ? "true" : undefined}>
          <label className={styles.field}>
            <span>Academic term</span>
            <select value={story.id} onChange={(event) => selectStory(event.target.value)}>
              {collection.stories.map((item) => <option key={item.id} value={item.id}>{item.heading}</option>)}
            </select>
          </label>

          <fieldset className={styles.group}>
            <legend>Format</legend>
            <div className={styles.segmented}>
              {(Object.keys(semesterStoryLayouts) as SemesterStoryLayout[]).map((item) => <button key={item} type="button" aria-pressed={layout === item} onClick={() => { setLayout(item); setMessage(""); }}>{item === "story" ? "Story" : item === "square" ? "Square" : "LinkedIn"}</button>)}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Appearance</legend>
            <div className={styles.segmented}>
              {(["light", "dark"] as JourneyThemeName[]).map((item) => <button key={item} type="button" aria-pressed={exportTheme === item} onClick={() => { setExportTheme(item); setMessage(""); trackProductEvent(productIntelligenceEvents.semesterStoryAppearanceChanged, { appearance: item }); }}>{item === "light" ? "Light" : "Dark"}</button>)}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Name</legend>
            <div className={styles.segmented}>
              {(["anonymous", "first_name", "full_name"] as const).map((mode) => <button key={mode} type="button" aria-pressed={privacy.nameMode === mode} onClick={() => updatePrivacy("name", (current) => ({ ...current, nameMode: mode }))}>{mode === "anonymous" ? "Anonymous" : mode === "first_name" ? "First name" : "Full name"}</button>)}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>Optional details</legend>
            <div className={styles.checks}>
              <PrivacyCheck label="School" checked={privacy.includeSchool} disabled={!collection.identity.school} onChange={(includeSchool) => updatePrivacy("school", (current) => ({ ...current, includeSchool }))} />
              <PrivacyCheck label="Major" checked={privacy.includeMajor} disabled={!collection.identity.major} onChange={(includeMajor) => updatePrivacy("major", (current) => ({ ...current, includeMajor }))} />
              <PrivacyCheck label="Term" checked={privacy.includeTerm} onChange={(includeTerm) => updatePrivacy("term", (current) => ({ ...current, includeTerm }))} />
              <PrivacyCheck label="Opportunity" checked={privacy.includeOpportunity} disabled={!story.moments.some((moment) => moment.opportunity)} onChange={(includeOpportunity) => updatePrivacy("opportunity", (current) => ({ ...current, includeOpportunity }))} />
              <PrivacyCheck label="Organization" checked={privacy.includeOrganization} disabled={!story.moments.some((moment) => moment.organization)} onChange={(includeOrganization) => updatePrivacy("organization", (current) => ({ ...current, includeOrganization }))} />
              <PrivacyCheck label="Month and year" checked={privacy.includeDate} onChange={(includeDate) => updatePrivacy("date", (current) => ({ ...current, includeDate }))} />
              <PrivacyCheck label="Selected counts" checked={privacy.includeCounts} disabled={!story.counts.length} onChange={(includeCounts) => updatePrivacy("counts", (current) => ({ ...current, includeCounts }))} />
              <PrivacyCheck label="Profile link" checked={privacy.includeProfileLink} disabled={!collection.identity.profileHref} onChange={(includeProfileLink) => updatePrivacy("profile_link", (current) => ({ ...current, includeProfileLink }))} />
            </div>
          </fieldset>

          <div className={styles.privacyNote}>
            <strong>Private by default.</strong>
            <p>GPA, notes, answers, rejection details, eligibility data, internal IDs, hidden branches, and your full Journey are never included.</p>
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
