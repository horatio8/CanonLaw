import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  admissionDecree,
  citationDecree,
  constitutionDecree,
  formulaOfDoubtDecree,
  rejectionDecree,
  sentence,
  executiveNotice,
  type TemplateContext,
} from "../src/documents/templates.ts";
import type { Case, Ground, Person, Tribunal } from "../src/types/canonical.ts";

const petitioner: Person = {
  id: "p1",
  firstName: "Maria",
  lastName: "Rossi",
  canonicalStatus: "Catholic",
  personTypes: ["Petitioner"],
};
const respondent: Person = {
  id: "p2",
  firstName: "Luca",
  lastName: "Bianchi",
  canonicalStatus: "Catholic",
  personTypes: ["Respondent"],
};
const tribunal: Tribunal = {
  id: "t1",
  name: "Tribunal of the Diocese of Springfield",
  type: "Diocesan",
  instanceLevel: 1,
};
const grounds: Array<Ground & { formulaText: string }> = [
  {
    id: "g1",
    canonReference: "c. 1095, 2°",
    shortName: "Grave defect of discretion of judgment",
    category: "DefectOfConsent",
    description: "...",
    expertUsuallyRequired: true,
    formulaText: "Whether the petitioner's defect of discretion is proven.",
  },
];
const c: Case = {
  id: "case_1",
  protocolNumber: "2026/001",
  processType: "Ordinary",
  caseStatus: "PreAdmissionReview",
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
};

const ctx: TemplateContext = {
  case: c,
  tribunal,
  petitioner,
  respondent,
  grounds,
  dateIssued: "2026-02-15",
  judicialVicarName: "Rev. John Doe",
  notaryName: "Mr. Alan Smith",
};

describe("document templates", () => {
  it("admission decree contains protocol and 15-day response period", () => {
    const doc = admissionDecree(ctx);
    assert.match(doc.markdown, /2026\/001/);
    assert.match(doc.markdown, /fifteen \(15\) days/);
    assert.match(doc.markdown, /c\. 1676/);
  });

  it("rejection decree requires reasons (c. 1505 §2)", () => {
    assert.throws(() => rejectionDecree(ctx, ""), /reasons/i);
    const doc = rejectionDecree(ctx, "Libellus lacks any credible foundation in law or fact.");
    assert.match(doc.markdown, /ten \(10\) useful days/);
  });

  it("citation decree includes tribunal composition per DC art. 127 §4", () => {
    const withJudges = {
      ...ctx,
      presidingJudgeName: "Rev. A",
      ponensName: "Rev. B",
      associateJudgeNames: ["Rev. C"],
      dbiName: "Rev. D",
    };
    const doc = citationDecree(withJudges);
    assert.match(doc.markdown, /Presiding Judge: Rev\. A/);
    assert.match(doc.markdown, /Ponens: Rev\. B/);
    assert.match(doc.markdown, /Defender of the Bond: Rev\. D/);
  });

  it("formula decree routes ordinary vs briefer", () => {
    const ord = formulaOfDoubtDecree(ctx, "Ordinary");
    const brf = formulaOfDoubtDecree(ctx, "Briefer");
    assert.match(ord.markdown, /Ordinary Process/);
    assert.match(brf.markdown, /Briefer Process Before the Bishop/);
    assert.match(brf.markdown, /c\. 1683/);
  });

  it("constitution decree requires Ponens and associates", () => {
    assert.throws(() => constitutionDecree(ctx), /Presiding Judge/);
    const full = constitutionDecree({
      ...ctx,
      presidingJudgeName: "Rev. A",
      ponensName: "Rev. B",
      associateJudgeNames: ["Rev. C"],
      dbiName: "Rev. D",
      notaryName: "Mr. Alan Smith",
    });
    assert.match(full.markdown, /Ponens \/ Relator/);
  });

  it("sentence enforces cc. 1611–1612 elements", () => {
    assert.throws(() =>
      sentence(ctx, {
        facts: "",
        reasonsInLaw: "...",
        reasonsInFact: "...",
        dispositions: [{ ground: "c. 1095, 2°", disposition: "Affirmative", reasoning: "..." }],
      }),
    );
    const doc = sentence(
      {
        ...ctx,
        presidingJudgeName: "Rev. A",
        ponensName: "Rev. B",
        associateJudgeNames: ["Rev. C"],
        dbiName: "Rev. D",
        notaryName: "Mr. Alan Smith",
      },
      {
        facts: "The parties married on 2015-06-15.",
        reasonsInLaw: "Canon 1095, 2° requires...",
        reasonsInFact: "The proofs demonstrate...",
        dispositions: [
          {
            ground: "c. 1095, 2°",
            disposition: "Affirmative",
            reasoning: "The petitioner lacked due discretion.",
          },
        ],
      },
    );
    assert.match(doc.markdown, /VALIDITY — c\. 1437/);
    assert.match(doc.markdown, /AFFIRMATIVE/);
  });

  it("executive notice references c. 1679", () => {
    const doc = executiveNotice(ctx, "The petitioner must complete psychological counseling before new marriage.");
    assert.match(doc.markdown, /c\. 1679/);
    assert.match(doc.markdown, /Vetitum/);
  });
});
