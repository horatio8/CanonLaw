# Architecture Notes

## Layering

```
            ┌─────────────────────────────────────────────┐
            │        Presentation (Airtable / app)        │
            │  Interface pages, dashboards, buttons       │
            └────────────────────┬────────────────────────┘
                                 │ calls
            ┌────────────────────▼────────────────────────┐
            │         Canon engines (this repo)           │
            │  Role matrix • State gates • Deadlines •    │
            │  Incompatibility • Document generation •    │
            │  Automation recipes                          │
            └────────────────────┬────────────────────────┘
                                 │ reads / writes
            ┌────────────────────▼────────────────────────┐
            │   Persistence (Airtable base per schema)    │
            │   13 tables; Acts are first-class objects   │
            └─────────────────────────────────────────────┘
```

The engine layer holds zero persistence logic. Every gate function takes a `CaseSnapshot` — an in-memory aggregate assembled by the caller. Every automation recipe returns a list of `SideEffect` values the caller applies. This keeps the canonical rules fast to test and transport-agnostic.

## Why "acts" not "files"

Spec §7 / §8 treat every procedural act as a first-class object with an authentication flag tied to c. 1437 validity. Storing acts as plain file attachments loses the marker the whole system depends on: the notary-signature bit. The `Acts` table therefore records `actType`, `isAuthenticated`, `authenticatedByNotaryPersonnelId`, `dateAuthenticated`, and the protocol page number. The attachment is an associated field, not the identity.

## Validity, procedural, advisory

Deadlines and gate failures carry one of three severities:

* **Validity** — red. A failure here risks the nullity of the resulting act (e.g. sentence without notary signature). Transitions are hard-blocked.
* **Procedural** — amber. A failure breaches procedure but does not automatically invalidate. The system records the deviation on the audit log.
* **Advisory** — yellow. Pastoral benchmarks such as the one-year recommendation of c. 1453.

Gates surface these in the same language. Failures from a gate are human-readable strings that the UI can display unmodified.

## Two-layer time

Canonical time (cc. 200–203) is computed by the pure engine in `deadlines/time.ts`. The tribunal's own holidays and reduced-hours days come from the `Tribunal Calendar` table. The engine accepts both — tribunal closures apply as an extension per c. 1467 only to deadlines whose catalog entry flags `extendToOpenDay: true`. A validity-flagged appeal petition extends; a purely continuous advisory benchmark does not.

Useful time accepts a `unavailableDays` set for the party — periods they were documented unaware or unable to act. This data comes from the case file; the engine simply honors it.

## State-machine discipline

Each process (Ordinary / Briefer / Documentary) has its own state list and transition table. Transitions declare a `gate` identifier; gates are registered in `gates.ts`. A state is never implicitly entered — the caller passes a `TransitionAttempt` with the from-state matching `case.caseStatus`. Mismatches fail fast with the message "Case is in state X, not Y."

## Incompatibilities at assignment time

The assignment flow is:

1. User proposes assignment (case, person, roleInCase).
2. App assembles `IncompatibilityContext` from Persons, Case Assignments, and any recorded relationship degree.
3. App calls `checkIncompatibilities`.
4. Empty result → write the assignment. Non-empty → hard error, display each violation's canon and message.

There is no override. Delegation and recusal changes must be recorded as new assignments (dateRemoved on the prior one).

## Sentence lifecycle

1. Ponens drafts via `sentence(ctx, args)` — this throws if cc. 1611–1612 elements are missing or signatories not designated.
2. Associate judges approve.
3. Notary signs → `isAuthenticated = true`. This flips the sentence from draft to valid.
4. `canTransition(..., "ORD_11_SENTENCE_DRAFT_TO_PUBLICATION", snap)` checks validity and content.
5. Publication decree sets `dateSentencePublished`.
6. `onSentencePublished` automation creates AppealPetition deadline and DBI post-sentence task.

## DBI post-sentence obligation

Per DC art. 279 §2, the DBI must appeal an affirmative sentence if insufficiently founded — or file a signed non-appeal statement. The automation recipe `onSentencePublished` creates this task with the AppealPetition due-date. The `ORD_13_APPEAL_TO_EXECUTIVE` gate refuses to advance until `dbiPostSentenceDecisionFiled === true`.

## Testability

Pure functions everywhere. Every engine module is covered by `node:test`:

```
tests/deadlines.test.ts       — c. 200–203 primitives + catalog
tests/gates.test.ts           — representative hard-stop transitions
tests/incompatibility.test.ts — c. 1447 / 1448 / DC art. 66–67
tests/permissions.test.ts     — role × state × action matrix
tests/documents.test.ts       — cc. 1505 §2, 1611–1612
tests/state-machine.test.ts   — 14/8/6 transition tables
tests/automations.test.ts     — recipe side-effects
```

Run with `npm test`. Typecheck with `npm run typecheck`.
