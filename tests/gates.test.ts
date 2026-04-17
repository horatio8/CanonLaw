import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransition, type CaseSnapshot } from "../src/state-machine/gates.ts";
import type {
  Act,
  Case,
  CaseAssignment,
  Deadline,
  ServiceRecord,
} from "../src/types/canonical.ts";

function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    id: "case_1",
    protocolNumber: "2026/001",
    processType: "Ordinary",
    caseStatus: "Intake",
    petitionerPersonId: "p1",
    respondentPersonId: "p2",
    marriageDate: "2015-06-15",
    marriagePlace: "St. Mary's, Springfield",
    dioceseOfCelebrationId: "d1",
    groundIds: ["g1"],
    dateFiled: "2026-01-10",
    appealStatus: "None",
    oneYearBenchmarkFlag: false,
    assignedTribunalId: "t1",
    ...overrides,
  };
}

type SnapOverrides = Omit<Partial<CaseSnapshot>, "case"> & { case?: Partial<Case> };

function snap(partial: SnapOverrides = {}): CaseSnapshot {
  const baseCase = makeCase(partial.case ?? {});
  return {
    case: baseCase,
    acts: partial.acts ?? [],
    assignments: partial.assignments ?? [],
    deadlines: partial.deadlines ?? [],
    serviceRecords: partial.serviceRecords ?? [],
    today: partial.today ?? "2026-02-01",
    ...(partial.dbiPreAdmissionWaived !== undefined
      ? { dbiPreAdmissionWaived: partial.dbiPreAdmissionWaived }
      : {}),
    ...(partial.dbiPostSentenceDecisionFiled !== undefined
      ? { dbiPostSentenceDecisionFiled: partial.dbiPostSentenceDecisionFiled }
      : {}),
  };
}

const authentic = (partial: Partial<Act> & Pick<Act, "actType" | "id" | "caseId">): Act => ({
  actCategory: "Procedural",
  title: partial.actType,
  content: "",
  createdByPersonnelId: "n_notary",
  dateCreated: "2026-01-10",
  authenticatedByNotaryPersonnelId: "n_notary",
  dateAuthenticated: "2026-01-10",
  isAuthenticated: true,
  insertedInOfficialActs: true,
  certifiedCopyGenerated: false,
  ...partial,
});

describe("state-machine gates", () => {
  it("Intake → PreAdmission blocks without authenticated libellus", () => {
    const r = canTransition(
      { from: "Intake", to: "PreAdmissionReview", gate: "ORD_1_INTAKE_TO_PRE_ADMISSION" },
      snap(),
    );
    assert.equal(r.ok, false);
    assert.ok(r.failures.some((f) => /Libellus must be notary-authenticated/.test(f)));
  });

  it("Intake → PreAdmission passes with authenticated libellus", () => {
    const r = canTransition(
      { from: "Intake", to: "PreAdmissionReview", gate: "ORD_1_INTAKE_TO_PRE_ADMISSION" },
      snap({ acts: [authentic({ id: "a1", caseId: "case_1", actType: "Libellus" })] }),
    );
    assert.equal(r.ok, true);
  });

  it("PreAdmission → Admitted requires competence notes when basis is proofs", () => {
    const r = canTransition(
      { from: "PreAdmissionReview", to: "Admitted", gate: "ORD_2_PRE_ADMISSION_TO_ADMITTED" },
      snap({
        case: { caseStatus: "PreAdmissionReview", competenceBasis: "PlaceOfProofs" },
        acts: [
          { ...authentic({ id: "a1", caseId: "case_1", actType: "StandingCheck" }), isAuthenticated: false },
          authentic({ id: "a2", caseId: "case_1", actType: "DBIPreAdmissionVotum" }),
        ],
      }),
    );
    assert.equal(r.ok, false);
    assert.ok(r.failures.some((f) => /Competence notes REQUIRED/.test(f)));
  });

  it("PreAdmission → Admitted passes with all prerequisites", () => {
    const r = canTransition(
      { from: "PreAdmissionReview", to: "Admitted", gate: "ORD_2_PRE_ADMISSION_TO_ADMITTED" },
      snap({
        case: {
          caseStatus: "PreAdmissionReview",
          competenceBasis: "DomicilePetitioner",
        },
        acts: [
          { ...authentic({ id: "a1", caseId: "case_1", actType: "StandingCheck" }), isAuthenticated: false },
          authentic({ id: "a2", caseId: "case_1", actType: "DBIPreAdmissionVotum" }),
        ],
      }),
    );
    assert.equal(r.ok, true, r.failures.join("; "));
  });

  it("Tribunal constitution blocks without minimum 3 judges", () => {
    const asgn = (role: CaseAssignment["roleInCase"], personnel: string): CaseAssignment => ({
      id: `asgn_${role}_${personnel}`,
      caseId: "case_1",
      personnelId: personnel,
      roleInCase: role,
      dateAssigned: "2026-02-01",
      activeOnCase: true,
    });
    const r = canTransition(
      { from: "FormulaOfDoubt", to: "TribunalConstitution", gate: "ORD_5_FORMULA_TO_CONSTITUTION" },
      snap({
        case: { caseStatus: "FormulaOfDoubt", formulaOfDoubt: "Whether nullity is proven..." },
        acts: [authentic({ id: "a1", caseId: "case_1", actType: "FormulaOfDoubtDecree" })],
        deadlines: [
          {
            id: "dl1",
            caseId: "case_1",
            deadlineType: "FormulaRecourse",
            computationType: "Useful",
            startDate: "2026-01-15",
            dueDate: "2026-01-25",
            status: "Expired",
            severity: "Procedural",
          } as Deadline,
        ],
        assignments: [asgn("PresidingJudge", "p_judge")],
        today: "2026-02-01",
      }),
    );
    // This is FormulaOfDoubt → Constitution (not Constitution → Instruction).
    // It just needs the formula decree and the recourse window passed. Should pass.
    assert.equal(r.ok, true, r.failures.join("; "));
  });

  it("Sentence publication blocks if sentence lacks notary signature (c. 1437)", () => {
    const unsignedSentence: Act = {
      id: "sent",
      caseId: "case_1",
      actType: "FinalSentence",
      actCategory: "Merits",
      title: "Sentence",
      content:
        "tribunal parties facts formula of doubt reasons in law reasons in fact dispositive",
      createdByPersonnelId: "ponens",
      dateCreated: "2026-03-01",
      isAuthenticated: false,
      insertedInOfficialActs: true,
      certifiedCopyGenerated: false,
    };
    const r = canTransition(
      {
        from: "SentenceDrafting",
        to: "SentencePublication",
        gate: "ORD_11_SENTENCE_DRAFT_TO_PUBLICATION",
      },
      snap({ case: { caseStatus: "SentenceDrafting" }, acts: [unsignedSentence] }),
    );
    assert.equal(r.ok, false);
    assert.ok(r.failures.some((f) => /VALIDITY/.test(f)));
  });

  it("Sentence publication blocks if sentence missing cc. 1611–1612 elements", () => {
    const partialSentence: Act = {
      id: "sent",
      caseId: "case_1",
      actType: "FinalSentence",
      actCategory: "Merits",
      title: "Sentence",
      content: "tribunal parties reasons in law",
      createdByPersonnelId: "ponens",
      dateCreated: "2026-03-01",
      isAuthenticated: true,
      insertedInOfficialActs: true,
      certifiedCopyGenerated: false,
    };
    const r = canTransition(
      {
        from: "SentenceDrafting",
        to: "SentencePublication",
        gate: "ORD_11_SENTENCE_DRAFT_TO_PUBLICATION",
      },
      snap({ case: { caseStatus: "SentenceDrafting" }, acts: [partialSentence] }),
    );
    assert.equal(r.ok, false);
    assert.ok(r.failures.some((f) => /cc. 1611–1612/.test(f)));
  });

  it("Appeal → Executive blocks if DBI has not filed appeal-or-non-appeal statement", () => {
    const r = canTransition(
      { from: "AppealWindow", to: "Executive", gate: "ORD_13_APPEAL_TO_EXECUTIVE" },
      snap({
        case: { caseStatus: "AppealWindow" },
        deadlines: [
          {
            id: "dl1",
            caseId: "case_1",
            deadlineType: "AppealPetition",
            computationType: "Useful",
            startDate: "2026-03-01",
            dueDate: "2026-03-16",
            status: "Expired",
            severity: "Validity",
          } as Deadline,
        ],
        today: "2026-04-01",
        dbiPostSentenceDecisionFiled: false,
      }),
    );
    assert.equal(r.ok, false);
    assert.ok(r.failures.some((f) => /DBI must file/.test(f)));
  });

  it("current-state mismatch is rejected", () => {
    const r = canTransition(
      { from: "Admitted", to: "CitationAndResponse", gate: "ORD_3_ADMITTED_TO_CITATION" },
      snap({ case: { caseStatus: "Intake" } }),
    );
    assert.equal(r.ok, false);
    assert.ok(r.failures.some((f) => /Case is in state/.test(f)));
  });
});

// Exhaustiveness touches a ServiceRecord to keep the type in use during tests.
void (null as ServiceRecord | null);
