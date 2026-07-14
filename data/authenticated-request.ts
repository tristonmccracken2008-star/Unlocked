"use client";

const activeControllers = new Set<AbortController>();

export function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) controller.abort(externalSignal.reason);
  else externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  activeControllers.add(controller);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    activeControllers.delete(controller);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  });
}

export function abortAuthenticatedRequests() {
  for (const controller of activeControllers) controller.abort("account-signed-out");
  activeControllers.clear();
}
