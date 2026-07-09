import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return <Link href="/" aria-label="UnlockED home" className={`inline-flex items-center gap-3 ${className}`}>
    <svg viewBox="0 0 40 40" aria-hidden="true" className="h-8 w-8 shrink-0 text-forest">
      <path d="M9 8h18v19.5C27 33 23.5 36 18 36S9 33 9 27.5V8Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M27 8h7v7" fill="none" stroke="#2b211a" strokeWidth="3" strokeLinecap="square" />
      <path d="M17 14v13c0 2.1 1.2 3.2 3 3.2s3-1.1 3-3.2V14" fill="none" stroke="#2b211a" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M27 8 20 15" stroke="#b48a45" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
    <span className="font-editorial text-2xl font-bold tracking-tight text-ink">Unlock<span className="text-forest">ED</span></span>
  </Link>;
}
