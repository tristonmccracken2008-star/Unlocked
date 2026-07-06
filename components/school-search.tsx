"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { schools, type School } from "@/data/seed";
import { SearchIcon } from "./icons";

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/^.*@/, "").replace(/\/$/, "").replace(/[.,]/g, "").replace(/[-_\s]+/g, " ");
}

function searchTerms(school: School) {
  return [school.name, school.domain, ...school.aliases].map(normalize);
}

export function SchoolSearch() {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();
  const normalized = normalize(query);
  const exact = useMemo(() => normalized ? schools.find((school) => searchTerms(school).some((term) => term === normalized)) : undefined, [normalized]);
  const partial = useMemo(() => normalized ? schools.filter((school) => searchTerms(school).some((term) => term.includes(normalized))) : [], [normalized]);
  const ambiguous = !exact && partial.length > 1;

  function choose(school: School) { setShowSuggestions(false); router.push(`/schools/${school.slug}`); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (exact) return choose(exact);
    if (partial.length === 1) return choose(partial[0]);
    if (partial.length > 1) return setShowSuggestions(true);
    router.push("/school-not-found");
  }

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <form onSubmit={submit} className="flex w-full flex-col border-2 border-ink bg-white sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
          <SearchIcon className="h-6 w-6 shrink-0 text-ink/35" />
          <span className="sr-only">School name or email domain</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink/35 sm:text-lg" placeholder="School name, abbreviation, or .edu domain" autoComplete="off" aria-controls="school-suggestions" aria-expanded={showSuggestions && ambiguous} />
        </label>
        <button className="border-t-2 border-ink bg-ink px-7 py-4 text-xs font-bold uppercase tracking-widest text-white hover:bg-forest sm:border-l-2 sm:border-t-0">Search directory</button>
      </form>
      {showSuggestions && ambiguous && <div id="school-suggestions" role="listbox" aria-label="School suggestions" className="absolute z-20 mt-1 w-full border-2 border-ink bg-white text-left shadow-[6px_6px_0_#10243e]">
        <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink/35">Choose your school</p>
        {partial.map((school) => <button type="button" role="option" aria-selected="false" key={school.slug} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(school)} className="flex w-full items-center gap-3 border-t border-ink/15 px-4 py-3 hover:bg-paper"><span className="grid h-9 w-12 shrink-0 place-items-center border border-ink text-xs font-black">{school.initials}</span><span><span className="block font-bold">{school.name}</span><span className="block text-sm text-ink/45">{school.domain} · {school.location}</span></span></button>)}
      </div>}
    </div>
  );
}
