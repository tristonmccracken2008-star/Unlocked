export function openLineCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function openLineCoordinateText(value: number) {
  return String(openLineCoordinate(value));
}
