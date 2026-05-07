/**
 * Case data service layer.
 *
 * Maps Airtable records ↔ presentation data for the UI. Uses its own interface
 * definitions to avoid `exactOptionalPropertyTypes` conflicts with the strict
 * domain types in src/types/canonical.ts.
 *
 * All functions require an orgId to resolve the connected Airtable base.
 */

import "server-only";
import { clientForOrg } from "./service.ts";
import { loadIntegration } from "./store.ts";
import type {
  AnyState,
  ProcessType,
  CompetenceBasis,
  AppealStatus,
  ActType,
  ActCategory,
  CaseRole,
  DeadlineType,
  DeadlineComputation,
  DeadlineStatus,
  DeadlineSeverity,
  ServiceMode,
  CanonicalRole,
} from "../../src/types/canonical.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getBaseId(orgId: string): Promise<string> {
  const state = await loadIntegration(orgId);
  if (!state?.selectedBase) throw new Error("No Airtable base selected for this organization.");
  return state.selectedBase.baseId;
}

async function getTableId(orgId: string, logicalName: string): Promise<string> {
  const state = await loadIntegration(orgId);
  if (!state?.selectedBase) throw new Error("No Airtable base selected.");
  const id = state.selectedBase.tableIds[logicalName];
  if (!id) throw new Error(`Table "${logicalName}" not found in provisioned schema. Re-provision the base.`);
  return id;
}

/** Airtable link fields return arrays of record IDs. Extract first or empty string. */
function firstLink(val: unknown): string {
  if (Array.isArray(val) && val.length > 0) return val[0] as string;
  return "";
}

function optStr(val: unknown): string | undefined {
  const s = val as string | null | undefined;
  return s ?? undefined;
}

// ---------------------------------------------------------------------------
// State mapping: Airtable display names ↔ TypeScript state enum values
// ---------------------------------------------------------------------------

const STATE_TO_AIRTABLE: Record<string, string> = {
  Intake: "Intake",
  PreAdmissionReview: "Pre-Admission Review",
  Admitted: "Admitted",
  Rejected: "Rejected",
  CitationAndResponse: "Citation & Response",
  FormulaOfDoubt: "Formula of Doubt",
  TribunalConstitution: "Tribunal Constitution",
  Instruction: "Instruction",
  PublicationOfActs: "Publication of Acts",
  ConclusionAndDiscussion: "Conclusion & Discussion",
  Deliberation: "Deliberation",
  SentenceDrafting: "Sentence Drafting",
  SentencePublication: "Sentence Publication",
  AppealWindow: "Appeal Window",
  Executive: "Executive",
  FormulaBrieferRouting: "Briefer: Formula Routing",
  InstructorAssessorAppointment: "Briefer: Instructor Appointed",
  InstructionalSession: "Briefer: Instructional Session",
  BishopDecision: "Briefer: Bishop Decision",
  PreliminaryReview: "Documentary: Preliminary Review",
  Judgment: "Documentary: Judgment",
};

const AIRTABLE_TO_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_TO_AIRTABLE).map(([k, v]) => [v, k]),
);

function toState(airtableVal: string | undefined | null): AnyState {
  if (!airtableVal) return "Intake";
  return (AIRTABLE_TO_STATE[airtableVal] ?? "Intake") as AnyState;
}

function fromState(state: AnyState): string {
  return STATE_TO_AIRTABLE[state] ?? state;
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export interface CaseListItem {
  id: string;
  protocolNumber: string;
  processType: ProcessType;
  caseStatus: AnyState;
  dateFiled: string;
  appealStatus: AppealStatus;
}

export interface CaseDetail {
  _recordId: string;
  protocolNumber: string;
  processType: ProcessType;
  caseStatus: AnyState;
  petitionerPersonId: string;
  respondentPersonId: string;
  marriageDate: string;
  marriagePlace: string;
  dioceseOfCelebrationId: string;
  competenceBasis: string;
  competenceNotes: string;
  formulaOfDoubt: string;
  dateFiled: string;
  dateAdmitted: string;
  dateOfFormula: string;
  dateInstructionOpened: string;
  datePublicationDecree: string;
  dateConclusionDecree: string;
  dateSentence: string;
  dateSentencePublished: string;
  dateExecutive: string;
  appealStatus: AppealStatus;
  oneYearBenchmarkFlag: boolean;
  assignedTribunalId: string;
  notes: string;
}

export async function listCases(orgId: string): Promise<CaseListItem[]> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Cases");

  const records = await client.listAllRecords<Record<string, unknown>>(baseId, tableId, {
    sort: [{ field: "Date Filed", direction: "desc" }],
  });

  return records.map((r) => ({
    id: r.id,
    protocolNumber: (r.fields["Protocol Number"] as string) ?? "",
    processType: ((r.fields["Process Type"] as string) ?? "Ordinary") as ProcessType,
    caseStatus: toState(r.fields["Case Status"] as string | undefined),
    dateFiled: (r.fields["Date Filed"] as string) ?? "",
    appealStatus: ((r.fields["Appeal Status"] as string) ?? "None") as AppealStatus,
  }));
}

export async function getCase(orgId: string, recordId: string): Promise<CaseDetail> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Cases");

  const r = await client.getRecord<Record<string, unknown>>(baseId, tableId, recordId);
  const f = r.fields;
  return {
    _recordId: r.id,
    protocolNumber: (f["Protocol Number"] as string) ?? "",
    processType: ((f["Process Type"] as string) ?? "Ordinary") as ProcessType,
    caseStatus: toState(f["Case Status"] as string | undefined),
    petitionerPersonId: firstLink(f["Petitioner"]),
    respondentPersonId: firstLink(f["Respondent"]),
    marriageDate: (f["Marriage Date"] as string) ?? "",
    marriagePlace: (f["Marriage Place"] as string) ?? "",
    dioceseOfCelebrationId: firstLink(f["Diocese of Celebration"]),
    competenceBasis: (f["Competence Basis"] as string) ?? "",
    competenceNotes: (f["Competence Notes"] as string) ?? "",
    formulaOfDoubt: (f["Formula of Doubt"] as string) ?? "",
    dateFiled: (f["Date Filed"] as string) ?? "",
    dateAdmitted: (f["Date Admitted"] as string) ?? "",
    dateOfFormula: (f["Date of Formula"] as string) ?? "",
    dateInstructionOpened: (f["Date Instruction Opened"] as string) ?? "",
    datePublicationDecree: (f["Date Publication Decree"] as string) ?? "",
    dateConclusionDecree: (f["Date Conclusion Decree"] as string) ?? "",
    dateSentence: (f["Date Sentence"] as string) ?? "",
    dateSentencePublished: (f["Date Sentence Published"] as string) ?? "",
    dateExecutive: (f["Date Executive"] as string) ?? "",
    appealStatus: ((f["Appeal Status"] as string) ?? "None") as AppealStatus,
    oneYearBenchmarkFlag: (f["One-Year Benchmark Flag"] as boolean) ?? false,
    assignedTribunalId: firstLink(f["Assigned Tribunal"]),
    notes: (f["Notes"] as string) ?? "",
  };
}

export async function updateCaseStatus(
  orgId: string,
  recordId: string,
  newStatus: AnyState,
  dateFields?: Record<string, string>,
): Promise<void> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Cases");

  const fields: Record<string, unknown> = { "Case Status": fromState(newStatus) };
  if (dateFields) {
    Object.assign(fields, dateFields);
  }
  await client.updateRecord(baseId, tableId, recordId, fields);
}

export async function createCase(
  orgId: string,
  data: {
    protocolNumber: string;
    processType: ProcessType;
    petitionerId: string;
    respondentId: string;
    marriageDate: string;
    marriagePlace: string;
    dioceseOfCelebrationId: string;
    competenceBasis?: string;
    competenceNotes?: string;
    tribunalId: string;
  },
): Promise<string> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Cases");

  const fields: Record<string, unknown> = {
    "Protocol Number": data.protocolNumber,
    "Process Type": data.processType,
    "Case Status": "Intake",
    "Petitioner": [data.petitionerId],
    "Respondent": [data.respondentId],
    "Marriage Date": data.marriageDate,
    "Marriage Place": data.marriagePlace,
    "Diocese of Celebration": [data.dioceseOfCelebrationId],
    "Assigned Tribunal": [data.tribunalId],
    "Date Filed": new Date().toISOString().split("T")[0],
    "Appeal Status": "None",
  };
  if (data.competenceBasis) fields["Competence Basis"] = data.competenceBasis;
  if (data.competenceNotes) fields["Competence Notes"] = data.competenceNotes;

  const result = await client.createRecord(baseId, tableId, fields);
  return result.id;
}

// ---------------------------------------------------------------------------
// Acts
// ---------------------------------------------------------------------------

export interface ActRecord {
  _recordId: string;
  caseId: string;
  actType: string;
  actCategory: string;
  title: string;
  content: string;
  createdByPersonnelId: string;
  dateCreated: string;
  isAuthenticated: boolean;
  dateAuthenticated: string;
  protocolPageNumber: number;
  insertedInOfficialActs: boolean;
}

export async function listActsForCase(orgId: string, caseRecordId: string): Promise<ActRecord[]> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Acts");

  const records = await client.listAllRecords<Record<string, unknown>>(baseId, tableId, {
    filterByFormula: `FIND("${caseRecordId}", ARRAYJOIN({Case}))`,
    sort: [{ field: "Date Created", direction: "desc" }],
  });

  return records.map((r) => {
    const f = r.fields;
    return {
      _recordId: r.id,
      caseId: firstLink(f["Case"]),
      actType: (f["Act Type"] as string) ?? "",
      actCategory: (f["Act Category"] as string) ?? "Procedural",
      title: (f["Title"] as string) ?? "",
      content: (f["Content"] as string) ?? "",
      createdByPersonnelId: firstLink(f["Created By"]),
      dateCreated: (f["Date Created"] as string) ?? "",
      isAuthenticated: (f["Authenticated"] as boolean) ?? false,
      dateAuthenticated: (f["Date Authenticated"] as string) ?? "",
      protocolPageNumber: (f["Protocol Page Number"] as number) ?? 0,
      insertedInOfficialActs: (f["Inserted in Official Acts"] as boolean) ?? false,
    };
  });
}

export async function createAct(
  orgId: string,
  data: {
    caseRecordId: string;
    actType: string;
    actCategory: string;
    title: string;
    content: string;
    createdByPersonnelId: string;
  },
): Promise<string> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Acts");

  const fields: Record<string, unknown> = {
    Case: [data.caseRecordId],
    "Act Type": data.actType,
    "Act Category": data.actCategory,
    Title: data.title,
    Content: data.content,
    "Created By": [data.createdByPersonnelId],
    "Date Created": new Date().toISOString().split("T")[0],
    Authenticated: false,
    "Inserted in Official Acts": false,
    "Certified Copy Generated": false,
  };

  const result = await client.createRecord(baseId, tableId, fields);
  return result.id;
}

export async function authenticateAct(
  orgId: string,
  actRecordId: string,
  notaryPersonnelId: string,
): Promise<void> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Acts");

  const fields: Record<string, unknown> = {
    Authenticated: true,
    "Authenticated By Notary": [notaryPersonnelId],
    "Date Authenticated": new Date().toISOString().split("T")[0],
  };
  await client.updateRecord(baseId, tableId, actRecordId, fields);
}

// ---------------------------------------------------------------------------
// Case Assignments
// ---------------------------------------------------------------------------

export interface AssignmentRecord {
  _recordId: string;
  caseId: string;
  personnelId: string;
  roleInCase: string;
  dateAssigned: string;
  dateRemoved: string;
  activeOnCase: boolean;
}

export async function listAssignmentsForCase(orgId: string, caseRecordId: string): Promise<AssignmentRecord[]> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Case Assignments");

  const records = await client.listAllRecords<Record<string, unknown>>(baseId, tableId, {
    filterByFormula: `FIND("${caseRecordId}", ARRAYJOIN({Case}))`,
  });

  return records.map((r) => {
    const f = r.fields;
    return {
      _recordId: r.id,
      caseId: firstLink(f["Case"]),
      personnelId: firstLink(f["Personnel"]),
      roleInCase: (f["Role in Case"] as string) ?? "",
      dateAssigned: (f["Date Assigned"] as string) ?? "",
      dateRemoved: (f["Date Removed"] as string) ?? "",
      activeOnCase: (f["Active on Case"] as boolean) ?? true,
    };
  });
}

export async function createAssignment(
  orgId: string,
  data: {
    caseRecordId: string;
    personnelId: string;
    roleInCase: string;
  },
): Promise<string> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Case Assignments");

  const fields: Record<string, unknown> = {
    Case: [data.caseRecordId],
    Personnel: [data.personnelId],
    "Role in Case": data.roleInCase,
    "Date Assigned": new Date().toISOString().split("T")[0],
    "Active on Case": true,
  };

  const result = await client.createRecord(baseId, tableId, fields);
  return result.id;
}

// ---------------------------------------------------------------------------
// Deadlines
// ---------------------------------------------------------------------------

export interface DeadlineRecord {
  _recordId: string;
  caseId: string;
  deadlineType: string;
  computationType: string;
  startDate: string;
  dueDate: string;
  responsibleRole: string;
  status: string;
  severity: string;
}

export async function listDeadlinesForCase(orgId: string, caseRecordId: string): Promise<DeadlineRecord[]> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Deadlines");

  const records = await client.listAllRecords<Record<string, unknown>>(baseId, tableId, {
    filterByFormula: `FIND("${caseRecordId}", ARRAYJOIN({Case}))`,
    sort: [{ field: "Due Date", direction: "asc" }],
  });

  return records.map((r) => {
    const f = r.fields;
    return {
      _recordId: r.id,
      caseId: firstLink(f["Case"]),
      deadlineType: (f["Deadline Type"] as string) ?? "",
      computationType: (f["Computation Type"] as string) ?? "Continuous",
      startDate: (f["Start Date"] as string) ?? "",
      dueDate: (f["Due Date"] as string) ?? "",
      responsibleRole: (f["Responsible Role"] as string) ?? "",
      status: (f["Status"] as string) ?? "Active",
      severity: (f["Severity"] as string) ?? "Procedural",
    };
  });
}

export async function createDeadlineRecord(
  orgId: string,
  data: {
    caseRecordId: string;
    deadlineType: string;
    computationType: string;
    startDate: string;
    dueDate: string;
    responsibleRole?: string;
    severity: string;
  },
): Promise<string> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Deadlines");

  const fields: Record<string, unknown> = {
    Case: [data.caseRecordId],
    "Deadline Type": data.deadlineType,
    "Computation Type": data.computationType,
    "Start Date": data.startDate,
    "Due Date": data.dueDate,
    Status: "Active",
    Severity: data.severity,
  };
  if (data.responsibleRole) fields["Responsible Role"] = data.responsibleRole;

  const result = await client.createRecord(baseId, tableId, fields);
  return result.id;
}

// ---------------------------------------------------------------------------
// Personnel
// ---------------------------------------------------------------------------

export interface PersonnelRecord {
  _recordId: string;
  personId: string;
  tribunalId: string;
  canonicalRole: string;
  appointmentDate: string;
  active: boolean;
  oathTaken: boolean;
  oathDate: string;
  qualifications: string;
}

export async function listPersonnel(orgId: string): Promise<PersonnelRecord[]> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Tribunal Personnel");

  const records = await client.listAllRecords<Record<string, unknown>>(baseId, tableId, {
    sort: [{ field: "Canonical Role", direction: "asc" }],
  });

  return records.map((r) => {
    const f = r.fields;
    return {
      _recordId: r.id,
      personId: firstLink(f["Person"]),
      tribunalId: firstLink(f["Tribunal"]),
      canonicalRole: (f["Canonical Role"] as string) ?? "",
      appointmentDate: (f["Appointment Date"] as string) ?? "",
      active: (f["Active"] as boolean) ?? true,
      oathTaken: (f["Oath Taken"] as boolean) ?? false,
      oathDate: (f["Oath Date"] as string) ?? "",
      qualifications: (f["Qualifications"] as string) ?? "",
    };
  });
}

// ---------------------------------------------------------------------------
// Persons
// ---------------------------------------------------------------------------

export interface PersonRecord {
  _recordId: string;
  firstName: string;
  lastName: string;
  titlePrefix: string;
  canonicalStatus: string;
  email: string;
  phone: string;
  personTypes: string[];
}

export async function listPersons(orgId: string): Promise<PersonRecord[]> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Persons");

  const records = await client.listAllRecords<Record<string, unknown>>(baseId, tableId, {
    sort: [{ field: "Last Name", direction: "asc" }],
  });

  return records.map((r) => {
    const f = r.fields;
    return {
      _recordId: r.id,
      firstName: (f["First Name"] as string) ?? "",
      lastName: (f["Last Name"] as string) ?? "",
      titlePrefix: (f["Title/Prefix"] as string) ?? "",
      canonicalStatus: (f["Canonical Status"] as string) ?? "",
      email: (f["Email"] as string) ?? "",
      phone: (f["Phone"] as string) ?? "",
      personTypes: (f["Person Type"] as string[]) ?? [],
    };
  });
}

export async function getPerson(orgId: string, recordId: string): Promise<PersonRecord> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Persons");

  const r = await client.getRecord<Record<string, unknown>>(baseId, tableId, recordId);
  const f = r.fields;
  return {
    _recordId: r.id,
    firstName: (f["First Name"] as string) ?? "",
    lastName: (f["Last Name"] as string) ?? "",
    titlePrefix: (f["Title/Prefix"] as string) ?? "",
    canonicalStatus: (f["Canonical Status"] as string) ?? "",
    email: (f["Email"] as string) ?? "",
    phone: (f["Phone"] as string) ?? "",
    personTypes: (f["Person Type"] as string[]) ?? [],
  };
}

export async function createPerson(
  orgId: string,
  data: {
    firstName: string;
    lastName: string;
    titlePrefix?: string;
    email?: string;
    phone?: string;
    personTypes: string[];
  },
): Promise<string> {
  const client = await clientForOrg(orgId);
  const baseId = await getBaseId(orgId);
  const tableId = await getTableId(orgId, "Persons");

  const fields: Record<string, unknown> = {
    "First Name": data.firstName,
    "Last Name": data.lastName,
    "Person Type": data.personTypes,
  };
  if (data.titlePrefix) fields["Title/Prefix"] = data.titlePrefix;
  if (data.email) fields["Email"] = data.email;
  if (data.phone) fields["Phone"] = data.phone;

  const result = await client.createRecord(baseId, tableId, fields);
  return result.id;
}
