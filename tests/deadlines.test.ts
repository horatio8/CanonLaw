import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addCanonicalMonths,
  addCanonicalYears,
  addDays,
  computeDueDate,
  closedDaySet,
  extendToFirstOpenDay,
} from "../src/deadlines/time.ts";
import { createDeadline } from "../src/deadlines/catalog.ts";

describe("canonical time (cc. 200–203)", () => {
  it("canonical month = 30 days (c. 202 §2)", () => {
    assert.equal(addCanonicalMonths("2026-01-01", 1), "2026-01-31");
  });

  it("canonical year = 365 days (c. 202 §2)", () => {
    assert.equal(addCanonicalYears("2026-01-01", 1), "2027-01-01");
  });

  it("day of commencement not counted (c. 203 §1) — continuous 15 days", () => {
    // Start on Jan 1 → clock begins Jan 2 → last day is Jan 16.
    assert.equal(
      computeDueDate({ startDate: "2026-01-01", days: 15, computation: "Continuous" }),
      "2026-01-16",
    );
  });

  it("continuous appeal petition 15 days from publication", () => {
    // c. 1630: 15 useful days. (Useful with no blocked days = continuous.)
    const d = computeDueDate({ startDate: "2026-04-01", days: 15, computation: "Useful" });
    assert.equal(d, "2026-04-16");
  });

  it("useful time skips unavailable days (c. 201 §2)", () => {
    // 10 useful days starting 2026-04-01, with 2026-04-05 and 2026-04-08 unavailable.
    // Day count: 4/2, 4/3, 4/4, SKIP 4/5, 4/6, 4/7, SKIP 4/8, 4/9, 4/10, 4/11, 4/12, 4/13.
    // After 10 counted: 4/2,4/3,4/4,4/6,4/7,4/9,4/10,4/11,4/12,4/13 → due 4/13.
    const unavailable = new Set(["2026-04-05", "2026-04-08"]);
    const d = computeDueDate({
      startDate: "2026-04-01",
      days: 10,
      computation: "Useful",
      unavailableDays: unavailable,
    });
    assert.equal(d, "2026-04-13");
  });

  it("extends to first open day on tribunal closure (c. 1467)", () => {
    const closed = closedDaySet([
      { date: "2026-01-16", type: "Holiday" },
      { date: "2026-01-17", type: "Closed" },
    ]);
    const due = extendToFirstOpenDay("2026-01-16", closed);
    assert.equal(due, "2026-01-18");
  });

  it("addDays handles month rollover", () => {
    assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  });
});

describe("deadline catalog", () => {
  it("respondent response = 15 continuous days (c. 1676 §1)", () => {
    const d = createDeadline({ type: "RespondentInitialResponse", startDate: "2026-04-01" });
    assert.equal(d.computation, "Continuous");
    assert.equal(d.severity, "Procedural");
    assert.equal(d.dueDate, "2026-04-16");
  });

  it("appeal petition = 15 useful days and is a validity deadline (c. 1630)", () => {
    const d = createDeadline({ type: "AppealPetition", startDate: "2026-04-01" });
    assert.equal(d.computation, "Useful");
    assert.equal(d.severity, "Validity");
  });

  it("appeal prosecution = 30 continuous days (c. 1633)", () => {
    const d = createDeadline({ type: "AppealProsecution", startDate: "2026-04-10" });
    assert.equal(d.computation, "Continuous");
    assert.equal(d.severity, "Validity");
    assert.equal(d.dueDate, "2026-05-10");
  });

  it("1-year benchmark is advisory not validity (c. 1453)", () => {
    const d = createDeadline({ type: "FirstInstanceBenchmark", startDate: "2026-01-01" });
    assert.equal(d.severity, "Advisory");
    assert.equal(d.dueDate, "2027-01-01");
  });

  it("extension for closure applies only when flagged (judicial filings)", () => {
    const closed = closedDaySet([{ date: "2026-04-16", type: "Closed" }]);
    const petition = createDeadline({
      type: "AppealPetition",
      startDate: "2026-04-01",
      closedDays: closed,
    });
    assert.equal(petition.dueDate, "2026-04-17");
    assert.ok(petition.extendedForClosure);

    const benchmark = createDeadline({
      type: "FirstInstanceBenchmark",
      startDate: "2026-04-01",
      closedDays: closed,
    });
    // Benchmark has extendToOpenDay=false; no extension.
    assert.equal(benchmark.dueDate, "2027-04-01");
    assert.ok(!benchmark.extendedForClosure);
  });
});
