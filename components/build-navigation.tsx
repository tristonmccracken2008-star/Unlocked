import Link from "next/link";

export function BuildNavigation({
  current,
}: {
  current: "overview" | "experience" | "resumes" | "materials";
}) {
  const links = [
    ["overview", "Overview", "/build"],
    ["experience", "Experience", "/resume-lab?view=experience"],
    ["resumes", "Resumes", "/resume-lab?view=resumes"],
    ["materials", "Materials", "/materials"],
  ] as const;
  return (
    <nav
      aria-label="Build sections"
      className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-ink/10 bg-white/40 p-1"
    >
      {links.map(([id, label, href]) => (
        <Link
          key={id}
          href={href}
          aria-current={current === id ? "page" : undefined}
          className={`inline-flex min-h-11 shrink-0 items-center rounded-md px-2.5 text-xs font-bold transition-colors sm:px-4 sm:text-sm ${current === id ? "bg-white text-forest shadow-sm" : "text-ink/55 hover:bg-white/60 hover:text-ink"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
