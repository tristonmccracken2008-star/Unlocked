import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return <Link href="/" aria-label="UnlockED home" className={`inline-flex items-center gap-2.5 ${className}`}>
    <svg viewBox="0 0 36 36" aria-hidden="true" className="h-8 w-8 shrink-0">
      <path d="M8 6v15c0 6.1 3.8 9 9.7 9S28 27.1 28 21V11" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square" />
      <path d="M24 6h7v7" fill="none" stroke="#9a6617" strokeWidth="3.2" strokeLinecap="square" />
      <circle cx="18" cy="20" r="2.25" fill="#9a6617" />
      <path d="M18 22v3" stroke="#9a6617" strokeWidth="2" />
    </svg>
    <span className="font-editorial text-2xl font-bold tracking-tight">Unlock<span className="text-forest">ED</span></span>
  </Link>;
}
