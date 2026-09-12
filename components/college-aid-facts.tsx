import type { RequirementState, VerifiedCollegeAid } from "@/data/college-financial-aid";

const requirementLabels: Record<RequirementState, string> = {
  required: "Required", required_for_institutional_aid: "Required for institutional aid",
  recommended: "Recommended", may_be_required: "May be required",
  not_required: "Not required", not_verified: "Not currently verified",
};
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function CollegeAidFacts({ guidance, heading }: { guidance: VerifiedCollegeAid; heading?: string }) {
  const verifiedLabel = guidance.verificationStatus === "verified_current_cycle" ? `Verified for ${guidance.aidYear}` : guidance.verificationStatus === "verified_cycle_independent" ? "Current process verified; deadline not verified" : "Review required";
  return <article className="rounded-2xl border border-ink/10 bg-[var(--unlocked-surface)] p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-forest">{verifiedLabel}</p><h3 className="mt-2 font-editorial text-2xl font-semibold">{heading ?? "Financial aid requirements"}</h3></div><p className="text-xs text-ink/40">Reviewed {guidance.verifiedAt}</p></div>
    <dl className="mt-5 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-4">
      <AidFact label="FAFSA" value={`${requirementLabels[guidance.fafsa]}${guidance.fafsaCode ? ` · ${guidance.fafsaCode}` : ""}`} />
      <AidFact label="CSS Profile" value={`${requirementLabels[guidance.cssProfile]}${guidance.cssCode ? ` · ${guidance.cssCode}` : ""}`} />
      <AidFact label="IDOC" value={requirementLabels[guidance.idoc]} />
      <AidFact label="Noncustodial parent" value={requirementLabels[guidance.noncustodialParent]} />
      <AidFact label="Waiver process" value={titleCase(guidance.waiverProcess)} />
      {guidance.meritAid ? <AidFact label="Merit aid" value={`${titleCase(guidance.meritAid.availability)} · ${titleCase(guidance.meritAid.consideration)}`} /> : null}
      {guidance.needBasedPolicy ? <AidFact label="Need-based policy" value={`${guidance.needBasedPolicy.meetsFullDemonstratedNeed ? "Meets full demonstrated need" : "See policy"}${guidance.needBasedPolicy.noLoan ? " · no-loan policy stated" : ""}`} /> : null}
      {guidance.international ? <AidFact label="International aid" value={titleCase(guidance.international.needBasedAid)} /> : null}
    </dl>
    {guidance.deadlines.length ? <div className="mt-5 border-t border-ink/10 pt-4"><p className="text-xs font-bold uppercase tracking-[.1em] text-ink/45">Verified deadlines</p><ul className="mt-2 space-y-2 text-sm">{guidance.deadlines.map((deadline) => <li key={deadline.id} className="flex flex-wrap justify-between gap-2"><a href={deadline.sourceUrl} target="_blank" rel="noreferrer" className="font-bold text-forest">{deadline.label} ↗</a><span className="tabular-nums text-ink/55">{deadline.date} · {deadline.cycle}</span></li>)}</ul></div> : <p className="mt-5 border-t border-ink/10 pt-4 text-xs leading-5 text-ink/45">No current-cycle deadline is verified in UnlockED. Confirm the date with the financial aid office.</p>}
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-ink/10 pt-4 text-xs font-bold"><a href={guidance.netPriceCalculator.url} target="_blank" rel="noreferrer" className="text-forest">Official net price calculator ↗</a><a href={guidance.contact.url} target="_blank" rel="noreferrer" className="text-forest">Financial aid office ↗</a>{guidance.sources.map((source) => <a key={`${source.url}:${source.label}`} href={source.url} target="_blank" rel="noreferrer" className="text-forest">{source.label} ↗</a>)}</div>
  </article>;
}

function AidFact({ label, value }: { label: string; value: string }) {
  return <div className="border-t border-ink/10 py-3"><dt className="text-[10px] font-bold uppercase tracking-[.1em] text-ink/40">{label}</dt><dd className="mt-1 text-sm font-semibold leading-5">{value}</dd></div>;
}
