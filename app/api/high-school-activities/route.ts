import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  resumeFactKinds,
  type HighSchoolRolePeriod,
  type ResumeFactSource,
} from "@/data/resume-lab";
import { getSession, sessionCookieName } from "@/lib/auth-store";
import {
  updateHighSchoolActivities,
  type HighSchoolActivitiesMutation,
} from "@/lib/high-school-activities-service";
import {
  assertSameOrigin,
  enforceRateLimit,
  readBoundedJson,
  SecurityError,
  securityErrorResponse,
} from "@/lib/security";

const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const clean = (value: unknown, max: number) =>
  typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, max)
    : "";
const id = (value: unknown) => {
  const result = clean(value, 160);
  return safeId.test(result) ? result : "";
};
const integer = (value: unknown, max: number) =>
  value === undefined || value === null || value === ""
    ? undefined
    : Number.isInteger(Number(value)) &&
        Number(value) >= 0 &&
        Number(value) <= max
      ? Number(value)
      : undefined;
const strings = (value: unknown, maxItems: number, maxLength: number) =>
  Array.isArray(value)
    ? [
        ...new Set(value.map((item) => clean(item, maxLength)).filter(Boolean)),
      ].slice(0, maxItems)
    : [];
const date = (value: unknown) => {
  const result = clean(value, 10);
  return /^\d{4}-\d{2}(?:-\d{2})?$/.test(result) ? result : undefined;
};
function parse(value: unknown): HighSchoolActivitiesMutation {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SecurityError(
      "Invalid activities request.",
      400,
      "invalid_request",
    );
  const body = value as Record<string, unknown>;
  const expectedVersion = integer(
    body.expectedVersion,
    Number.MAX_SAFE_INTEGER,
  );
  if (expectedVersion === undefined)
    throw new SecurityError(
      "Your activity workspace is out of date.",
      400,
      "invalid_version",
    );
  if (body.action === "save_experience") {
    const title = clean(body.title, 180);
    const category = clean(body.category, 100);
    const key = clean(body.idempotencyKey, 128);
    const experienceId = id(body.experienceId) || undefined;
    if (!title || !category || (!experienceId && (!key || !safeId.test(key))))
      throw new SecurityError(
        "Add an activity name and category.",
        400,
        "invalid_experience",
      );
    const rawFacts = Array.isArray(body.facts) ? body.facts : [];
    const facts = rawFacts.slice(0, 80).flatMap((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
      const fact = raw as Record<string, unknown>;
      const text = clean(fact.text, 300);
      if (!text || !resumeFactKinds.includes(fact.kind as never)) return [];
      const source = [
        "user",
        "import",
        "accomplishment",
        "profile",
        "journey",
      ].includes(String(fact.source))
        ? (fact.source as ResumeFactSource)
        : undefined;
      return [
        {
          id: id(fact.id) || undefined,
          kind: fact.kind as (typeof resumeFactKinds)[number],
          text,
          confirmed: fact.confirmed === true,
          source,
        },
      ];
    });
    const rawHighSchool =
      body.highSchool &&
      typeof body.highSchool === "object" &&
      !Array.isArray(body.highSchool)
        ? (body.highSchool as Record<string, unknown>)
        : {};
    const rawRoles = Array.isArray(rawHighSchool.roleHistory)
      ? rawHighSchool.roleHistory
      : [];
    const roleHistory = rawRoles
      .slice(0, 20)
      .flatMap((raw): HighSchoolRolePeriod[] => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
        const role = raw as Record<string, unknown>;
        const roleTitle = clean(role.title, 100);
        if (!roleTitle) return [];
        return [
          {
            id: id(role.id),
            title: roleTitle,
            grades: strings(role.grades, 4, 20),
            startDate: date(role.startDate),
            endDate: date(role.endDate),
            createdAt: clean(role.createdAt, 30),
          },
        ];
      });
    return {
      action: "save_experience",
      expectedVersion,
      idempotencyKey: key,
      experienceId,
      expectedRecordVersion: experienceId
        ? integer(body.expectedRecordVersion, Number.MAX_SAFE_INTEGER)
        : undefined,
      title,
      organization: clean(body.organization, 180) || undefined,
      role: clean(body.role, 100) || undefined,
      category,
      location: clean(body.location, 160) || undefined,
      startDate: date(body.startDate),
      endDate: date(body.endDate),
      current: body.current === true,
      skills: strings(body.skills, 40, 80),
      facts,
      highSchool: {
        category,
        grades: strings(rawHighSchool.grades, 4, 20),
        participationTiming: strings(rawHighSchool.participationTiming, 8, 40),
        hoursPerWeek: integer(rawHighSchool.hoursPerWeek, 168),
        weeksPerYear: integer(rawHighSchool.weeksPerYear, 53),
        privateNotes: clean(rawHighSchool.privateNotes, 4_000) || undefined,
        collaborators: clean(rawHighSchool.collaborators, 500) || undefined,
        links: strings(rawHighSchool.links, 12, 500).filter((item) =>
          /^https:\/\//i.test(item),
        ),
        roleHistory,
      },
    };
  }
  if (body.action === "toggle_application_activity") {
    const experienceId = id(body.experienceId);
    if (!experienceId)
      throw new SecurityError(
        "Choose an experience.",
        400,
        "invalid_experience",
      );
    return {
      action: body.action,
      expectedVersion,
      experienceId,
      selected: body.selected === true,
    };
  }
  if (body.action === "set_fact_confirmation") {
    const experienceId = id(body.experienceId);
    const factId = id(body.factId);
    if (!experienceId || !factId)
      throw new SecurityError("Choose a fact to review.", 400, "invalid_fact");
    return {
      action: body.action,
      expectedVersion,
      experienceId,
      factId,
      confirmed: body.confirmed === true,
    };
  }
  if (body.action === "reorder_application_activities")
    return {
      action: body.action,
      expectedVersion,
      experienceIds: strings(body.experienceIds, 10, 160).filter((item) =>
        safeId.test(item),
      ),
    };
  if (body.action === "save_application_activity") {
    const experienceId = id(body.experienceId);
    if (!experienceId)
      throw new SecurityError(
        "Choose an experience.",
        400,
        "invalid_experience",
      );
    return {
      action: body.action,
      expectedVersion,
      experienceId,
      activityType: clean(body.activityType, 80),
      position: clean(body.position, 50),
      organization: clean(body.organization, 100),
      description: clean(body.description, 150),
      grades: strings(body.grades, 4, 20),
      participationTiming: strings(body.participationTiming, 8, 40),
      hoursPerWeek: integer(body.hoursPerWeek, 168),
      weeksPerYear: integer(body.weeksPerYear, 53),
      continueInCollege:
        typeof body.continueInCollege === "boolean"
          ? body.continueInCollege
          : undefined,
    };
  }
  if (
    body.action === "set_application_activities_status" &&
    (body.status === "draft" || body.status === "ready")
  )
    return { action: body.action, expectedVersion, status: body.status };
  throw new SecurityError("Invalid activities update.", 400, "invalid_request");
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession(
      (await cookies()).get(sessionCookieName)?.value,
    );
    if (!session)
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    if (session.data.educationalStage !== "high_school")
      return NextResponse.json(
        {
          error: "High School Activities is available in High School UnlockED.",
        },
        { status: 403 },
      );
    await enforceRateLimit(
      request,
      "high-school-activities",
      100,
      60,
      session.user.id,
    );
    const result = await updateHighSchoolActivities(
      session.user.id,
      parse(await readBoundedJson(request, 64 * 1024)),
    );
    return NextResponse.json(
      { ok: true, store: result.store },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      ["ResumeLabConflictError", "ResumeLabRecordConflictError"].includes(
        error.name,
      )
    )
      return NextResponse.json({ error: error.message }, { status: 409 });
    return securityErrorResponse(
      error,
      error instanceof Error
        ? error.message
        : "Activities could not be updated.",
    );
  }
}
