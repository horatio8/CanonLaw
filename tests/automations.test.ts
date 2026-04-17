import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dailyScan,
  onActCreatedUnauthenticated,
  onAdmitted,
  onAppealWindowExhausted,
  onSentencePublished,
} from "../src/automations/recipes.ts";
import type { Case, Deadline } from "../src/types/canonical.ts";

const baseCase: Case = {
  id: "case_1",
  protocolNumber: "2026/001",
  processType: "Ordinary",
  caseStatus: "Admitted",
  petitionerPersonId: "p1",
  respondentPersonId: "p2",
  marriageDate: "2015-06-15",
  marriagePlace: "X",
  dioceseOfCelebrationId: "d1",
  groundIds: ["g1"],
  dateFiled: "2026-01-10",
  dateAdmitted: "2026-02-01",
  appealStatus: "None",
  oneYearBenchmarkFlag: false,
  assignedTribunalId: "t1",
};

describe("automation recipes", () => {
  it("onAdmitted creates the 15-day respondent response deadline", () => {
    const effects = onAdmitted(baseCase, { today: "2026-02-01" });
    assert.equal(effects.length, 1);
    const e = effects[0]!;
    assert.equal(e.kind, "CreateDeadline");
    if (e.kind === "CreateDeadline") {
      assert.equal(e.deadline.type, "RespondentInitialResponse");
      assert.equal(e.deadline.dueDate, "2026-02-16");
    }
  });

  it("onSentencePublished creates AppealPetition deadline and DBI task", () => {
    const published: Case = { ...baseCase, dateSentencePublished: "2026-05-10" };
    const effects = onSentencePublished(published, { today: "2026-05-10" });
    const kinds = effects.map((e) => e.kind).sort();
    assert.deepEqual(kinds, ["CreateDeadline", "CreateTask"]);
  });

  it("onActCreatedUnauthenticated alerts the notary", () => {
    const effects = onActCreatedUnauthenticated("case_1", "act_99", "Witness Examination");
    assert.equal(effects.length, 1);
    assert.equal(effects[0]!.kind, "AlertNotary");
  });

  it("dailyScan flags 1-year benchmark within 30 days", () => {
    const effects = dailyScan(
      { ...baseCase, dateAdmitted: "2025-02-15", oneYearBenchmarkFlag: false },
      [],
      "2026-02-01",
    );
    assert.ok(effects.some((e) => e.kind === "FlagBenchmark"));
  });

  it("dailyScan alerts on expired deadlines", () => {
    const d: Deadline = {
      id: "dl1",
      caseId: "case_1",
      deadlineType: "RespondentInitialResponse",
      computationType: "Continuous",
      startDate: "2026-02-01",
      dueDate: "2026-02-16",
      status: "Active",
      severity: "Procedural",
    };
    const effects = dailyScan(baseCase, [d], "2026-02-20");
    assert.ok(effects.some((e) => e.kind === "AlertDeadline" && /EXPIRED/.test(e.message)));
  });

  it("dailyScan alerts 3 days before due", () => {
    const d: Deadline = {
      id: "dl1",
      caseId: "case_1",
      deadlineType: "AppealPetition",
      computationType: "Useful",
      startDate: "2026-04-01",
      dueDate: "2026-04-16",
      status: "Active",
      severity: "Validity",
    };
    const effects = dailyScan(baseCase, [d], "2026-04-14");
    assert.ok(effects.some((e) => e.kind === "AlertDeadline" && /due in 2/.test(e.message)));
  });

  it("onAppealWindowExhausted auto-transitions only when every condition met", () => {
    const none = onAppealWindowExhausted(baseCase, {
      petitionExpired: true,
      noAppealFiled: true,
      dbiNonAppealStatementFiled: false,
      noNullityComplaintFiled: true,
    });
    assert.deepEqual(none, []);
    const go = onAppealWindowExhausted(baseCase, {
      petitionExpired: true,
      noAppealFiled: true,
      dbiNonAppealStatementFiled: true,
      noNullityComplaintFiled: true,
    });
    assert.equal(go.length, 1);
    assert.equal(go[0]!.kind, "TransitionStatus");
  });
});
