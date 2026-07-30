"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { BrandMark } from "@/components/brand-mark";
import {
  BookmarkIcon,
  CheckCircleIcon,
  CloseIcon,
  SendIcon,
  SparkIcon,
  TargetIcon,
  TrophyIcon,
} from "@/components/icons";
import {
  JourneyCardAccessibleDetails,
  JourneyCardArtwork,
  journeyCardAltDescription,
} from "@/components/journey-card-artwork";
import {
  journeyCardLayouts,
  journeyCardTemplateLabels,
  journeyCardThemes,
  type JourneyCardAchievement,
  type JourneyCardData,
  type JourneyCardLayout,
  type JourneyCardPrivacy,
  type JourneyCardTemplate,
  type JourneyCardTheme,
} from "@/lib/journey-timeline";
import { productIntelligenceEvents } from "@/lib/analytics-types";
import { trackProductError, trackProductEvent } from "@/data/product-analytics";
import { readAccountSession } from "@/data/account-sync";
import { serializeBrandedArtwork } from "@/lib/brand-export";
import styles from "./journey-card-creator.module.css";

const templateIcons: Record<JourneyCardTemplate, ComponentType<{ className?: string }>> = {
  acceptance: TrophyIcon,
  internship: BookmarkIcon,
  scholarship: SparkIcon,
  research: TargetIcon,
  offer: SendIcon,
  completion: CheckCircleIcon,
  year_review: TrophyIcon,
};

const themeLabels: Record<JourneyCardTheme, string> = {
  cream: "Cream",
  forest: "Forest",
  midnight: "Midnight",
  ivory_gold: "Ivory & Gold",
};

function fileName(template: JourneyCardTemplate, layout: JourneyCardLayout) {
  return `unlocked-${template.replaceAll("_", "-")}-${layout}.png`;
}

function mappedTheme(theme: "light" | "dark", saved?: string): JourneyCardTheme {
  if (saved === "dark" || saved === "forest") return "forest";
  if (saved && journeyCardThemes.includes(saved as JourneyCardTheme)) return saved as JourneyCardTheme;
  return theme === "dark" ? "forest" : "cream";
}

function availableDetails(achievement: JourneyCardAchievement, card: JourneyCardData) {
  return {
    school: Boolean(card.identity.school),
    date: Boolean(achievement.occurredAt),
    role: Boolean(achievement.role),
    organization: Boolean(achievement.organization),
    location: Boolean(achievement.location),
    award: Boolean(achievement.awardAmount),
  };
}

export function JourneyCardCreator({ card, theme, onClose }: { card: JourneyCardData; theme: "light" | "dark"; onClose: () => void }) {
  const initialAchievement = card.achievements.find((item) => item.id === card.defaultAchievementId) ?? card.achievements[0];
  const [selectedAchievementId, setSelectedAchievementId] = useState(initialAchievement?.id ?? "");
  const achievement = card.achievements.find((item) => item.id === selectedAchievementId) ?? initialAchievement;
  const [template, setTemplate] = useState<JourneyCardTemplate>(initialAchievement?.defaultTemplate ?? "year_review");
  const [layout, setLayout] = useState<JourneyCardLayout>("story");
  const [exportTheme, setExportTheme] = useState<JourneyCardTheme>(() => mappedTheme(theme));
  const [privacy, setPrivacy] = useState<JourneyCardPrivacy>({
    nameMode: "first_name",
    includeSchool: Boolean(card.identity.school),
    includeDates: true,
    includeOrganization: true,
    includeBranding: true,
    includeRole: true,
    includeLocation: true,
    includeAwardAmount: true,
  });
  const [busy, setBusy] = useState<"download" | "copy" | "share" | null>(null);
  const [message, setMessage] = useState("");
  const [canCopy, setCanCopy] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const artworkRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setCanCopy(Boolean(navigator.clipboard && "ClipboardItem" in window));
    setCanShare(typeof navigator.share === "function");
    void readAccountSession().then((session) => {
      const defaults = session.data?.preferences?.privacy?.journeyCard;
      if (!defaults) return;
      setLayout(defaults.format);
      setExportTheme(mappedTheme(theme, defaults.theme));
      setPrivacy({
        nameMode: defaults.nameMode,
        includeSchool: defaults.includeSchool && Boolean(card.identity.school),
        includeDates: defaults.includeDate,
        includeOrganization: defaults.includeOrganization,
        includeBranding: defaults.includeBranding,
        includeRole: true,
        includeLocation: true,
        includeAwardAmount: defaults.includeAward,
      });
    }).catch(() => undefined);
  }, [card.identity.school, theme]);

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
  }, []);

  const compatibleTemplates = achievement?.templates ?? [];
  const details = useMemo(() => achievement ? availableDetails(achievement, card) : null, [achievement, card]);
  const gallery = useMemo(() => {
    const seen = new Set<JourneyCardTemplate>();
    return card.achievements.flatMap((item) => item.templates.map((itemTemplate) => ({ achievement: item, template: itemTemplate })))
      .filter((item) => !seen.has(item.template) && seen.add(item.template))
      .slice(0, 5);
  }, [card.achievements]);

  function close() {
    const dialog = dialogRef.current;
    if (dialog && typeof dialog.close === "function") dialog.close();
    else dialog?.removeAttribute("open");
    setBusy(null);
    setMessage("");
    onClose();
  }

  function chooseAchievement(id: string) {
    const next = card.achievements.find((item) => item.id === id);
    if (!next) return;
    setSelectedAchievementId(next.id);
    setTemplate(next.defaultTemplate);
    setMessage("");
  }

  function chooseTemplate(next: JourneyCardTemplate) {
    if (!achievement?.templates.includes(next)) return;
    setTemplate(next);
    setMessage("");
    trackProductEvent(productIntelligenceEvents.journeyCardTemplateSelected, { control: next });
  }

  function chooseGalleryItem(nextAchievement: JourneyCardAchievement, nextTemplate: JourneyCardTemplate) {
    setSelectedAchievementId(nextAchievement.id);
    setTemplate(nextTemplate);
    setMessage("");
  }

  function updatePrivacy<K extends keyof JourneyCardPrivacy>(key: K, value: JourneyCardPrivacy[K], control: string) {
    setPrivacy((current) => ({ ...current, [key]: value }));
    trackProductEvent(productIntelligenceEvents.journeyCardPrivacyChanged, { control });
  }

  async function imageBlob() {
    const svg = artworkRef.current;
    if (!svg) throw new Error("The Journey Card preview is not ready yet.");
    const dimensions = journeyCardLayouts[layout];
    const source = await serializeBrandedArtwork(svg);
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
      link.download = fileName(template, layout);
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setMessage("Your PNG is ready.");
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
      setMessage("Image copied.");
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
      const file = new File([blob], fileName(template, layout), { type: "image/png" });
      const payload = { title: "My UnlockED Journey", text: achievement?.title ?? card.headline, files: [file] };
      if (navigator.canShare && !navigator.canShare(payload)) throw new Error("File sharing is not available.");
      await navigator.share(payload);
      setMessage("Share options opened.");
      trackProductEvent(productIntelligenceEvents.journeyCardShared, { format: layout });
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "AbortError" ? "Share canceled." : "This browser could not open sharing. Download is still available.");
      if (!(error instanceof DOMException && error.name === "AbortError")) trackProductError("journey_card", "export", "share");
    } finally {
      setBusy(null);
    }
  }

  if (!achievement || !details) return null;
  const alt = journeyCardAltDescription(card, achievement, template, privacy);
  const messageIsError = /could not|not available|not ready|couldn’t/i.test(message);

  return <dialog
    ref={dialogRef}
    className={styles.dialog}
    aria-labelledby="journey-card-title"
    aria-describedby="journey-card-description"
    onCancel={(event) => { event.preventDefault(); close(); }}
  >
    <div className={styles.shell} data-journey-card-creator="">
      <div className={styles.brandBar}>
        <div className={styles.brand}><BrandMark width={28} height={28} /><span>Unlock<span>ED</span></span></div>
        <button type="button" onClick={close} className={styles.close} aria-label="Close Journey Card creator"><CloseIcon /></button>
      </div>

      <div className={styles.workspace}>
        <header className={styles.intro}>
          <p>Journey Card</p>
          <h2 id="journey-card-title">Share your achievement.</h2>
          <span id="journey-card-description">Create a polished card using a confirmed Journey milestone.</span>
        </header>

        <section className={`${styles.controlSection} ${styles.choose}`} aria-labelledby="journey-card-template-heading">
          <SectionHeading number="1" id="journey-card-template-heading">Choose template</SectionHeading>
          <label className={styles.achievementSelect}>
            <span>Achievement</span>
            <select value={achievement.id} onChange={(event) => chooseAchievement(event.target.value)}>
              {card.achievements.map((item) => <option key={item.id} value={item.id}>{item.label}: {item.title}</option>)}
            </select>
          </label>
          <div className={styles.templateGrid}>
            {compatibleTemplates.map((item) => {
              const Icon = templateIcons[item];
              return <button key={item} type="button" aria-pressed={template === item} onClick={() => chooseTemplate(item)}>
                <span aria-hidden="true"><Icon /></span>
                {journeyCardTemplateLabels[item]}
              </button>;
            })}
          </div>
        </section>

        <section className={styles.previewColumn} aria-label="Journey Card preview">
          <div className={styles.previewFrame} data-preview-layout={layout} role="img" aria-label={alt}>
            <JourneyCardArtwork ref={artworkRef} card={card} achievement={achievement} layout={layout} privacy={privacy} template={template} theme={exportTheme} />
          </div>
          <div className={styles.srOnly}>
            <JourneyCardAccessibleDetails card={card} achievement={achievement} template={template} privacy={privacy} />
          </div>
          <fieldset className={styles.format}>
            <legend>Format</legend>
            <div className={styles.segmented}>
              {(Object.keys(journeyCardLayouts) as JourneyCardLayout[]).map((item) => <button key={item} type="button" aria-pressed={layout === item} onClick={() => { setLayout(item); setMessage(""); trackProductEvent(productIntelligenceEvents.journeyCardFormatChanged, { format: item }); }}>
                {item === "story" ? "Story" : item === "square" ? "Square" : "LinkedIn"}
              </button>)}
            </div>
          </fieldset>
          <p className={styles.previewCaption}>{journeyCardLayouts[layout].label} · {journeyCardLayouts[layout].width} × {journeyCardLayouts[layout].height} PNG</p>
        </section>

        <div className={styles.controlStack} aria-busy={busy ? "true" : undefined}>
          <section className={styles.controlSection} aria-labelledby="journey-card-appearance-heading">
            <SectionHeading number="2" id="journey-card-appearance-heading">Appearance</SectionHeading>
            <div className={styles.themeGrid}>
              {journeyCardThemes.map((item) => <button key={item} type="button" aria-pressed={exportTheme === item} onClick={() => { setExportTheme(item); setMessage(""); trackProductEvent(productIntelligenceEvents.journeyCardAppearanceChanged, { appearance: item }); }}>
                <span className={styles.themeSwatch} data-theme={item} aria-hidden="true" />
                <span>{themeLabels[item]}</span>
              </button>)}
            </div>
          </section>

          <section className={styles.controlSection} aria-labelledby="journey-card-personalization-heading">
            <SectionHeading number="3" id="journey-card-personalization-heading">Personalization</SectionHeading>
            <fieldset className={styles.group}>
              <legend>Name</legend>
              <div className={styles.segmented}>{(["anonymous", "first_name", "full_name"] as const).map((mode) => <button key={mode} type="button" aria-pressed={privacy.nameMode === mode} onClick={() => updatePrivacy("nameMode", mode, "name")}>
                {mode === "anonymous" ? "Anonymous" : mode === "first_name" ? "First name" : "Full name"}
              </button>)}</div>
            </fieldset>
            <fieldset className={styles.group}>
              <legend>Show details</legend>
              <div className={styles.checks}>
                <PrivacyCheck label="School" checked={privacy.includeSchool} disabled={!details.school} onChange={(value) => updatePrivacy("includeSchool", value, "school")} />
                <PrivacyCheck label="Date" checked={privacy.includeDates} disabled={!details.date} onChange={(value) => updatePrivacy("includeDates", value, "date")} />
                <PrivacyCheck label="Role" checked={privacy.includeRole !== false} disabled={!details.role} onChange={(value) => updatePrivacy("includeRole", value, "role")} />
                <PrivacyCheck label="Organization" checked={privacy.includeOrganization !== false} disabled={!details.organization} onChange={(value) => updatePrivacy("includeOrganization", value, "organization")} />
                {details.location ? <PrivacyCheck label="Location" checked={privacy.includeLocation !== false} onChange={(value) => updatePrivacy("includeLocation", value, "location")} /> : null}
                {details.award ? <PrivacyCheck label="Award amount" checked={privacy.includeAwardAmount !== false} onChange={(value) => updatePrivacy("includeAwardAmount", value, "award_amount")} /> : null}
              </div>
            </fieldset>
            <fieldset className={styles.group}>
              <legend>Branding</legend>
              <PrivacyCheck label="Show UnlockED branding" checked={privacy.includeBranding !== false} onChange={(value) => updatePrivacy("includeBranding", value, "branding")} />
            </fieldset>
          </section>

          <section className={styles.controlSection} aria-labelledby="journey-card-share-heading">
            <SectionHeading number="4" id="journey-card-share-heading">Preview & share</SectionHeading>
            <p className={styles.privacyNote}><strong>Private until you share it.</strong> Only the details visible in the preview are included.</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} disabled={Boolean(busy)} onClick={download}>{busy === "download" ? "Preparing PNG…" : "Download PNG"}</button>
              {canCopy ? <button type="button" disabled={Boolean(busy)} onClick={copyImage}>{busy === "copy" ? "Copying…" : "Copy image"}</button> : null}
              {canShare ? <button type="button" disabled={Boolean(busy)} onClick={share}>{busy === "share" ? "Opening…" : "Share"}</button> : null}
            </div>
            <p className={styles.status} role={messageIsError ? "alert" : "status"} aria-live={messageIsError ? "assertive" : "polite"}>{message}</p>
          </section>
        </div>

        <section className={styles.gallery} aria-labelledby="journey-card-gallery-heading">
          <h3 id="journey-card-gallery-heading">Templates</h3>
          <div>
            {gallery.map((item) => <button
              key={`${item.achievement.id}:${item.template}`}
              type="button"
              aria-pressed={achievement.id === item.achievement.id && template === item.template}
              onClick={() => chooseGalleryItem(item.achievement, item.template)}
            >
              <span>{journeyCardTemplateLabels[item.template]}</span>
              <strong>{item.achievement.title}</strong>
              {item.achievement.organization ? <small>{item.achievement.organization}</small> : null}
            </button>)}
          </div>
        </section>
      </div>
    </div>
  </dialog>;
}

function SectionHeading({ number, id, children }: { number: string; id: string; children: string }) {
  return <h3 id={id}><span>{number}.</span> {children}</h3>;
}

function PrivacyCheck({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label data-disabled={disabled ? "true" : "false"}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span aria-hidden="true">{checked ? "✓" : ""}</span>
    <em>{label}</em>
  </label>;
}
