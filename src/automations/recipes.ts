/**
 * Automation recipes per spec §13.
 *
 * These functions are designed to be invoked by an outer scheduler (Airtable
 * Automation, a cron worker, or an integration runtime). Each returns the
 * side-effect description(s) rather than executing them directly, so the
 * engine is testable and the execution layer is swappable.
 */

import type { Case, Deadline, ISODate } from "../types/canonical.ts";
import { createDeadline, type ComputedDeadline } from "../deadlines/catalog.ts";
import { daysBetween } from "../deadlines/time.ts";

export type SideEffect =
  | { kind: "CreateDeadline"; caseId: string; deadline: ComputedDeadline }
  | { kind: "AlertNotary"; caseId: string; actId: string; message: string }
  | { kind: "FlagBenchmark"; caseId: string; severity: "Advisory"; message: string }
  | { kind: "AlertDeadline"; caseId: string; deadlineType: Deadline["deadlineType"]; severity: Deadline["severity"]; message: string }
  | { kind: "TransitionStatus"; caseId: string; newState: string }
  | { kind: "CreateTask"; caseId: string; taskType: string; assigneeRole: string; deadline?: ISODate };

export interface RecipeContext {
  today: ISODate;
  closedDays?: Set<ISODate>;
  unavailableDays?: Set<ISODate>;
}

/** Case Status → "Admitted": auto-create respondent-response deadline. */
export function onAdmitted(c: Case, ctx: RecipeContext): SideEffect[] {
  if (!c.dateAdmitted) return [];
  const deadline = createDeadline({
    type: "RespondentInitialResponse",
    startDate: c.dateAdmitted,
    ...(ctx.closedDays ? { closedDays: ctx.closedDays } : {}),
    ...(ctx.unavailableDays ? { unavailableDays: ctx.unavailableDays } : {}),
  });
  return [{ kind: "CreateDeadline", caseId: c.id, deadline }];
}

/** Case Status → "FormulaOfDoubt": auto-create formula-recourse deadline. */
export function onFormulaOfDoubt(c: Case, ctx: RecipeContext): SideEffect[] {
  if (!c.dateOfFormula) return [];
  const deadline = createDeadline({
    type: "FormulaRecourse",
    startDate: c.dateOfFormula,
    ...(ctx.closedDays ? { closedDays: ctx.closedDays } : {}),
    ...(ctx.unavailableDays ? { unavailableDays: ctx.unavailableDays } : {}),
  });
  return [{ kind: "CreateDeadline", caseId: c.id, deadline }];
}

/** Briefer: Instructor Appointed → session within 30 days. */
export function onBrieferInstructorAppointed(c: Case, startDate: ISODate, ctx: RecipeContext): SideEffect[] {
  const deadline = createDeadline({
    type: "BrieferProcessSession",
    startDate,
    ...(ctx.closedDays ? { closedDays: ctx.closedDays } : {}),
  });
  return [{ kind: "CreateDeadline", caseId: c.id, deadline }];
}

/** Sentence published → appeal petition + prosecution deadlines. */
export function onSentencePublished(c: Case, ctx: RecipeContext): SideEffect[] {
  if (!c.dateSentencePublished) return [];
  const petition = createDeadline({
    type: "AppealPetition",
    startDate: c.dateSentencePublished,
    ...(ctx.closedDays ? { closedDays: ctx.closedDays } : {}),
    ...(ctx.unavailableDays ? { unavailableDays: ctx.unavailableDays } : {}),
  });
  // Prosecution deadline is only armed once a petition is actually filed —
  // but we pre-register the rule so the scheduler can tick it.
  return [
    { kind: "CreateDeadline", caseId: c.id, deadline: petition },
    {
      kind: "CreateTask",
      caseId: c.id,
      taskType: "DBIAppealOrNonAppealStatement",
      assigneeRole: "DefenderOfBond",
      deadline: petition.dueDate,
    },
  ];
}

/**
 * Act created without Is Authenticated = true → alert notary.
 * Called per-act-insertion by the app layer.
 */
export function onActCreatedUnauthenticated(
  caseId: string,
  actId: string,
  actTypeLabel: string,
): SideEffect[] {
  return [
    {
      kind: "AlertNotary",
      caseId,
      actId,
      message: `Act "${actTypeLabel}" lacks notary authentication — VALIDITY risk per c. 1437.`,
    },
  ];
}

/**
 * Case Status → "ConclusionAndDiscussion": mandatory DBI Observations task.
 */
export function onConclusionAndDiscussion(c: Case, discussionDeadline: ISODate): SideEffect[] {
  return [
    {
      kind: "CreateTask",
      caseId: c.id,
      taskType: "DBIObservations",
      assigneeRole: "DefenderOfBond",
      deadline: discussionDeadline,
    },
  ];
}

/**
 * Daily scan: flag 1-year benchmark, alert on deadlines within 3 days.
 * Returns side effects for ONE case. Scheduler iterates all active cases.
 */
export function dailyScan(
  c: Case,
  deadlines: Deadline[],
  today: ISODate,
): SideEffect[] {
  const effects: SideEffect[] = [];

  if (c.dateAdmitted) {
    const elapsed = daysBetween(c.dateAdmitted, today);
    if (elapsed >= 365 - 30 && !c.oneYearBenchmarkFlag) {
      effects.push({
        kind: "FlagBenchmark",
        caseId: c.id,
        severity: "Advisory",
        message: "First-instance benchmark (c. 1453): within 30 days of 1-year mark.",
      });
    }
  }

  for (const d of deadlines) {
    if (d.status !== "Active") continue;
    const until = daysBetween(today, d.dueDate);
    if (until < 0) {
      effects.push({
        kind: "AlertDeadline",
        caseId: c.id,
        deadlineType: d.deadlineType,
        severity: d.severity,
        message: `Deadline ${d.deadlineType} has EXPIRED (was due ${d.dueDate}).`,
      });
    } else if (until <= 3) {
      effects.push({
        kind: "AlertDeadline",
        caseId: c.id,
        deadlineType: d.deadlineType,
        severity: d.severity,
        message: `Deadline ${d.deadlineType} due in ${until} day(s) (${d.dueDate}).`,
      });
    }
  }

  return effects;
}

/**
 * All appeal deadlines expire with no appeal → auto-transition to Executive.
 * Caller supplies (petition expired, prosecution not applicable or expired,
 * no appeal/complaint act exists, DBI has filed non-appeal statement).
 */
export function onAppealWindowExhausted(
  c: Case,
  conditions: {
    petitionExpired: boolean;
    noAppealFiled: boolean;
    dbiNonAppealStatementFiled: boolean;
    noNullityComplaintFiled: boolean;
  },
): SideEffect[] {
  if (
    conditions.petitionExpired &&
    conditions.noAppealFiled &&
    conditions.dbiNonAppealStatementFiled &&
    conditions.noNullityComplaintFiled
  ) {
    return [{ kind: "TransitionStatus", caseId: c.id, newState: "Executive" }];
  }
  return [];
}
