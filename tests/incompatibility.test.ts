import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkIncompatibilities } from "../src/incompatibility/rules.ts";
import type { CaseAssignment } from "../src/types/canonical.ts";

describe("incompatibility rules (cc. 1447–1448; DC art. 66–67)", () => {
  it("blocks same person as judge + DBI on same case", () => {
    const v = checkIncompatibilities(
      { caseId: "c1", personId: "p1", roleInCase: "PresidingJudge" },
      {
        assignmentsForPerson: [],
        causeIdForCase: { c1: "cause1" },
        instanceLevelForCase: { c1: 1 },
        existingRolesOnThisCase: ["DefenderOfBond"],
      },
    );
    assert.equal(v.length, 1);
    assert.equal(v[0]!.rule, "JUDGE_AND_DEFENDER_PROMOTER_SAME_CASE");
  });

  it("blocks advocate + DBI on same cause (DC art. 36 §3)", () => {
    const v = checkIncompatibilities(
      { caseId: "c1", personId: "p1", roleInCase: "AdvocatePetitioner" },
      {
        assignmentsForPerson: [],
        causeIdForCase: { c1: "cause1" },
        instanceLevelForCase: { c1: 1 },
        existingRolesOnThisCase: ["DefenderOfBond"],
      },
    );
    assert.equal(v.length, 1);
    assert.equal(v[0]!.rule, "ADVOCATE_PROCURATOR_AND_DEFENDER_PROMOTER_SAME_CAUSE");
  });

  it("blocks judge in two instances of same cause", () => {
    const priorAssignment: CaseAssignment & {
      personId: string;
      caseInstanceLevel: number;
      causeId: string;
    } = {
      id: "a1",
      caseId: "c1",
      personnelId: "pp1",
      roleInCase: "Ponens",
      dateAssigned: "2025-01-01",
      activeOnCase: false,
      personId: "p1",
      caseInstanceLevel: 1,
      causeId: "cause1",
    };
    const v = checkIncompatibilities(
      { caseId: "c2", personId: "p1", roleInCase: "AssociateJudge" },
      {
        assignmentsForPerson: [priorAssignment],
        causeIdForCase: { c1: "cause1", c2: "cause1" },
        instanceLevelForCase: { c1: 1, c2: 2 },
        existingRolesOnThisCase: [],
      },
    );
    assert.ok(v.some((x) => x.rule === "PRIOR_INSTANCE_JUDGE_OR_ASSESSOR_HIGHER_INSTANCE"));
  });

  it("blocks prior DBI from being judge at any instance of same cause", () => {
    const priorAssignment: CaseAssignment & {
      personId: string;
      caseInstanceLevel: number;
      causeId: string;
    } = {
      id: "a1",
      caseId: "c1",
      personnelId: "pp1",
      roleInCase: "DefenderOfBond",
      dateAssigned: "2025-01-01",
      activeOnCase: false,
      personId: "p1",
      caseInstanceLevel: 1,
      causeId: "cause1",
    };
    const v = checkIncompatibilities(
      { caseId: "c2", personId: "p1", roleInCase: "PresidingJudge" },
      {
        assignmentsForPerson: [priorAssignment],
        causeIdForCase: { c1: "cause1", c2: "cause1" },
        instanceLevelForCase: { c1: 1, c2: 2 },
        existingRolesOnThisCase: [],
      },
    );
    assert.ok(
      v.some(
        (x) => x.rule === "PRIOR_DEFENDER_PROMOTER_PROCURATOR_ADVOCATE_WITNESS_EXPERT_AS_JUDGE",
      ),
    );
  });

  it("blocks judge within 4th-degree collateral relationship to party", () => {
    const v = checkIncompatibilities(
      { caseId: "c1", personId: "p1", roleInCase: "Ponens" },
      {
        assignmentsForPerson: [],
        causeIdForCase: { c1: "cause1" },
        instanceLevelForCase: { c1: 1 },
        relationshipDegree: { directLine: false, collateralDegree: 3 },
        existingRolesOnThisCase: [],
      },
    );
    assert.ok(v.some((x) => x.rule === "CONSANGUINITY_AFFINITY_4TH_DEGREE"));
  });

  it("allows unrelated persons with distinct roles", () => {
    const v = checkIncompatibilities(
      { caseId: "c1", personId: "p_new", roleInCase: "Notary" },
      {
        assignmentsForPerson: [],
        causeIdForCase: { c1: "cause1" },
        instanceLevelForCase: { c1: 1 },
        existingRolesOnThisCase: ["PresidingJudge", "Ponens", "AssociateJudge", "DefenderOfBond"],
      },
    );
    assert.equal(v.length, 0);
  });
});
