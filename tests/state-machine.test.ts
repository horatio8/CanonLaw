import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BRIEFER_TRANSITIONS,
  DOCUMENTARY_TRANSITIONS,
  ORDINARY_TRANSITIONS,
  allowedNextStates,
  transitionsFor,
} from "../src/state-machine/states.ts";

describe("state machines", () => {
  it("ordinary process exposes exactly the 14 transitions described in spec (plus rejection)", () => {
    // 14 forward transitions + 1 rejection side-branch = 14 total listed;
    // rejection replaces admitted path, so the sequence has 14 unique-from pairs.
    assert.equal(ORDINARY_TRANSITIONS.length, 14);
    assert.ok(ORDINARY_TRANSITIONS.some((t) => t.from === "PreAdmissionReview" && t.to === "Rejected"));
    assert.ok(ORDINARY_TRANSITIONS.some((t) => t.from === "AppealWindow" && t.to === "Executive"));
  });

  it("briefer process supports bishop remand back to intake (c. 1687 §1)", () => {
    assert.ok(
      BRIEFER_TRANSITIONS.some((t) => t.from === "BishopDecision" && t.to === "Intake"),
    );
  });

  it("documentary process can remand to ordinary from preliminary review", () => {
    assert.ok(
      DOCUMENTARY_TRANSITIONS.some((t) => t.from === "PreliminaryReview" && t.to === "Intake"),
    );
  });

  it("transitionsFor(...) returns the correct list", () => {
    assert.equal(transitionsFor("Ordinary"), ORDINARY_TRANSITIONS);
    assert.equal(transitionsFor("Briefer"), BRIEFER_TRANSITIONS);
    assert.equal(transitionsFor("Documentary"), DOCUMENTARY_TRANSITIONS);
  });

  it("allowedNextStates from PreAdmissionReview includes both Admitted and Rejected", () => {
    const next = allowedNextStates("Ordinary", "PreAdmissionReview");
    const targets = next.map((n) => n.state).sort();
    assert.deepEqual(targets, ["Admitted", "Rejected"]);
  });
});
