"use client";

import { useEffect, useState } from "react";
import type { JourneyEditorialGeometry, JourneyEditorialModel } from "@/lib/journey-editorial";
import { OpenLineMotionRenderer } from "@/components/open-line/open-line-motion-renderer";

export const journeyTransformationEvent = "unlocked-journey-transformation";

type TransformationDetail = {
  geometries: JourneyEditorialModel["geometries"];
  horizonGeometries: JourneyEditorialModel["horizon"]["geometries"];
  announcement: string;
};

export function JourneyLiveLine({
  presentation,
  mode,
  idPrefix,
  theme,
  empty,
  showDiagnostics,
}: {
  presentation: JourneyEditorialGeometry;
  mode: "desktop" | "tablet" | "mobile";
  idPrefix: string;
  theme: JourneyEditorialModel["theme"];
  empty: boolean;
  showDiagnostics: boolean;
}) {
  const [current, setCurrent] = useState(presentation);
  const [previous, setPrevious] = useState<JourneyEditorialGeometry | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [meaningfulUpdate, setMeaningfulUpdate] = useState(false);

  useEffect(() => {
    setCurrent(presentation);
  }, [presentation]);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<TransformationDetail>).detail;
      const next = idPrefix.startsWith("journey-horizon") ? detail.horizonGeometries[mode] : detail.geometries[mode];
      setPrevious(current);
      setCurrent(next);
      setAnnouncement(detail.announcement);
      setMeaningfulUpdate(true);
    };
    window.addEventListener(journeyTransformationEvent, update);
    return () => window.removeEventListener(journeyTransformationEvent, update);
  }, [current, idPrefix, mode]);

  return <OpenLineMotionRenderer
    previousGeometry={meaningfulUpdate ? previous?.geometry : undefined}
    geometry={current.geometry}
    viewport={current.viewport}
    motionContext={{ cause: meaningfulUpdate ? "meaningful_update" : empty ? "first_journey_creation" : "normal_revisit", preference: "system", allowDeveloperReplay: showDiagnostics }}
    announcement={announcement}
    theme={theme}
    background="transparent"
    quality="high"
    interactive={false}
    showLabels={false}
    showFuture={!empty}
    showBranches={!empty}
    showDiagnostics={showDiagnostics}
    decorativeMarkers
    title={empty ? "The beginning of your Open Line" : "Your current Open Line"}
    description={empty ? "An Origin marker begins an open path." : "Your completed steps lead to the current waypoint and future possibilities."}
    idPrefix={idPrefix}
  />;
}
