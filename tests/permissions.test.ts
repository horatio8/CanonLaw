import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { can, availableActions } from "../src/permissions/matrix.ts";

describe("role-permission matrix", () => {
  it("only JV may issue admission at Pre-Admission Review", () => {
    assert.equal(can("JudicialVicar", "PreAdmissionReview", "IssueAdmission"), true);
    assert.equal(can("AdjunctJudicialVicar", "PreAdmissionReview", "IssueAdmission"), true);
    assert.equal(can("PresidingJudge", "PreAdmissionReview", "IssueAdmission"), false);
    assert.equal(can("DefenderOfBond", "PreAdmissionReview", "IssueAdmission"), false);
  });

  it("only Ponens may draft the sentence by default (c. 1610 §2)", () => {
    assert.equal(can("Ponens", "SentenceDrafting", "DraftSentence"), true);
    assert.equal(can("PresidingJudge", "SentenceDrafting", "DraftSentence"), false);
    assert.equal(can("AssociateJudge", "SentenceDrafting", "DraftSentence"), false);
  });

  it("only Notary signs for VALIDITY", () => {
    assert.equal(can("Notary", "SentenceDrafting", "SignSentence"), true);
    assert.equal(can("Ponens", "SentenceDrafting", "SignSentence"), false);
  });

  it("DBI, advocates, and admin have no actions in Deliberation", () => {
    assert.deepEqual(availableActions("DefenderOfBond", "Deliberation"), []);
    assert.deepEqual(availableActions("Advocate", "Deliberation"), []);
    assert.deepEqual(availableActions("TribunalAdministrator", "Deliberation"), []);
  });

  it("DBI can file (mandatory) observations at Conclusion", () => {
    assert.equal(can("DefenderOfBond", "ConclusionAndDiscussion", "FileObservations"), true);
  });

  it("DBI must file appeal or non-appeal statement in AppealWindow", () => {
    assert.equal(can("DefenderOfBond", "AppealWindow", "FileAppealOrNonAppeal"), true);
  });
});
