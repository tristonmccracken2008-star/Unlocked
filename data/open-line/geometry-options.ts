import { PathGeometryError, type PathGeometryOptions, type PathGeometryOptionsInput, type PathLayoutMode } from "./geometry-types";

const defaults: Record<PathLayoutMode, PathGeometryOptions> = {
  desktop: {
    mode: "desktop",
    width: 1200,
    paddingTop: 72,
    paddingRight: 40,
    paddingBottom: 72,
    paddingLeft: 40,
    primaryLaneX: 576,
    laneSpacing: 112,
    routineSpacing: 72,
    meaningfulSpacing: 104,
    validationSpacing: 144,
    minimumNodeSpacing: 64,
    maximumVisibleBranches: 3,
    maximumVisiblePossibilities: 3,
    labelWidth: 280,
    maximumLayoutPasses: 4,
  },
  tablet: {
    mode: "tablet",
    width: 880,
    paddingTop: 56,
    paddingRight: 28,
    paddingBottom: 64,
    paddingLeft: 28,
    primaryLaneX: 388,
    laneSpacing: 84,
    routineSpacing: 68,
    meaningfulSpacing: 96,
    validationSpacing: 132,
    minimumNodeSpacing: 60,
    maximumVisibleBranches: 3,
    maximumVisiblePossibilities: 3,
    labelWidth: 220,
    maximumLayoutPasses: 4,
  },
  mobile: {
    mode: "mobile",
    width: 390,
    paddingTop: 40,
    paddingRight: 16,
    paddingBottom: 56,
    paddingLeft: 0,
    primaryLaneX: 40,
    laneSpacing: 8,
    routineSpacing: 68,
    meaningfulSpacing: 96,
    validationSpacing: 132,
    minimumNodeSpacing: 60,
    maximumVisibleBranches: 2,
    maximumVisiblePossibilities: 2,
    labelWidth: 286,
    maximumLayoutPasses: 4,
  },
  share: {
    mode: "share",
    width: 1080,
    paddingTop: 64,
    paddingRight: 40,
    paddingBottom: 72,
    paddingLeft: 40,
    primaryLaneX: 518,
    laneSpacing: 104,
    routineSpacing: 72,
    meaningfulSpacing: 104,
    validationSpacing: 144,
    minimumNodeSpacing: 64,
    maximumVisibleBranches: 3,
    maximumVisiblePossibilities: 3,
    labelWidth: 248,
    maximumLayoutPasses: 4,
  },
};

const maximumWidths: Record<PathLayoutMode, number> = { desktop: 1200, tablet: 1024, mobile: 600, share: 1200 };
const minimumWidths: Record<PathLayoutMode, number> = { desktop: 720, tablet: 560, mobile: 240, share: 720 };

function finitePositive(value: number, name: string, allowZero = false) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) throw new PathGeometryError(`${name} must be a finite ${allowZero ? "non-negative" : "positive"} number.`);
}

export function getDefaultPathGeometryOptions(mode: PathLayoutMode = "desktop"): PathGeometryOptions {
  return { ...defaults[mode] };
}

export function resolvePathGeometryOptions(input: PathGeometryOptionsInput = {}): PathGeometryOptions {
  const mode = input.mode ?? "desktop";
  const base = getDefaultPathGeometryOptions(mode);
  const requestedWidth = input.width ?? base.width;
  finitePositive(requestedWidth, "width");
  const width = Math.min(maximumWidths[mode], Math.max(minimumWidths[mode], requestedWidth));
  const widthScale = width / base.width;
  const primaryLaneX = input.primaryLaneX ?? (mode === "mobile" ? 40 : Math.round(base.primaryLaneX * widthScale));
  const labelWidth = input.labelWidth ?? (mode === "mobile" ? Math.max(120, width - primaryLaneX - 64) : Math.max(160, Math.round(base.labelWidth * Math.min(1, widthScale))));
  const branchLimit = mode === "mobile" ? 2 : 3;
  const possibilityLimit = mode === "mobile" ? 2 : 3;
  const options: PathGeometryOptions = {
    ...base,
    ...input,
    mode,
    width,
    primaryLaneX,
    labelWidth,
    maximumVisibleBranches: Math.min(input.maximumVisibleBranches ?? base.maximumVisibleBranches, branchLimit),
    maximumVisiblePossibilities: Math.min(input.maximumVisiblePossibilities ?? base.maximumVisiblePossibilities, possibilityLimit),
    maximumLayoutPasses: Math.min(input.maximumLayoutPasses ?? base.maximumLayoutPasses, 8),
  };

  for (const name of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const) finitePositive(options[name], name, true);
  for (const name of ["primaryLaneX", "laneSpacing", "routineSpacing", "meaningfulSpacing", "validationSpacing", "minimumNodeSpacing", "labelWidth"] as const) finitePositive(options[name], name);
  for (const name of ["maximumVisibleBranches", "maximumVisiblePossibilities", "maximumLayoutPasses"] as const) {
    finitePositive(options[name], name);
    if (!Number.isInteger(options[name])) throw new PathGeometryError(`${name} must be an integer.`);
  }
  if (options.paddingLeft + options.paddingRight >= width) throw new PathGeometryError("Horizontal padding must leave positive content width.");
  if (options.primaryLaneX < 22 || options.primaryLaneX > width - 22) throw new PathGeometryError("primaryLaneX must keep the minimum interaction geometry inside the layout.");
  if (mode === "mobile" && options.primaryLaneX < 40) throw new PathGeometryError("Mobile primaryLaneX must preserve the 40px left rail.");
  if (options.minimumNodeSpacing < 44) throw new PathGeometryError("minimumNodeSpacing must preserve at least 44px interaction geometry.");
  if (options.routineSpacing < options.minimumNodeSpacing) throw new PathGeometryError("routineSpacing cannot be smaller than minimumNodeSpacing.");
  if (options.meaningfulSpacing < options.routineSpacing) throw new PathGeometryError("meaningfulSpacing cannot be smaller than routineSpacing.");
  if (options.validationSpacing < options.meaningfulSpacing) throw new PathGeometryError("validationSpacing cannot be smaller than meaningfulSpacing.");
  return options;
}
