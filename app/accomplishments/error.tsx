"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="min-h-[70vh] bg-paper px-5 py-20"><div className="mx-auto max-w-xl"><h1 className="font-editorial text-4xl text-ink">Your record could not load.</h1><p className="mt-4 text-sm leading-7 text-ink/60">Your accomplishments and Journey history are unchanged.</p><button type="button" className="mt-7 min-h-11 rounded-md bg-forest px-5 text-sm font-bold text-white" onClick={reset}>Try again</button></div></main>;
}
