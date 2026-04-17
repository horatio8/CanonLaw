/**
 * Canonical-law domain types.
 *
 * These types model judicial objects (acts, decrees, personnel) with the legal
 * properties that determine their validity under the 1983 Code of Canon Law as
 * amended by Mitis Iudex Dominus Iesus (2015) and supplemented by Dignitas
 * Connubii (2005). Where post-2015 canons conflict with earlier norms, the
 * revised canons control.
 */

export type RecordId = string;
export type ISODate = string; // YYYY-MM-DD

/** c. 1420, 1425–1432, 1437, 1481–1490; DC arts. 38, 43, 46–47, 50, 52, 53–63. */
export type CanonicalRole =
  | "JudicialVicar"
  | "AdjunctJudicialVicar"
  | "PresidingJudge"
  | "Ponens"
  | "AssociateJudge"
  | "DiocesanBishop"
  | "DefenderOfBond"
  | "PromoterOfJustice"
  | "Auditor"
  | "Assessor"
  | "Notary"
  | "Advocate"
  | "Procurator"
  | "TribunalAdministrator"
  | "IntakeOfficer";

/** Role as bound to a specific case (Case Assignments table). */
export type CaseRole =
  | "PresidingJudge"
  | "Ponens"
  | "AssociateJudge"
  | "DefenderOfBond"
  | "PromoterOfJustice"
  | "Notary"
  | "Auditor"
  | "Instructor"
  | "Assessor"
  | "AdvocatePetitioner"
  | "AdvocateRespondent"
  | "ProcuratorPetitioner"
  | "ProcuratorRespondent";

export type ProcessType = "Ordinary" | "Briefer" | "Documentary";

/** Ordinary matrimonial nullity — 14-state machine. */
export type OrdinaryState =
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

/** Briefer process — 8-state machine. c. 1683–1687. */
export type BrieferState =
  | "Intake"
  | "PreAdmissionReview"
  | "Admitted"
  | "CitationAndResponse"
  | "FormulaBrieferRouting"
  | "InstructorAssessorAppointment"
  | "InstructionalSession"
  | "BishopDecision"
  | "AppealWindow"
  | "Executive";

/** Documentary process — 6-state machine. c. 1688. */
export type DocumentaryState =
  | "Intake"
  | "PreliminaryReview"
  | "Admitted"
  | "Judgment"
  | "AppealWindow"
  | "Executive";

export type AnyState = OrdinaryState | BrieferState | DocumentaryState;

/** c. 1672 as revised by Mitis Iudex. */
export type CompetenceBasis =
  | "PlaceOfCelebration"
  | "DomicilePetitioner"
  | "DomicileRespondent"
  | "DomicileBoth"
  | "PlaceOfProofs";

export type GroundCategory =
  | "DefectOfConsent"
  | "Impediment"
  | "DefectOfForm"
  | "DefectOfMandate"
  | "PriorBond"
  | "Condition"
  | "Simulation"
  | "ForceFear"
  | "Error";

export type GroundDisposition = "Affirmative" | "Negative" | "NotReached";
export type AttributedTo = "Petitioner" | "Respondent" | "Both";

export type CanonicalStatus = "Catholic" | "BaptizedNonCatholic" | "Unbaptized";

export interface Person {
  id: RecordId;
  firstName: string;
  lastName: string;
  titlePrefix?: string;
  canonicalStatus?: CanonicalStatus;
  dateOfBirth?: ISODate;
  dateOfBaptism?: ISODate;
  parishOfBaptism?: string;
  dioceseId?: RecordId;
  domicile?: string; // cc. 102–107
  email?: string;
  phone?: string;
  address?: string;
  personTypes: Array<"Petitioner" | "Respondent" | "Witness" | "Expert" | "Guardian">;
}

export interface TribunalPersonnel {
  id: RecordId;
  personId: RecordId;
  tribunalId: RecordId;
  canonicalRole: CanonicalRole;
  appointmentDate?: ISODate;
  appointmentDecreeAttachmentId?: RecordId;
  active: boolean;
  oathTaken: boolean; // c. 1454; DC art. 35
  oathDate?: ISODate;
  qualifications?: string;
}

export interface CaseAssignment {
  id: RecordId;
  caseId: RecordId;
  personnelId: RecordId;
  roleInCase: CaseRole;
  dateAssigned: ISODate;
  dateRemoved?: ISODate;
  assignmentDecreeActId?: RecordId;
  activeOnCase: boolean;
}

export interface Ground {
  id: RecordId;
  canonReference: string; // e.g. "c. 1095, 2°"
  shortName: string;
  category: GroundCategory;
  description: string;
  expertUsuallyRequired: boolean; // true for c. 1095 cases
}

export interface CaseGround {
  id: RecordId;
  caseId: RecordId;
  groundId: RecordId;
  formulaText: string;
  disposition: GroundDisposition;
  attributedTo: AttributedTo;
}

export type ActType =
  | "Libellus"
  | "AdmissionDecree"
  | "RejectionDecree"
  | "CompetenceMemo"
  | "StandingCheck"
  | "DBIPreAdmissionVotum"
  | "CitationDecree"
  | "ServiceRecord"
  | "RespondentResponse"
  | "DecreeOfAbsence"
  | "FormulaOfDoubtDecree"
  | "ConstitutionDecree"
  | "AuditorMandate"
  | "PartyExamination"
  | "WitnessExamination"
  | "DocumentaryExhibit"
  | "ExpertAppointment"
  | "ExpertQuestions"
  | "ExpertReport"
  | "RogatoryLetter"
  | "RogatoryResponse"
  | "PublicationDecree"
  | "ActInspectionRecord"
  | "DecreeOfConclusion"
  | "DBIObservations"
  | "PartyBrief"
  | "ReplyBrief"
  | "JudgeWrittenConclusionsSealed"
  | "DeliberationRecord"
  | "SentenceDraft"
  | "FinalSentence"
  | "SentencePublicationRecord"
  | "AppealPetition"
  | "AppealBrief"
  | "NonAppealStatement"
  | "ExecutiveStatusNotice"
  | "DecreeOfRemand"
  | "IncidentalDecree"
  | "NullityComplaint"
  | "SupplementalProofDecree";

export type ActCategory = "Procedural" | "Merits" | "Administrative";

/**
 * An Act is a first-class canonical object — not merely a file blob.
 *
 * c. 1437 §1 and DC art. 62 §1: acts not signed by the notary are NULL.
 * The isAuthenticated flag is therefore a validity marker, not decorative.
 */
export interface Act {
  id: RecordId;
  caseId: RecordId;
  actType: ActType;
  actCategory: ActCategory;
  title: string;
  content: string;
  attachmentId?: RecordId;
  createdByPersonnelId: RecordId;
  dateCreated: ISODate;
  authenticatedByNotaryPersonnelId?: RecordId;
  dateAuthenticated?: ISODate;
  isAuthenticated: boolean;
  protocolPageNumber?: number;
  insertedInOfficialActs: boolean;
  certifiedCopyGenerated: boolean;
}

export type DeadlineType =
  | "RespondentInitialResponse"
  | "TacitAdmissionLibellus"
  | "LibellusRejectionRecourse"
  | "FormulaRecourse"
  | "BrieferProcessSession"
  | "BrieferDBIPartyObservations"
  | "DiscussionBriefs"
  | "SentenceDrafting"
  | "AppealPetition"
  | "AppealProsecution"
  | "FirstInstanceBenchmark"
  | "SecondInstanceBenchmark";

export type DeadlineComputation = "Continuous" | "Useful";
export type DeadlineStatus = "Active" | "Met" | "Expired" | "Extended" | "Waived";
export type DeadlineSeverity = "Validity" | "Procedural" | "Advisory";

export interface Deadline {
  id: RecordId;
  caseId: RecordId;
  deadlineType: DeadlineType;
  computationType: DeadlineComputation;
  startDate: ISODate;
  dueDate: ISODate;
  responsibleRole?: CaseRole;
  responsiblePersonId?: RecordId;
  status: DeadlineStatus;
  severity: DeadlineSeverity;
}

export type ServiceMode = "Postal" | "Personal" | "Email" | "Edict" | "ThroughProcurator";

export interface ServiceRecord {
  id: RecordId;
  caseId: RecordId;
  actServedId: RecordId;
  servedToPersonId: RecordId;
  serviceMode: ServiceMode;
  dateSent: ISODate;
  dateReceived?: ISODate;
  proofOfServiceAttachmentId?: RecordId;
  undeliverable: boolean;
  reServiceAttempts: number;
}

export type TribunalType = "Diocesan" | "Interdiocesan" | "Metropolitan" | "RomanRota";

export interface Tribunal {
  id: RecordId;
  name: string;
  type: TribunalType;
  dioceseId?: RecordId;
  bishopModeratorPersonId?: RecordId;
  instanceLevel: 1 | 2 | 3;
  appealTribunalId?: RecordId;
}

export interface Diocese {
  id: RecordId;
  name: string;
  metropolitanProvinceId?: RecordId;
  country: string;
  bishopPersonId?: RecordId;
}

export interface TribunalCalendarEntry {
  id: RecordId;
  tribunalId: RecordId;
  date: ISODate;
  type: "Holiday" | "Closed" | "ReducedHours";
  description?: string;
}

export type AppealStatus = "None" | "Pending" | "Filed" | "Resolved";

export interface Case {
  id: RecordId;
  protocolNumber: string;
  processType: ProcessType;
  caseStatus: AnyState;
  petitionerPersonId: RecordId;
  respondentPersonId: RecordId;
  marriageDate: ISODate;
  marriagePlace: string;
  dioceseOfCelebrationId: RecordId;
  competenceBasis?: CompetenceBasis;
  competenceNotes?: string; // REQUIRED if PlaceOfProofs
  groundIds: RecordId[]; // joined through CaseGround
  formulaOfDoubt?: string;
  dateFiled: ISODate;
  dateAdmitted?: ISODate;
  dateOfFormula?: ISODate;
  dateInstructionOpened?: ISODate;
  datePublicationDecree?: ISODate;
  dateConclusionDecree?: ISODate;
  dateSentence?: ISODate;
  dateSentencePublished?: ISODate;
  dateExecutive?: ISODate;
  appealStatus: AppealStatus;
  oneYearBenchmarkFlag: boolean;
  assignedTribunalId: RecordId;
  notes?: string;
}

export interface AuditLogEntry {
  id: RecordId;
  caseId: RecordId;
  action: string;
  performedByPersonnelId: RecordId;
  timestamp: string; // ISO 8601 timestamp
  previousState?: AnyState;
  newState?: AnyState;
  details?: string;
}
