type JourneySaveTask<T> = () => Promise<T>;

let requestTail: Promise<void> = Promise.resolve();

export async function queueJourneySaveRequest<T>(task: JourneySaveTask<T>, signal: AbortSignal): Promise<T> {
  const predecessor = requestTail.catch(() => undefined);
  let release!: () => void;
  requestTail = new Promise<void>((resolve) => { release = resolve; });

  await predecessor;
  try {
    if (signal.aborted) throw new DOMException("Journey save cancelled.", "AbortError");
    return await task();
  } finally {
    release();
  }
}
