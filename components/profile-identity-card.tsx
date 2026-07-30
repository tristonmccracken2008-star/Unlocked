"use client";

import { useEffect, useMemo, useState } from "react";
import type { StudentProfile } from "@/data/student-profile";
import type { AccountSession } from "@/lib/account-types";
import { buildProfileIdentityModel } from "@/lib/profile-identity";

export function ProfileIdentityCard({
  profile,
  session,
  onEdit,
}: {
  profile: StudentProfile | null;
  session: AccountSession;
  onEdit: (fieldId: string) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const identity = useMemo(
    () => buildProfileIdentityModel(profile, session.user ?? { name: "Student" }, session.data ?? { activity: null, tracker: {}, journeyProgress: {} }),
    [profile, session.data, session.user],
  );

  useEffect(() => setImageFailed(false), [session.user?.id, session.user?.image]);

  return <section
    data-profile-identity-card
    aria-labelledby="profile-heading"
    className="overflow-hidden rounded-lg border border-[var(--unlocked-border)] bg-[var(--unlocked-surface)] shadow-[0_18px_50px_rgba(43,33,26,.06)]"
  >
    <div className="flex flex-wrap items-start gap-x-4 gap-y-4 px-5 py-6 sm:flex-nowrap sm:gap-6 sm:px-7 sm:py-7">
      <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-forest font-editorial text-xl font-bold text-white sm:h-24 sm:w-24 sm:text-3xl">
        <span aria-hidden="true">{identity.initials}</span>
        {session.user?.image && !imageFailed ? <img
          src={session.user.image}
          alt={`${identity.name}'s profile photo`}
          width={96}
          height={96}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        /> : null}
      </div>

      <div className="min-w-0 flex-1">
        <p className="rule-label text-forest">Private identity</p>
        <h2 id="profile-heading" className="mt-2 break-words font-editorial text-3xl font-bold leading-tight text-[var(--unlocked-text)] sm:text-4xl">{identity.name}</h2>
        <div className="mt-3 space-y-1 text-sm leading-6 text-[var(--unlocked-muted)]">
          {identity.school ? <p>{identity.school}</p> : null}
          {identity.majors ? <p className="font-bold text-[var(--unlocked-text)]">{identity.majors}</p> : null}
          {identity.minor ? <p>{identity.minor}</p> : null}
          {identity.graduation ? <p>{identity.graduation}</p> : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onEdit("first-name")}
        className="ml-20 inline-flex min-h-11 basis-[calc(100%-5rem)] items-center justify-center rounded-full border border-[var(--unlocked-border)] px-4 text-sm font-bold text-forest hover:border-forest hover:bg-[var(--unlocked-surface-muted)] sm:ml-0 sm:basis-auto"
      >
        Edit profile
      </button>
    </div>

    <div className="grid border-t border-[var(--unlocked-border)] md:grid-cols-[minmax(12rem,.72fr)_minmax(0,1.28fr)]">
      <div className="px-5 py-5 sm:px-7">
        <p className="rule-label text-[var(--unlocked-muted)]">Career goal</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <p className="min-w-0 break-words font-editorial text-xl font-bold text-[var(--unlocked-text)]">{identity.careerGoal ?? "Not set"}</p>
          <button type="button" onClick={() => onEdit("profile-goals")} className="min-h-11 shrink-0 text-sm font-bold text-forest hover:text-[var(--unlocked-text)]">
            Edit
          </button>
        </div>
      </div>

      <div className="border-t border-[var(--unlocked-border)] px-5 py-5 sm:px-7 md:border-l md:border-t-0">
        <div className="flex items-center justify-between gap-4">
          <p className="rule-label text-[var(--unlocked-muted)]">Journey</p>
          {identity.journey ? <a href="/" className="inline-flex min-h-11 items-center text-sm font-bold text-forest hover:text-[var(--unlocked-text)]">View Journey</a> : null}
        </div>
        {identity.journey ? <dl aria-label="Journey snapshot" className="grid grid-cols-3 gap-x-4 gap-y-4 pb-1 sm:grid-cols-5">
          {identity.journey.map((stat) => <div key={stat.id} className="min-w-0">
            <dt className="truncate text-[11px] font-bold text-[var(--unlocked-muted)]">{stat.label}</dt>
            <dd className="mt-1 font-editorial text-2xl font-bold tabular-nums text-[var(--unlocked-text)]">{stat.value.toLocaleString()}</dd>
          </div>)}
        </dl> : <p className="mt-2 max-w-md text-sm leading-6 text-[var(--unlocked-muted)]">Your private Journey snapshot will appear after you save an opportunity or record a milestone.</p>}
      </div>
    </div>
  </section>;
}
