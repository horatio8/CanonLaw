# Canon Reference Index

Cross-reference of canons and Dignitas Connubii articles invoked in the implementation. Each entry lists the file(s) where the rule is enforced.

## Computation of time (cc. 200–203)

| Canon | Rule | Implemented |
|-------|------|-------------|
| c. 200 | Time computed per law unless otherwise stated | `src/deadlines/time.ts` |
| c. 201 §1 | Continuous time | `computeDueDate(computation: "Continuous")` |
| c. 201 §2 | Useful time suspends when person cannot act | `computeDueDate(computation: "Useful")` |
| c. 202 §1 | A day is 24 hours | all date math UTC-day-based |
| c. 202 §2 | Month = 30; year = 365 | `addCanonicalMonths`, `addCanonicalYears` |
| c. 203 §1 | Day of commencement not counted | `computeDueDate` (starts clock at start + 1) |
| c. 203 §2 | Period runs to end of final day | inclusive final-day semantics |
| c. 1467 | Extension on tribunal closure | `extendToFirstOpenDay` |

## Tribunal roles and personnel

| Canon | Rule | Implemented |
|-------|------|-------------|
| c. 1420 | Judicial Vicar | `CanonicalRole` + permissions |
| c. 1425 | Collegial tribunal of 3 | gate `ORD_6_CONSTITUTION_TO_INSTRUCTION` |
| c. 1426 | Presiding Judge | `PERMISSION_MATRIX` / `Deliberation`, `SentencePublication` |
| c. 1429 | Ponens designation | gate + `constitutionDecree` template |
| c. 1432 | Defender of the Bond mandatory | gates at Constitution and Conclusion |
| c. 1437 | Notary authentication = VALIDITY | `Act.isAuthenticated` + every merit gate |
| c. 1447 | Role incompatibilities | `src/incompatibility/rules.ts` |
| c. 1448 | Consanguinity/affinity recusal | same |
| c. 1454 | Oath of personnel | `TribunalPersonnel.oathTaken` |
| c. 1481–1490 | Advocates and procurators | `CaseRole` + permissions |

## Ordinary process (matrimonial)

| Canon | Rule | Implemented |
|-------|------|-------------|
| c. 1453 | Benchmark: 1 yr first instance, 6 mo second | `DEADLINE_CATALOG` + `dailyScan` |
| c. 1505 §2 | Rejection decree must state reasons | `rejectionDecree` template throws if missing |
| c. 1505 §4 | 10 useful days recourse vs. rejection | `DEADLINE_CATALOG.LibellusRejectionRecourse` |
| c. 1506 | Tacit admission after 1 month silence | `DEADLINE_CATALOG.TacitAdmissionLibellus` |
| c. 1509 | Notification of judicial acts | `ServiceRecord` table |
| c. 1513 §3 | 10 days to contest formula | gate `ORD_5_FORMULA_TO_CONSTITUTION` |
| c. 1592 | Decree of absence | gate `ORD_4_CITATION_TO_FORMULA` |
| c. 1598 | Publication of acts | gate `ORD_7` |
| c. 1599 | Decree of conclusion | gate `ORD_8` |
| c. 1601 | Discussion briefs | `DEADLINE_CATALOG.DiscussionBriefs` |
| c. 1609 | Sealed written conclusions | gate `ORD_10` |
| c. 1610 §2 | Ponens drafts sentence | permission matrix + template |
| c. 1611–1612 | Sentence content | `sentence` template + gate `ORD_11` |
| c. 1614 | Sentence effect from publication | gate `ORD_12` + `Case.dateSentencePublished` |
| c. 1630 | 15 useful days — appeal petition | `DEADLINE_CATALOG.AppealPetition` (VALIDITY) |
| c. 1633 | 30 continuous days — prosecute appeal | `DEADLINE_CATALOG.AppealProsecution` (VALIDITY) |
| c. 1672 | Competence | `Case.competenceBasis` + gate |
| c. 1676 §1 | Admission, 15-day respondent response | admission decree + deadline |
| c. 1676 §2 | Formula of doubt | formula decree template |
| c. 1679 | First affirmative sentence executive | gate `ORD_13` + `executiveNotice` |

## Briefer process (cc. 1683–1687)

| Canon | Rule | Implemented |
|-------|------|-------------|
| c. 1683 | Eligibility | gate `BRF_4_CITATION_TO_FORMULA` |
| c. 1685 | Instructor + assessor appointed; 30-day session | gate `BRF_6`, deadline |
| c. 1686 | 15-day DBI/party observations | deadline, gate `BRF_7` |
| c. 1687 §1 | Bishop — affirmative or remand to ordinary | transitions `BRF_8_*` |
| c. 1687 §3 | Appeal to Metropolitan or Rota | see `Tribunals.appealTribunalId` |

## Documentary process (c. 1688)

Implemented states: Intake → Preliminary Review → Admitted → Judgment → Appeal → Executive, with remand path at Preliminary Review.

## Dignitas Connubii

* DC art. 35 — personnel oath.
* DC art. 36 §3 — advocate + DBI prohibition.
* DC art. 38 — Judicial Vicar.
* DC art. 43, 46, 47 — collegial tribunal, praeses, ponens.
* DC art. 50 — auditor/instructor.
* DC art. 52 — assessor.
* DC art. 53–56 — Defender of the Bond.
* DC art. 57 — Promoter of Justice.
* DC art. 61–63 — notary.
* DC art. 66 §2 — prior-intervener bar.
* DC art. 67 — consanguinity/affinity.
* DC art. 83 — tribunal-closure extension.
* DC art. 113 — intake consultation.
* DC art. 115 §2 — oral petition.
* DC art. 116 — libellus requirements.
* DC art. 119 §2 — DBI pre-admission view.
* DC art. 119–120 — standing.
* DC art. 124 — recourse against rejection.
* DC art. 125 — tacit admission.
* DC art. 127 §4 — citation identifies tribunal.
* DC art. 138 — absence workflow.
* DC art. 229 — publication of acts.
* DC art. 237 — decree of conclusion.
* DC art. 240 — discussion briefs.
* DC art. 248 — deliberation.
* DC art. 249 §5 — sentence drafting deadline.
* DC art. 269–278 — complaint of nullity of sentence.
* DC art. 279 §2 — DBI post-sentence appeal obligation.
