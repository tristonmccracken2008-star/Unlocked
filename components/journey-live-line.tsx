"use client";

import { useEffect, useState } from "react";
import type { JourneyEditorialGeometry, JourneyEditorialModel } from "@/lib/journey-editorial";
import { OpenLineMotionRenderer } from "@/components/open-line/open-line-motion-renderer";

export const journeyTransformationEvent = "unlocked-journey-transformation";

type TransformationDetail = {
  geometries: JourneyEditorialModel["geometries"];
  horizonGeometries: JourneyEditorialModel["horizon"]["geometries"];
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
  const [meaningfulUpdate, setMeaningfulUpdate] = useState(false);

  useEffect(() => {
    setCurrent(presentation);
  }, [presentation]);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<TransformationDetail>).detail;
      const next = idPrefix.startsWith("journey-horizon") ? detail.horizonGeometries[mode] : detail.geometries[mode];
      setCurrent((currentPresentation) => {
        setPrevious(currentPresentation);
        return next;
      });
      setMeaningfulUpdate(true);
    };
    window.addEventListener(journeyTransformationEvent, update);
    return () => window.removeEventListener(journeyTransformationEvent, update);
  }, [idPrefix, mode]);

  return <OpenLineMotionRenderer
    previousGeometry={meaningfulUpdate ? previous?.geometry : undefined}
    geometry={current.geometry}
    viewport={current.viewport}
    motionContext={{ cause: meaningfulUpdate ? "meaningful_update" : empty ? "first_journey_creation" : "normal_revisit", preference: "system", allowDeveloperReplay: showDiagnostics }}
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

function responsiveMode() {
  if (typeof window === "undefined") return "desktop" as const;
  if (window.matchMedia("(max-width: 42rem)").matches) return "mobile" as const;
  if (window.matchMedia("(max-width: 64rem)").matches) return "tablet" as const;
  return "desktop" as const;
}

export function JourneyResponsiveLine({
  geometries,
  theme,
  empty,
  showDiagnostics,
}: {
  geometries: JourneyEditorialModel["geometries"];
  theme: JourneyEditorialModel["theme"];
  empty: boolean;
  showDiagnostics: boolean;
}) {
  const [mode, setMode] = useState<"desktop" | "tablet" | "mobile">("desktop");

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64.001rem)");
    const tablet = window.matchMedia("(min-width: 42.001rem) and (max-width: 64rem)");
    const update = () => setMode(responsiveMode());
    update();
    desktop.addEventListener("change", update);
    tablet.addEventListener("change", update);
    return () => {
      desktop.removeEventListener("change", update);
      tablet.removeEventListener("change", update);
    };
  }, []);

  return <div data-responsive-open-line="" data-open-line-mode={mode}>
    <JourneyLiveLine
      presentation={geometries[mode]}
      mode={mode}
      theme={theme}
      empty={empty}
      showDiagnostics={showDiagnostics}
      idPrefix={`journey-editorial-${mode}`}
    />
  </div>;
}
