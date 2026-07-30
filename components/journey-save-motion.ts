import styles from "./journey-save-motion.module.css";

const activeFlights = new Set<HTMLElement>();
const destinationTimers = new WeakMap<HTMLElement, number>();
const cardTimers = new WeakMap<HTMLElement, number>();
const maximumConcurrentFlights = 2;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function visibleJourneyDestination() {
  return [...document.querySelectorAll<HTMLElement>("[data-journey-destination]")].find((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }) ?? null;
}

function brieflyConfirmCard(source: HTMLElement) {
  const card = source.closest<HTMLElement>("[data-ui-card], [data-for-you-card], article");
  if (!card) return;
  const previousTimer = cardTimers.get(card);
  if (previousTimer) window.clearTimeout(previousTimer);
  card.setAttribute("data-journey-save-card", "confirmed");
  const timer = window.setTimeout(() => {
    card.removeAttribute("data-journey-save-card");
    cardTimers.delete(card);
  }, 820);
  cardTimers.set(card, timer);
}

function showConfirmationChip(reducedMotion: boolean) {
  const chip = document.createElement("span");
  chip.className = styles.chip;
  chip.setAttribute("data-journey-save-chip", "");
  chip.dataset.reducedMotion = reducedMotion ? "true" : "false";
  chip.setAttribute("aria-hidden", "true");
  chip.textContent = "✓  Added to Journey";
  document.body.append(chip);
  const remove = () => chip.remove();
  chip.addEventListener("animationend", remove, { once: true });
  window.setTimeout(remove, reducedMotion ? 500 : 1_200);
}

function pulseDestination(destination: HTMLElement) {
  const previousTimer = destinationTimers.get(destination);
  if (previousTimer) window.clearTimeout(previousTimer);
  destination.removeAttribute("data-journey-arrival");
  window.requestAnimationFrame(() => {
    destination.setAttribute("data-journey-arrival", "true");
    const timer = window.setTimeout(() => {
      destination.removeAttribute("data-journey-arrival");
      destinationTimers.delete(destination);
    }, 620);
    destinationTimers.set(destination, timer);
  });
}

function provideSoftHaptic() {
  if (!window.matchMedia("(pointer: coarse)").matches || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(8);
}

export function playJourneySaveMotion(source: HTMLElement | null) {
  if (!source || typeof window === "undefined") return;
  const sourceRect = source.getBoundingClientRect();
  const reducedMotion = prefersReducedMotion();
  brieflyConfirmCard(source);
  showConfirmationChip(reducedMotion);
  provideSoftHaptic();

  if (reducedMotion) return;
  const destination = visibleJourneyDestination();
  if (!destination) return;
  if (activeFlights.size >= maximumConcurrentFlights) {
    pulseDestination(destination);
    return;
  }

  const destinationRect = destination.getBoundingClientRect();
  const flight = document.createElement("span");
  flight.className = styles.flight;
  flight.setAttribute("data-journey-save-flight", "");
  flight.setAttribute("aria-hidden", "true");
  const startX = sourceRect.left + sourceRect.width / 2 - 12;
  const startY = sourceRect.top + sourceRect.height / 2 - 15;
  const deltaX = destinationRect.left + destinationRect.width / 2 - 12 - startX;
  const deltaY = destinationRect.top + destinationRect.height / 2 - 15 - startY;
  const arc = Math.min(72, Math.max(28, Math.abs(deltaX) * 0.08));
  flight.style.left = `${startX}px`;
  flight.style.top = `${startY}px`;
  document.body.append(flight);
  activeFlights.add(flight);

  const animation = flight.animate([
    { opacity: 0, transform: "translate3d(0, 0, 0) scale(.9) rotate(-2deg)" },
    { opacity: 1, offset: 0.12, transform: "translate3d(0, -2px, 0) scale(1) rotate(-2deg)" },
    { opacity: 0.96, offset: 0.58, transform: `translate3d(${deltaX * 0.58}px, ${deltaY * 0.48 - arc}px, 0) scale(.82) rotate(3deg)` },
    { opacity: 0.12, transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(.42) rotate(0deg)` },
  ], {
    duration: 540,
    easing: "cubic-bezier(.22, .72, .16, 1)",
    fill: "forwards",
  });

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    pulseDestination(destination);
    activeFlights.delete(flight);
    flight.remove();
  };
  animation.finished.then(finish).catch(() => {
    settled = true;
    activeFlights.delete(flight);
    flight.remove();
  });
  window.setTimeout(finish, 680);
}
