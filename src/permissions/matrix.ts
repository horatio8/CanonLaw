/**
 * Role-permission matrix per spec §12.
 *
 * Every screen exposes only legally-possible actions. A user in CanonicalRole X
 * acting on a case in State Y sees precisely the actions defined here.
 *
 * The matrix is keyed by (state, role) and yields a set of Action identifiers.
 * Actions that correspond to document generation link to `documents/templates.ts`.
 */

import type { CanonicalRole, AnyState } from "../types/canonical.ts";

export type Action =
  | "ViewCase"
  | "CreateIntake"
  | "ReviewCompetence"
  | "IssueAdmission"
  | "IssueRejection"
  | "FilePreAdmissionVotum"
  | "AuthenticateAct"
  | "GenerateCitation"
  | "AssignService"
  | "RecordService"
  | "ReceiveLibellus"
  | "FileResponse"
  | "TrackService"
  | "ReviewResponses"
  | "IssueAbsenceDecree"
  | "SetFormula"
  | "RouteProcess"
  | "AdviseOnFormula"
  | "ProposeFormulaTerms"
  | "AssignJudgesDbiNotary"
  | "IssueDecrees"
  | "DirectInstruction"
  | "PrepareQuestions"
  | "ViewActs"
  | "ProposeProofs"
  | "ReviewExperts"
  | "ConductExaminations"
  | "FileDocuments"
  | "ProposeWitnesses"
  | "SupplementProofs"
  | "IssuePublicationDecree"
  | "NoteWithheldActs"
  | "LogInspections"
  | "InspectActs"
  | "IssueConclusionDecree"
  | "FileObservations"
  | "FileBriefs"
  | "FileReplies"
  | "ConveneDeliberation"
  | "GuideDiscussion"
  | "PresentFirst"
  | "SubmitConclusions"
  | "Vote"
  | "RecordDeliberation"
  | "ApproveSentence"
  | "DraftSentence"
  | "SignSentence"
  | "PromulgateSentence"
  | "BeginAppealReview"
  | "NotifyPublication"
  | "ReceiveForParty"
  | "MonitorDeadlines"
  | "FileAppealOrNonAppeal"
  | "FileAppealForParty"
  | "PrepareAppealPacket"
  | "ConfirmExecutive"
  | "IssueExecutiveNotice"
  | "GenerateNotice"
  | "NotifyParish"
  | "ArchiveCase";

type StateKey =
  | "Intake"
  | "PreAdmissionReview"
  | "Admitted"
  | "Rejected"
  | "CitationAndResponse"
  | "FormulaOfDoubt"
  | "TribunalConstitution"
  | "Instruction"
  | "PublicationOfActs"
  | "ConclusionAndDiscussion"
  | "Deliberation"
  | "SentenceDrafting"
  | "SentencePublication"
  | "AppealWindow"
  | "Executive";

type Matrix = Record<StateKey, Partial<Record<CanonicalRole, Action[]>>>;

export const PERMISSION_MATRIX: Matrix = {
  Intake: {
    JudicialVicar: ["ViewCase"],
    Notary: ["AuthenticateAct"],
    IntakeOfficer: ["CreateIntake"],
    TribunalAdministrator: ["CreateIntake"],
  },
  PreAdmissionReview: {
    JudicialVicar: ["ReviewCompetence", "IssueAdmission", "IssueRejection"],
    AdjunctJudicialVicar: ["ReviewCompetence", "IssueAdmission", "IssueRejection"],
    DefenderOfBond: ["FilePreAdmissionVotum"],
    Notary: ["AuthenticateAct"],
    TribunalAdministrator: ["ViewCase"],
  },
  Admitted: {
    JudicialVicar: ["GenerateCitation", "AssignService"],
    DefenderOfBond: ["ViewCase", "ReceiveLibellus"],
    Notary: ["AuthenticateAct", "RecordService"],
    TribunalAdministrator: ["ViewCase"],
  },
  Rejected: {
    JudicialVicar: ["ViewCase"],
    Advocate: ["ViewCase"],
    Procurator: ["ViewCase"],
    Notary: ["ViewCase"],
  },
  CitationAndResponse: {
    JudicialVicar: ["ReviewResponses", "IssueAbsenceDecree"],
    DefenderOfBond: ["ViewCase", "AdviseOnFormula"],
    Notary: ["RecordService", "AuthenticateAct"],
    Advocate: ["FileResponse"],
    Procurator: ["FileResponse"],
    TribunalAdministrator: ["TrackService"],
  },
  FormulaOfDoubt: {
    JudicialVicar: ["SetFormula", "RouteProcess"],
    DefenderOfBond: ["AdviseOnFormula"],
    Notary: ["AuthenticateAct"],
    Advocate: ["ProposeFormulaTerms"],
    TribunalAdministrator: ["ViewCase"],
  },
  TribunalConstitution: {
    JudicialVicar: ["AssignJudgesDbiNotary"],
    Notary: ["AuthenticateAct"],
    TribunalAdministrator: ["ViewCase"],
  },
  Instruction: {
    JudicialVicar: ["ViewCase", "SupplementProofs"],
    PresidingJudge: ["IssueDecrees", "DirectInstruction"],
    Ponens: ["DirectInstruction", "PrepareQuestions"],
    AssociateJudge: ["ViewActs"],
    DefenderOfBond: ["ProposeProofs", "ReviewExperts"],
    Notary: ["AuthenticateAct"],
    Auditor: ["ConductExaminations"],
    Advocate: ["FileDocuments", "ProposeWitnesses"],
    Procurator: ["FileDocuments", "ProposeWitnesses"],
    TribunalAdministrator: ["ViewCase"],
  },
  PublicationOfActs: {
    JudicialVicar: ["ViewCase"],
    PresidingJudge: ["IssuePublicationDecree"],
    Ponens: ["ViewCase"],
    AssociateJudge: ["ViewCase"],
    DefenderOfBond: ["NoteWithheldActs"],
    Notary: ["AuthenticateAct", "LogInspections"],
    Advocate: ["InspectActs"],
    Procurator: ["InspectActs"],
    TribunalAdministrator: ["ViewCase"],
  },
  ConclusionAndDiscussion: {
    JudicialVicar: ["ViewCase"],
    PresidingJudge: ["IssueConclusionDecree"],
    Ponens: ["ViewCase"],
    AssociateJudge: ["ViewCase"],
    DefenderOfBond: ["FileObservations"], // MANDATORY
    Notary: ["AuthenticateAct"],
    Advocate: ["FileBriefs", "FileReplies"],
    Procurator: ["FileBriefs", "FileReplies"],
    TribunalAdministrator: ["ViewCase"],
  },
  Deliberation: {
    PresidingJudge: ["ConveneDeliberation", "GuideDiscussion"],
    Ponens: ["PresentFirst", "SubmitConclusions"],
    AssociateJudge: ["SubmitConclusions", "Vote"],
    Notary: ["RecordDeliberation"],
    // DBI, advocates, and admin have NO access to deliberation room.
  },
  SentenceDrafting: {
    PresidingJudge: ["ApproveSentence"],
    Ponens: ["DraftSentence"], // primary
    AssociateJudge: ["ApproveSentence"],
    Notary: ["SignSentence"], // VALIDITY — c. 1437
  },
  SentencePublication: {
    JudicialVicar: ["ViewCase"],
    PresidingJudge: ["PromulgateSentence"],
    Ponens: ["ViewCase"],
    AssociateJudge: ["ViewCase"],
    DefenderOfBond: ["BeginAppealReview"],
    Notary: ["AuthenticateAct", "NotifyPublication"],
    Advocate: ["ReceiveForParty"],
    Procurator: ["ReceiveForParty"],
    TribunalAdministrator: ["ViewCase"],
  },
  AppealWindow: {
    JudicialVicar: ["MonitorDeadlines"],
    PresidingJudge: ["ViewCase"],
    Ponens: ["ViewCase"],
    AssociateJudge: ["ViewCase"],
    DefenderOfBond: ["FileAppealOrNonAppeal"],
    Notary: ["AuthenticateAct", "PrepareAppealPacket"],
    Advocate: ["FileAppealForParty"],
    Procurator: ["FileAppealForParty"],
    TribunalAdministrator: ["ViewCase"],
  },
  Executive: {
    JudicialVicar: ["ConfirmExecutive", "IssueExecutiveNotice"],
    PresidingJudge: ["ViewCase"],
    Ponens: ["ViewCase"],
    AssociateJudge: ["ViewCase"],
    DefenderOfBond: ["ViewCase"],
    Notary: ["GenerateNotice", "NotifyParish"],
    Advocate: ["ViewCase"],
    Procurator: ["ViewCase"],
    TribunalAdministrator: ["ArchiveCase"],
  },
};

/**
 * Determine whether a user holding `role` can perform `action` when the case
 * is in `state`. Callers must also check case-level incompatibility rules
 * (incompatibility/rules.ts).
 */
export function can(
  role: CanonicalRole,
  state: AnyState,
  action: Action,
): boolean {
  // Briefer and Documentary state names outside the ordinary set are permitted
  // to pass through; callers generally query ordinary-mapped states for UI.
  const row = PERMISSION_MATRIX[state as StateKey];
  if (!row) return false;
  const actions = row[role];
  return actions ? actions.includes(action) : false;
}

export function availableActions(role: CanonicalRole, state: AnyState): Action[] {
  const row = PERMISSION_MATRIX[state as StateKey];
  if (!row) return [];
  return row[role] ?? [];
}
