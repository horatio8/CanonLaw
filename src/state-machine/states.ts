/**
 * State-machine definitions for the three canonical process tracks.
 *
 *   ORDINARY      — 14 (+1 rejected side-state) per cc. 1671–1691.
 *   BRIEFER       — 8, per cc. 1683–1687.
 *   DOCUMENTARY   — 6, per cc. 1688–1690.
 *
 * Transitions are declarative. The validator layer (gates.ts) enforces the
 * preconditions listed in the spec §8 before any transition is allowed.
 */

import type {
  BrieferState,
  DocumentaryState,
  OrdinaryState,
  ProcessType,
} from "../types/canonical.ts";

export interface Transition<S extends string> {
  from: S;
  to: S;
  /** Gate identifier — resolved by `validateTransition()` in gates.ts. */
  gate: string;
  /** Human-readable label for UI and audit log. */
  label: string;
}

export const ORDINARY_TRANSITIONS: ReadonlyArray<Transition<OrdinaryState>> = [
  { from: "Intake", to: "PreAdmissionReview", gate: "ORD_1_INTAKE_TO_PRE_ADMISSION", label: "Submit libellus for pre-admission review" },
  { from: "PreAdmissionReview", to: "Admitted", gate: "ORD_2_PRE_ADMISSION_TO_ADMITTED", label: "Issue admission decree" },
  { from: "PreAdmissionReview", to: "Rejected", gate: "ORD_2R_PRE_ADMISSION_TO_REJECTED", label: "Issue rejection decree" },
  { from: "Admitted", to: "CitationAndResponse", gate: "ORD_3_ADMITTED_TO_CITATION", label: "Issue citation to respondent" },
  { from: "CitationAndResponse", to: "FormulaOfDoubt", gate: "ORD_4_CITATION_TO_FORMULA", label: "Set formula of doubt" },
  { from: "FormulaOfDoubt", to: "TribunalConstitution", gate: "ORD_5_FORMULA_TO_CONSTITUTION", label: "Constitute collegial tribunal" },
  { from: "TribunalConstitution", to: "Instruction", gate: "ORD_6_CONSTITUTION_TO_INSTRUCTION", label: "Open instruction" },
  { from: "Instruction", to: "PublicationOfActs", gate: "ORD_7_INSTRUCTION_TO_PUBLICATION", label: "Publish acts (c. 1598)" },
  { from: "PublicationOfActs", to: "ConclusionAndDiscussion", gate: "ORD_8_PUBLICATION_TO_CONCLUSION", label: "Issue decree of conclusion" },
  { from: "ConclusionAndDiscussion", to: "Deliberation", gate: "ORD_9_CONCLUSION_TO_DELIBERATION", label: "Open deliberation" },
  { from: "Deliberation", to: "SentenceDrafting", gate: "ORD_10_DELIBERATION_TO_SENTENCE_DRAFT", label: "Begin sentence drafting" },
  { from: "SentenceDrafting", to: "SentencePublication", gate: "ORD_11_SENTENCE_DRAFT_TO_PUBLICATION", label: "Publish sentence" },
  { from: "SentencePublication", to: "AppealWindow", gate: "ORD_12_SENTENCE_PUB_TO_APPEAL", label: "Open appeal window" },
  { from: "AppealWindow", to: "Executive", gate: "ORD_13_APPEAL_TO_EXECUTIVE", label: "Declare executive (c. 1679)" },
];

export const BRIEFER_TRANSITIONS: ReadonlyArray<Transition<BrieferState>> = [
  { from: "Intake", to: "PreAdmissionReview", gate: "BRF_1_INTAKE_TO_PRE_ADMISSION", label: "Submit libellus for pre-admission review" },
  { from: "PreAdmissionReview", to: "Admitted", gate: "BRF_2_PRE_ADMISSION_TO_ADMITTED", label: "Issue admission decree" },
  { from: "Admitted", to: "CitationAndResponse", gate: "BRF_3_ADMITTED_TO_CITATION", label: "Issue citation to respondent" },
  { from: "CitationAndResponse", to: "FormulaBrieferRouting", gate: "BRF_4_CITATION_TO_FORMULA", label: "Set formula and confirm briefer eligibility (c. 1683)" },
  { from: "FormulaBrieferRouting", to: "InstructorAssessorAppointment", gate: "BRF_5_FORMULA_TO_INSTRUCTOR", label: "Appoint instructor and assessor" },
  { from: "InstructorAssessorAppointment", to: "InstructionalSession", gate: "BRF_6_INSTRUCTOR_TO_SESSION", label: "Hold instructional session (c. 1686)" },
  { from: "InstructionalSession", to: "BishopDecision", gate: "BRF_7_SESSION_TO_BISHOP", label: "Route to Diocesan Bishop personally (c. 1687)" },
  { from: "BishopDecision", to: "AppealWindow", gate: "BRF_8_BISHOP_TO_APPEAL", label: "Bishop issues affirmative sentence" },
  { from: "BishopDecision", to: "Intake", gate: "BRF_8R_BISHOP_REMAND", label: "Bishop remands to ordinary process (c. 1687 §1)" },
  { from: "AppealWindow", to: "Executive", gate: "BRF_9_APPEAL_TO_EXECUTIVE", label: "Declare executive" },
];

export const DOCUMENTARY_TRANSITIONS: ReadonlyArray<Transition<DocumentaryState>> = [
  { from: "Intake", to: "PreliminaryReview", gate: "DOC_1_INTAKE_TO_REVIEW", label: "Submit for preliminary review" },
  { from: "PreliminaryReview", to: "Admitted", gate: "DOC_2_REVIEW_TO_ADMITTED", label: "Admit documentary case" },
  { from: "PreliminaryReview", to: "Intake", gate: "DOC_2R_REVIEW_REMAND", label: "Remand to ordinary process (certainty lacking)" },
  { from: "Admitted", to: "Judgment", gate: "DOC_3_ADMITTED_TO_JUDGMENT", label: "Issue documentary judgment" },
  { from: "Judgment", to: "AppealWindow", gate: "DOC_4_JUDGMENT_TO_APPEAL", label: "Publish judgment; open appeal window" },
  { from: "AppealWindow", to: "Executive", gate: "DOC_5_APPEAL_TO_EXECUTIVE", label: "Declare executive" },
];

export function transitionsFor(process: ProcessType): ReadonlyArray<Transition<string>> {
  switch (process) {
    case "Ordinary":
      return ORDINARY_TRANSITIONS as ReadonlyArray<Transition<string>>;
    case "Briefer":
      return BRIEFER_TRANSITIONS as ReadonlyArray<Transition<string>>;
    case "Documentary":
      return DOCUMENTARY_TRANSITIONS as ReadonlyArray<Transition<string>>;
  }
}

export function allowedNextStates(
  process: ProcessType,
  current: string,
): Array<{ state: string; gate: string; label: string }> {
  return transitionsFor(process)
    .filter((t) => t.from === current)
    .map((t) => ({ state: t.to, gate: t.gate, label: t.label }));
}
