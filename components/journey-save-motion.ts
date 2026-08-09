import styles from "./journey-save-motion.module.css";

const activeFlights = new Set<HTMLElement>();
const activeAnimations = new Map<HTMLElement, Animation>();
const activeChips = new Set<HTMLElement>();
const activeBursts = new Set<HTMLElement>();
const decoratedCards = new Set<HTMLElement>();
const decoratedDestinations = new Set<HTMLElement>();
const destinationTimers = new WeakMap<HTMLElement, number>();
const cardTimers = new WeakMap<HTMLElement, number>();
const maximumConcurrentFlights = 2;
const transferQueue: DOMRect[] = [];
const confirmationQueue: boolean[] = [];
const scheduledTransferTimers = new Set<number>();
let scheduledTransfers = 0;
let confirmationActive = false;

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
  decoratedCards.add(card);
  const timer = window.setTimeout(() => {
    card.removeAttribute("data-journey-save-card");
    decoratedCards.delete(card);
    cardTimers.delete(card);
  }, 820);
  cardTimers.set(card, timer);
}

function showNextConfirmationChip() {
  const reducedMotion = confirmationQueue.shift();
  if (reducedMotion === undefined) {
    confirmationActive = false;
    return;
  }
  confirmationActive = true;
  const chip = document.createElement("span");
  chip.className = styles.chip;
  chip.setAttribute("data-journey-save-chip", "");
  chip.dataset.reducedMotion = reducedMotion ? "true" : "false";
  chip.setAttribute("aria-hidden", "true");
  chip.textContent = "✓  Added to Journey";
  document.body.append(chip);
  activeChips.add(chip);
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    activeChips.delete(chip);
    chip.remove();
    showNextConfirmationChip();
  };
  chip.addEventListener("animationend", remove, { once: true });
  window.setTimeout(remove, reducedMotion ? 500 : 1_200);
}

function queueConfirmationChip(reducedMotion: boolean) {
  confirmationQueue.push(reducedMotion);
  if (!confirmationActive) showNextConfirmationChip();
}

function pulseDestination(destination: HTMLElement) {
  const previousTimer = destinationTimers.get(destination);
  if (previousTimer) window.clearTimeout(previousTimer);
  destination.removeAttribute("data-journey-arrival");
  window.requestAnimationFrame(() => {
    destination.setAttribute("data-journey-arrival", "true");
    decoratedDestinations.add(destination);
    const timer = window.setTimeout(() => {
      destination.removeAttribute("data-journey-arrival");
      decoratedDestinations.delete(destination);
      destinationTimers.delete(destination);
    }, 620);
    destinationTimers.set(destination, timer);
  });
}

function provideSoftHaptic() {
  if (!window.matchMedia("(pointer: coarse)").matches || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(8);
}

function showSuccessBurst(sourceRect: DOMRect) {
  const burst = document.createElement("span");
  burst.className = styles.burst;
  burst.setAttribute("data-journey-save-burst", "");
  burst.setAttribute("aria-hidden", "true");
  burst.style.left = `${sourceRect.left + sourceRect.width / 2}px`;
  burst.style.top = `${sourceRect.top + sourceRect.height / 2}px`;
  for (let index = 0; index < 8; index += 1) burst.append(document.createElement("i"));
  document.body.append(burst);
  activeBursts.add(burst);
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    activeBursts.delete(burst);
    burst.remove();
  };
  burst.addEventListener("animationend", (event) => {
    if (event.target === burst && event.pseudoElement === "") remove();
  });
  window.setTimeout(remove, 900);
}

function startTransfer(sourceRect: DOMRect) {
  const destination = visibleJourneyDestination();
  if (!destination) {
    drainTransferQueue();
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
  activeAnimations.set(flight, animation);

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    pulseDestination(destination);
    activeAnimations.delete(flight);
    activeFlights.delete(flight);
    flight.remove();
    drainTransferQueue();
  };
  animation.finished.then(finish).catch(() => {
    settled = true;
    activeAnimations.delete(flight);
    activeFlights.delete(flight);
    flight.remove();
    drainTransferQueue();
  });
  window.setTimeout(finish, 680);
}

function drainTransferQueue() {
  while (transferQueue.length && activeFlights.size + scheduledTransfers < maximumConcurrentFlights) {
    const sourceRect = transferQueue.shift()!;
    const delay = scheduledTransfers * 110;
    scheduledTransfers += 1;
    const timer = window.setTimeout(() => {
      scheduledTransferTimers.delete(timer);
      scheduledTransfers -= 1;
      startTransfer(sourceRect);
    }, delay);
    scheduledTransferTimers.add(timer);
  }
}

export function playJourneySaveMotion(source: HTMLElement | null) {
  if (!source || typeof window === "undefined") return;
  const sourceRect = source.getBoundingClientRect();
  const reducedMotion = prefersReducedMotion();
  brieflyConfirmCard(source);
  queueConfirmationChip(reducedMotion);
  provideSoftHaptic();

  if (reducedMotion) return;
  showSuccessBurst(sourceRect);
  transferQueue.push(sourceRect);
  drainTransferQueue();
}

export function cancelJourneySaveMotion() {
  transferQueue.length = 0;
  confirmationQueue.length = 0;
  confirmationActive = false;
  for (const timer of scheduledTransferTimers) window.clearTimeout(timer);
  scheduledTransferTimers.clear();
  scheduledTransfers = 0;
  for (const [flight, animation] of activeAnimations) {
    animation.cancel();
    flight.remove();
  }
  activeAnimations.clear();
  activeFlights.clear();
  for (const chip of activeChips) chip.remove();
  activeChips.clear();
  for (const burst of activeBursts) burst.remove();
  activeBursts.clear();
  for (const card of decoratedCards) card.removeAttribute("data-journey-save-card");
  decoratedCards.clear();
  for (const destination of decoratedDestinations) destination.removeAttribute("data-journey-arrival");
  decoratedDestinations.clear();
}
