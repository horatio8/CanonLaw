/**
 * Catalog of canonical deadlines.
 *
 * Every deadline the system tracks is defined here with its canon, duration,
 * computation mode, severity, and trigger. The state-machine layer calls
 * `createDeadline(...)` when a triggering event occurs.
 */

import type {
  DeadlineComputation,
  DeadlineSeverity,
  DeadlineType,
  ISODate,
} from "../types/canonical.ts";
import { computeDueDate, extendToFirstOpenDay } from "./time.ts";

export interface DeadlineDefinition {
  type: DeadlineType;
  days: number;
  computation: DeadlineComputation;
  severity: DeadlineSeverity;
  canon: string;
  description: string;
  /** Whether tribunal-closed-day extension applies (judicial act filed AT tribunal). */
  extendToOpenDay: boolean;
}

export const DEADLINE_CATALOG: Record<DeadlineType, DeadlineDefinition> = {
  RespondentInitialResponse: {
    type: "RespondentInitialResponse",
    days: 15,
    computation: "Continuous",
    severity: "Procedural",
    canon: "c. 1676 §1",
    description: "Respondent response period after communication of libellus.",
    extendToOpenDay: true,
  },
  TacitAdmissionLibellus: {
    type: "TacitAdmissionLibellus",
    days: 30, // 1 canonical month per c. 202 §2
    computation: "Continuous",
    severity: "Procedural",
    canon: "c. 1506; DC art. 125",
    description: "If JV silent for 1 month after filing, libellus is tacitly admitted.",
    extendToOpenDay: false,
  },
  LibellusRejectionRecourse: {
    type: "LibellusRejectionRecourse",
    days: 10,
    computation: "Useful",
    severity: "Procedural",
    canon: "c. 1505 §4",
    description: "Recourse against rejection decree.",
    extendToOpenDay: true,
  },
  FormulaRecourse: {
    type: "FormulaRecourse",
    days: 10,
    computation: "Useful",
    severity: "Procedural",
    canon: "c. 1513 §3",
    description: "Recourse against formula-of-doubt decree.",
    extendToOpenDay: true,
  },
  BrieferProcessSession: {
    type: "BrieferProcessSession",
    days: 30,
    computation: "Continuous",
    severity: "Procedural",
    canon: "c. 1685",
    description: "Citation to instructional session must be within 30 days.",
    extendToOpenDay: false,
  },
  BrieferDBIPartyObservations: {
    type: "BrieferDBIPartyObservations",
    days: 15,
    computation: "Continuous",
    severity: "Procedural",
    canon: "c. 1686",
    description: "DBI and party observations after close of instructional session.",
    extendToOpenDay: true,
  },
  DiscussionBriefs: {
    type: "DiscussionBriefs",
    days: 15, // default; Presiding Judge may set otherwise per c. 1601
    computation: "Continuous",
    severity: "Procedural",
    canon: "c. 1601; DC art. 240",
    description: "Discussion / defense briefs period (judge may modify).",
    extendToOpenDay: true,
  },
  SentenceDrafting: {
    type: "SentenceDrafting",
    days: 30, // 1 canonical month
    computation: "Continuous",
    severity: "Procedural",
    canon: "DC art. 249 §5",
    description: "Ponens drafts sentence within 1 month of deliberation close.",
    extendToOpenDay: false,
  },
  AppealPetition: {
    type: "AppealPetition",
    days: 15,
    computation: "Useful",
    severity: "Validity",
    canon: "c. 1630",
    description: "File appeal petition after publication of sentence.",
    extendToOpenDay: true,
  },
  AppealProsecution: {
    type: "AppealProsecution",
    days: 30,
    computation: "Continuous",
    severity: "Validity",
    canon: "c. 1633",
    description: "Prosecute the appeal after filing petition; failure = abandoned.",
    extendToOpenDay: false,
  },
  FirstInstanceBenchmark: {
    type: "FirstInstanceBenchmark",
    days: 365,
    computation: "Continuous",
    severity: "Advisory",
    canon: "c. 1453",
    description: "Recommended conclusion of first instance within 1 year.",
    extendToOpenDay: false,
  },
  SecondInstanceBenchmark: {
    type: "SecondInstanceBenchmark",
    days: 180, // 6 canonical months
    computation: "Continuous",
    severity: "Advisory",
    canon: "c. 1453",
    description: "Recommended conclusion of second instance within 6 months.",
    extendToOpenDay: false,
  },
};

export interface CreateDeadlineArgs {
  type: DeadlineType;
  startDate: ISODate;
  unavailableDays?: Set<ISODate>;
  closedDays?: Set<ISODate>;
  /** Override default day count (e.g. c. 1601 discussion period set by judge). */
  overrideDays?: number;
}

export interface ComputedDeadline {
  type: DeadlineType;
  canon: string;
  computation: DeadlineComputation;
  severity: DeadlineSeverity;
  startDate: ISODate;
  dueDate: ISODate;
  extendedForClosure: boolean;
  description: string;
}

export function createDeadline(args: CreateDeadlineArgs): ComputedDeadline {
  const def = DEADLINE_CATALOG[args.type];
  const days = args.overrideDays ?? def.days;
  const raw = computeDueDate({
    startDate: args.startDate,
    days,
    computation: def.computation,
    ...(args.unavailableDays !== undefined ? { unavailableDays: args.unavailableDays } : {}),
  });
  const shouldExtend = def.extendToOpenDay && args.closedDays && args.closedDays.size > 0;
  const finalDue = shouldExtend ? extendToFirstOpenDay(raw, args.closedDays!) : raw;
  return {
    type: def.type,
    canon: def.canon,
    computation: def.computation,
    severity: def.severity,
    startDate: args.startDate,
    dueDate: finalDue,
    extendedForClosure: finalDue !== raw,
    description: def.description,
  };
}
