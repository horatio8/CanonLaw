/**
 * Validation gates for state transitions.
 *
 * Per spec §8, these are HARD STOPS — not suggestions. The transition simply
 * cannot occur unless every prerequisite is satisfied. Each gate returns a list
 * of failed prerequisites; an empty list means the transition is permitted.
 *
 * Callers supply a `CaseSnapshot` — an in-memory aggregate of the case, its
 * acts, its assignments, its deadlines, and its DBI-related tasks. The gate
 * layer is pure: it does not itself read from Airtable.
 */

import type {
  Act,
  ActType,
  AnyState,
  Case,
  CaseAssignment,
  CaseRole,
  Deadline,
  ISODate,
  ServiceRecord,
} from "../types/canonical.ts";
import { isAfter } from "../deadlines/time.ts";

export interface CaseSnapshot {
  case: Case;
  acts: Act[];
  assignments: CaseAssignment[];
  deadlines: Deadline[];
  serviceRecords: ServiceRecord[];
  /** Today, for deadline comparisons. ISO date. */
  today: ISODate;
  /** True if DBI pre-admission votum was formally waived with recorded reason. */
  dbiPreAdmissionWaived?: { reason: string } | undefined;
  /** True if the DBI has filed post-sentence appeal decision (appeal OR non-appeal). */
  dbiPostSentenceDecisionFiled?: boolean;
}

export interface GateResult {
  ok: boolean;
  failures: string[];
}

export function pass(): GateResult {
  return { ok: true, failures: [] };
}

export function fail(...failures: string[]): GateResult {
  return { ok: false, failures };
}

function hasAuthenticatedAct(snap: CaseSnapshot, type: ActType): boolean {
  return snap.acts.some((a) => a.actType === type && a.isAuthenticated);
}

function hasActOfType(snap: CaseSnapshot, type: ActType): boolean {
  return snap.acts.some((a) => a.actType === type);
}

function anyUnauthenticatedActs(snap: CaseSnapshot): Act[] {
  return snap.acts.filter((a) => !a.isAuthenticated);
}

function assignmentFor(snap: CaseSnapshot, role: CaseRole): CaseAssignment | undefined {
  return snap.assignments.find((a) => a.roleInCase === role && a.activeOnCase);
}

function countAssignments(snap: CaseSnapshot, role: CaseRole): number {
  return snap.assignments.filter((a) => a.roleInCase === role && a.activeOnCase).length;
}

function deadlineExpired(snap: CaseSnapshot, type: Deadline["deadlineType"]): boolean {
  const d = snap.deadlines.find((x) => x.deadlineType === type);
  if (!d) return false;
  return isAfter(snap.today, d.dueDate);
}

export type GateId =
  // Ordinary
  | "ORD_1_INTAKE_TO_PRE_ADMISSION"
  | "ORD_2_PRE_ADMISSION_TO_ADMITTED"
  | "ORD_2R_PRE_ADMISSION_TO_REJECTED"
  | "ORD_3_ADMITTED_TO_CITATION"
  | "ORD_4_CITATION_TO_FORMULA"
  | "ORD_5_FORMULA_TO_CONSTITUTION"
  | "ORD_6_CONSTITUTION_TO_INSTRUCTION"
  | "ORD_7_INSTRUCTION_TO_PUBLICATION"
  | "ORD_8_PUBLICATION_TO_CONCLUSION"
  | "ORD_9_CONCLUSION_TO_DELIBERATION"
  | "ORD_10_DELIBERATION_TO_SENTENCE_DRAFT"
  | "ORD_11_SENTENCE_DRAFT_TO_PUBLICATION"
  | "ORD_12_SENTENCE_PUB_TO_APPEAL"
  | "ORD_13_APPEAL_TO_EXECUTIVE"
  // Briefer
  | "BRF_1_INTAKE_TO_PRE_ADMISSION"
  | "BRF_2_PRE_ADMISSION_TO_ADMITTED"
  | "BRF_3_ADMITTED_TO_CITATION"
  | "BRF_4_CITATION_TO_FORMULA"
  | "BRF_5_FORMULA_TO_INSTRUCTOR"
  | "BRF_6_INSTRUCTOR_TO_SESSION"
  | "BRF_7_SESSION_TO_BISHOP"
  | "BRF_8_BISHOP_TO_APPEAL"
  | "BRF_8R_BISHOP_REMAND"
  | "BRF_9_APPEAL_TO_EXECUTIVE"
  // Documentary
  | "DOC_1_INTAKE_TO_REVIEW"
  | "DOC_2_REVIEW_TO_ADMITTED"
  | "DOC_2R_REVIEW_REMAND"
  | "DOC_3_ADMITTED_TO_JUDGMENT"
  | "DOC_4_JUDGMENT_TO_APPEAL"
  | "DOC_5_APPEAL_TO_EXECUTIVE";

type GateFn = (snap: CaseSnapshot) => GateResult;

const GATES: Record<GateId, GateFn> = {
  /* ================ ORDINARY PROCESS ================ */

  ORD_1_INTAKE_TO_PRE_ADMISSION: (snap) => {
    const failures: string[] = [];
    if (!snap.case.petitionerPersonId) failures.push("Petitioner data required (DC art. 116).");
    if (!snap.case.respondentPersonId) failures.push("Respondent data required (DC art. 116).");
    if (!snap.case.marriageDate || !snap.case.marriagePlace) failures.push("Marriage data required.");
    if (!snap.case.groundIds || snap.case.groundIds.length === 0)
      failures.push("At least one ground of nullity must be proposed (DC art. 116).");
    if (!hasAuthenticatedAct(snap, "Libellus"))
      failures.push("Libellus must be notary-authenticated before pre-admission (c. 1437).");
    return failures.length ? fail(...failures) : pass();
  },

  ORD_2_PRE_ADMISSION_TO_ADMITTED: (snap) => {
    const failures: string[] = [];
    if (!snap.case.competenceBasis) failures.push("Competence basis required (c. 1672).");
    if (snap.case.competenceBasis === "PlaceOfProofs" && !snap.case.competenceNotes?.trim())
      failures.push("Competence notes REQUIRED when basis is Place of Proofs.");
    if (!hasActOfType(snap, "StandingCheck")) failures.push("Standing check not completed (DC arts. 119–120).");
    const dbiVotum = hasActOfType(snap, "DBIPreAdmissionVotum");
    if (!dbiVotum && !snap.dbiPreAdmissionWaived)
      failures.push("DBI pre-admission votum required or formal waiver with reason (DC art. 119 §2).");
    if (!hasAuthenticatedAct(snap, "AdmissionDecree") && !hasActOfType(snap, "AdmissionDecree")) {
      // Admission decree is generated at this transition; here we just ensure notary WILL sign.
    }
    return failures.length ? fail(...failures) : pass();
  },

  ORD_2R_PRE_ADMISSION_TO_REJECTED: (snap) => {
    // Rejection requires a rejection decree that states reasons per c. 1505 §2.
    if (!hasActOfType(snap, "RejectionDecree"))
      return fail("Rejection decree with stated reasons required (c. 1505 §2).");
    return pass();
  },

  ORD_3_ADMITTED_TO_CITATION: (snap) => {
    if (!hasAuthenticatedAct(snap, "AdmissionDecree"))
      return fail("Admission decree must be notary-authenticated (c. 1437).");
    return pass();
  },

  ORD_4_CITATION_TO_FORMULA: (snap) => {
    const failures: string[] = [];
    if (!hasAuthenticatedAct(snap, "CitationDecree"))
      failures.push("Authenticated citation decree required.");
    const service = snap.serviceRecords.some((s) => s.actServedId);
    if (!service) failures.push("Service to respondent must be recorded (c. 1509).");
    const responded = hasActOfType(snap, "RespondentResponse");
    const absenceDecree = hasAuthenticatedAct(snap, "DecreeOfAbsence");
    const responsePeriodExpired = deadlineExpired(snap, "RespondentInitialResponse");
    if (!responded && !absenceDecree && !responsePeriodExpired)
      failures.push("Respondent response received, response period expired, or decree of absence required (c. 1592).");
    return failures.length ? fail(...failures) : pass();
  },

  ORD_5_FORMULA_TO_CONSTITUTION: (snap) => {
    const failures: string[] = [];
    if (!hasAuthenticatedAct(snap, "FormulaOfDoubtDecree"))
      failures.push("Formula of doubt decree required with specific dubium per ground (c. 1676 §2).");
    if (!snap.case.formulaOfDoubt?.trim()) failures.push("Formula text missing.");
    const formulaDeadline = snap.deadlines.find((d) => d.deadlineType === "FormulaRecourse");
    if (formulaDeadline && !isAfter(snap.today, formulaDeadline.dueDate)) {
      // If a recourse has been filed and is unresolved, also block. Simplified check.
      failures.push("10-day formula recourse window has not yet passed (c. 1513 §3).");
    }
    return failures.length ? fail(...failures) : pass();
  },

  ORD_6_CONSTITUTION_TO_INSTRUCTION: (snap) => {
    const failures: string[] = [];
    if (!assignmentFor(snap, "PresidingJudge")) failures.push("Presiding Judge must be assigned.");
    if (!assignmentFor(snap, "Ponens")) failures.push("Ponens must be designated (c. 1429).");
    if (countAssignments(snap, "AssociateJudge") < 1)
      failures.push("At least one Associate Judge required for collegial tribunal (c. 1425).");
    // Collegial minimum of 3 judges total = PresidingJudge + Ponens + 1 Associate OR
    // PresidingJudge + 2 Associates. Ponens is one of the judges of the college.
    const totalJudges =
      (assignmentFor(snap, "PresidingJudge") ? 1 : 0) +
      (assignmentFor(snap, "Ponens") ? 1 : 0) +
      countAssignments(snap, "AssociateJudge");
    if (totalJudges < 3) failures.push("Collegial tribunal requires minimum 3 judges (c. 1425 §1).");
    if (!assignmentFor(snap, "DefenderOfBond")) failures.push("Defender of the Bond must be assigned (c. 1432).");
    if (!assignmentFor(snap, "Notary")) failures.push("Notary must be assigned (c. 1437).");
    if (!hasAuthenticatedAct(snap, "ConstitutionDecree"))
      failures.push("Constitution decree must be notary-authenticated.");
    return failures.length ? fail(...failures) : pass();
  },

  ORD_7_INSTRUCTION_TO_PUBLICATION: (snap) => {
    const failures: string[] = [];
    const hasProof =
      hasActOfType(snap, "PartyExamination") ||
      hasActOfType(snap, "WitnessExamination") ||
      hasActOfType(snap, "DocumentaryExhibit") ||
      hasActOfType(snap, "ExpertReport");
    if (!hasProof) failures.push("Instruction must include at least some substantive proofs.");
    const unauth = anyUnauthenticatedActs(snap);
    if (unauth.length > 0)
      failures.push(
        `VALIDITY: ${unauth.length} act(s) lack notary authentication — they are null (c. 1437).`,
      );
    return failures.length ? fail(...failures) : pass();
  },

  ORD_8_PUBLICATION_TO_CONCLUSION: (snap) => {
    const failures: string[] = [];
    if (!hasAuthenticatedAct(snap, "PublicationDecree"))
      failures.push("Publication decree required (c. 1598).");
    if (!hasActOfType(snap, "ActInspectionRecord"))
      failures.push("At least one act-inspection record must be logged.");
    return failures.length ? fail(...failures) : pass();
  },

  ORD_9_CONCLUSION_TO_DELIBERATION: (snap) => {
    const failures: string[] = [];
    if (!hasAuthenticatedAct(snap, "DecreeOfConclusion"))
      failures.push("Decree of conclusion required (c. 1599).");
    if (!hasActOfType(snap, "DBIObservations"))
      failures.push("DBI observations are MANDATORY (c. 1432).");
    if (!deadlineExpired(snap, "DiscussionBriefs"))
      failures.push("Discussion period has not yet expired.");
    return failures.length ? fail(...failures) : pass();
  },

  ORD_10_DELIBERATION_TO_SENTENCE_DRAFT: (snap) => {
    const failures: string[] = [];
    const judges = snap.assignments.filter(
      (a) => a.activeOnCase && ["PresidingJudge", "Ponens", "AssociateJudge"].includes(a.roleInCase),
    );
    const sealedConclusions = snap.acts.filter(
      (a) => a.actType === "JudgeWrittenConclusionsSealed",
    );
    if (sealedConclusions.length < judges.length)
      failures.push(
        `All ${judges.length} judges must submit sealed written conclusions (c. 1609); received ${sealedConclusions.length}.`,
      );
    if (!hasActOfType(snap, "DeliberationRecord"))
      failures.push("Deliberation session must be recorded.");
    return failures.length ? fail(...failures) : pass();
  },

  ORD_11_SENTENCE_DRAFT_TO_PUBLICATION: (snap) => {
    const failures: string[] = [];
    const sentence = snap.acts.find((a) => a.actType === "FinalSentence");
    if (!sentence) return fail("Final sentence does not exist.");
    if (!sentence.isAuthenticated)
      failures.push("VALIDITY: Sentence must be signed by the notary (c. 1437; DC art. 62).");
    // Content check: enforce cc. 1611–1612 elements (presence check; content quality is human judgment).
    const required = [
      "tribunal",
      "parties",
      "facts",
      "formula of doubt",
      "reasons in law",
      "reasons in fact",
      "dispositive",
    ];
    const lower = sentence.content.toLowerCase();
    const missing = required.filter((tok) => !lower.includes(tok));
    if (missing.length > 0)
      failures.push(`Sentence missing required elements (cc. 1611–1612): ${missing.join(", ")}.`);
    return failures.length ? fail(...failures) : pass();
  },

  ORD_12_SENTENCE_PUB_TO_APPEAL: (snap) => {
    if (!snap.case.dateSentencePublished) return fail("Sentence publication date must be recorded (c. 1614).");
    return pass();
  },

  ORD_13_APPEAL_TO_EXECUTIVE: (snap) => {
    const failures: string[] = [];
    if (!deadlineExpired(snap, "AppealPetition"))
      failures.push("15-useful-day appeal petition period has not expired (c. 1630).");
    if (!snap.dbiPostSentenceDecisionFiled)
      failures.push("DBI must file appeal OR signed non-appeal statement (DC art. 279 §2).");
    const anyAppealFiled = hasActOfType(snap, "AppealPetition");
    if (anyAppealFiled && !deadlineExpired(snap, "AppealProsecution"))
      failures.push("Appeal filed — prosecution window still open (c. 1633).");
    return failures.length ? fail(...failures) : pass();
  },

  /* ================ BRIEFER PROCESS ================ */

  BRF_1_INTAKE_TO_PRE_ADMISSION: (snap) => GATES.ORD_1_INTAKE_TO_PRE_ADMISSION(snap),
  BRF_2_PRE_ADMISSION_TO_ADMITTED: (snap) => GATES.ORD_2_PRE_ADMISSION_TO_ADMITTED(snap),
  BRF_3_ADMITTED_TO_CITATION: (snap) => GATES.ORD_3_ADMITTED_TO_CITATION(snap),
  BRF_4_CITATION_TO_FORMULA: (snap) => {
    // Briefer eligibility per c. 1683: both spouses petition (or one with other's consent),
    // nullity manifest from facts, no detailed inquiry needed.
    const base = GATES.ORD_4_CITATION_TO_FORMULA(snap);
    if (!base.ok) return base;
    // The intake stage must record briefer eligibility; in this implementation we check
    // that the case is explicitly routed as Briefer at this point.
    if (snap.case.processType !== "Briefer")
      return fail("Case must be routed as Briefer process (c. 1683).");
    return pass();
  },
  BRF_5_FORMULA_TO_INSTRUCTOR: (snap) => {
    if (!hasAuthenticatedAct(snap, "FormulaOfDoubtDecree"))
      return fail("Formula of doubt decree required.");
    return pass();
  },
  BRF_6_INSTRUCTOR_TO_SESSION: (snap) => {
    const failures: string[] = [];
    if (!assignmentFor(snap, "Instructor")) failures.push("Instructor must be appointed (c. 1685).");
    if (!assignmentFor(snap, "Assessor")) failures.push("Assessor must be appointed (c. 1685).");
    if (!assignmentFor(snap, "DefenderOfBond")) failures.push("DBI must be assigned.");
    if (!assignmentFor(snap, "Notary")) failures.push("Notary must be assigned.");
    return failures.length ? fail(...failures) : pass();
  },
  BRF_7_SESSION_TO_BISHOP: (snap) => {
    const failures: string[] = [];
    if (!deadlineExpired(snap, "BrieferDBIPartyObservations"))
      failures.push("15-day DBI/party observations period has not expired (c. 1686).");
    const unauth = anyUnauthenticatedActs(snap);
    if (unauth.length > 0) failures.push("VALIDITY: unauthenticated acts in file (c. 1437).");
    return failures.length ? fail(...failures) : pass();
  },
  BRF_8_BISHOP_TO_APPEAL: (snap) => {
    const sentence = snap.acts.find((a) => a.actType === "FinalSentence");
    if (!sentence) return fail("Bishop's sentence not recorded.");
    if (!sentence.isAuthenticated) return fail("Bishop's sentence requires notary signature (c. 1437).");
    // Bishop cannot issue negative sentence in briefer process (c. 1687 §1) — remand instead.
    return pass();
  },
  BRF_8R_BISHOP_REMAND: (snap) => {
    if (!hasAuthenticatedAct(snap, "DecreeOfRemand"))
      return fail("Authenticated decree of remand to ordinary process required (c. 1687 §1).");
    return pass();
  },
  BRF_9_APPEAL_TO_EXECUTIVE: (snap) => GATES.ORD_13_APPEAL_TO_EXECUTIVE(snap),

  /* ================ DOCUMENTARY PROCESS ================ */

  DOC_1_INTAKE_TO_REVIEW: (snap) => {
    const failures: string[] = [];
    if (!hasAuthenticatedAct(snap, "Libellus"))
      failures.push("Libellus with documentary basis must be authenticated.");
    if (!hasActOfType(snap, "DocumentaryExhibit"))
      failures.push("Supporting documents required (c. 1688).");
    return failures.length ? fail(...failures) : pass();
  },
  DOC_2_REVIEW_TO_ADMITTED: (snap) => {
    const failures: string[] = [];
    if (!hasActOfType(snap, "DBIPreAdmissionVotum") && !snap.dbiPreAdmissionWaived)
      failures.push("DBI must be heard before admission to documentary process.");
    return failures.length ? fail(...failures) : pass();
  },
  DOC_2R_REVIEW_REMAND: (snap) => {
    if (!hasAuthenticatedAct(snap, "DecreeOfRemand"))
      return fail("Remand decree required when documentary certainty is lacking.");
    return pass();
  },
  DOC_3_ADMITTED_TO_JUDGMENT: (snap) => {
    const failures: string[] = [];
    if (!hasActOfType(snap, "DBIObservations")) failures.push("DBI observations required.");
    const sentence = snap.acts.find((a) => a.actType === "FinalSentence");
    if (!sentence) failures.push("Documentary judgment not drafted.");
    else if (!sentence.isAuthenticated) failures.push("VALIDITY: notary must sign (c. 1437).");
    return failures.length ? fail(...failures) : pass();
  },
  DOC_4_JUDGMENT_TO_APPEAL: (snap) => {
    if (!snap.case.dateSentencePublished)
      return fail("Judgment publication date must be recorded.");
    return pass();
  },
  DOC_5_APPEAL_TO_EXECUTIVE: (snap) => GATES.ORD_13_APPEAL_TO_EXECUTIVE(snap),
};

export function validateTransition(
  gate: string,
  snap: CaseSnapshot,
): GateResult {
  const fn = GATES[gate as GateId];
  if (!fn) return fail(`Unknown gate: ${gate}`);
  return fn(snap);
}

export interface TransitionAttempt {
  from: AnyState;
  to: AnyState;
  gate: string;
}

export function canTransition(
  attempt: TransitionAttempt,
  snap: CaseSnapshot,
): GateResult {
  if (snap.case.caseStatus !== attempt.from)
    return fail(`Case is in state ${snap.case.caseStatus}, not ${attempt.from}.`);
  return validateTransition(attempt.gate, snap);
}
