/**
 * Document generation templates.
 *
 * Each template enforces the elements required by canon law for the given act
 * type. The sentence template in particular enforces cc. 1611–1612; absent a
 * required element, the validator will refuse to mark the act finalized.
 *
 * Output is plain Markdown so downstream tooling (Airtable or elsewhere) can
 * render to PDF with any print style.
 */

import type {
  ActType,
  Case,
  Ground,
  ISODate,
  Person,
  Tribunal,
} from "../types/canonical.ts";

export interface TemplateContext {
  case: Case;
  tribunal: Tribunal;
  petitioner: Person;
  respondent: Person;
  grounds: Array<Ground & { formulaText: string }>;
  /** Today. */
  dateIssued: ISODate;
  /** Signatories. Presence enforced at finalization. */
  judicialVicarName?: string;
  presidingJudgeName?: string;
  ponensName?: string;
  associateJudgeNames?: string[];
  notaryName?: string;
  dbiName?: string;
}

export interface GeneratedDocument {
  actType: ActType;
  title: string;
  markdown: string;
  requiredSignatories: string[];
}

function header(ctx: TemplateContext, title: string): string {
  return [
    `# ${title}`,
    "",
    `**Tribunal:** ${ctx.tribunal.name}`,
    `**Protocol Number:** ${ctx.case.protocolNumber}`,
    `**Petitioner:** ${ctx.petitioner.lastName}, ${ctx.petitioner.firstName}`,
    `**Respondent:** ${ctx.respondent.lastName}, ${ctx.respondent.firstName}`,
    `**Date of Marriage:** ${ctx.case.marriageDate} (${ctx.case.marriagePlace})`,
    `**Date Issued:** ${ctx.dateIssued}`,
    "",
    "---",
    "",
  ].join("\n");
}

function groundList(ctx: TemplateContext): string {
  return ctx.grounds
    .map(
      (g, i) =>
        `${i + 1}. **${g.shortName}** (${g.canonReference})${g.formulaText ? ` — ${g.formulaText}` : ""}`,
    )
    .join("\n");
}

/* ---------- Admission Decree ---------- */

export function admissionDecree(ctx: TemplateContext): GeneratedDocument {
  const md = [
    header(ctx, "Decree of Admission of the Libellus"),
    "Having examined the libellus filed in this matter, the competence of this tribunal, the standing of the petitioner, and having received the prior votum of the Defender of the Bond, in accordance with c. 1676 §1 of the Code of Canon Law as revised by *Mitis Iudex Dominus Iesus*,",
    "",
    "**IT IS DECREED** that the libellus is **ADMITTED** on the following ground(s):",
    "",
    groundList(ctx),
    "",
    "The libellus is to be communicated to the respondent, who is summoned to respond within **fifteen (15) days** of notification (c. 1676 §1). The Defender of the Bond is likewise to be notified.",
    "",
    "---",
    "",
    `_____________________________  \nJudicial Vicar${ctx.judicialVicarName ? ` — ${ctx.judicialVicarName}` : ""}`,
    "",
    `_____________________________  \nNotary${ctx.notaryName ? ` — ${ctx.notaryName}` : ""}`,
  ].join("\n");
  return {
    actType: "AdmissionDecree",
    title: `Admission Decree — ${ctx.case.protocolNumber}`,
    markdown: md,
    requiredSignatories: ["JudicialVicar", "Notary"],
  };
}

/* ---------- Rejection Decree ---------- */

export function rejectionDecree(
  ctx: TemplateContext,
  reasons: string,
): GeneratedDocument {
  if (!reasons.trim()) {
    throw new Error("Rejection decree requires stated reasons (c. 1505 §2).");
  }
  const md = [
    header(ctx, "Decree of Rejection of the Libellus"),
    "Having examined the libellus and for the reasons set out below,",
    "",
    "**IT IS DECREED** that the libellus is **REJECTED**.",
    "",
    "## Reasons for Rejection",
    "",
    reasons,
    "",
    "## Recourse",
    "",
    "The petitioner may file recourse against this decree within **ten (10) useful days** of notification, either to the college or to the appeal tribunal (c. 1505 §4; DC art. 124).",
    "",
    "---",
    "",
    `_____________________________  \nJudicial Vicar${ctx.judicialVicarName ? ` — ${ctx.judicialVicarName}` : ""}`,
    "",
    `_____________________________  \nNotary${ctx.notaryName ? ` — ${ctx.notaryName}` : ""}`,
  ].join("\n");
  return {
    actType: "RejectionDecree",
    title: `Rejection Decree — ${ctx.case.protocolNumber}`,
    markdown: md,
    requiredSignatories: ["JudicialVicar", "Notary"],
  };
}

/* ---------- Citation Decree ---------- */

export function citationDecree(ctx: TemplateContext): GeneratedDocument {
  const judges = [
    ctx.presidingJudgeName && `Presiding Judge: ${ctx.presidingJudgeName}`,
    ctx.ponensName && `Ponens: ${ctx.ponensName}`,
    ...(ctx.associateJudgeNames ?? []).map((n) => `Associate Judge: ${n}`),
    ctx.dbiName && `Defender of the Bond: ${ctx.dbiName}`,
  ].filter(Boolean) as string[];
  const md = [
    header(ctx, "Citation Decree"),
    "In the cause identified above, the respondent is hereby **summoned** to respond to the libellus and to indicate their position concerning the petition and the proposed ground(s) of nullity.",
    "",
    "The respondent must respond within **fifteen (15) days** of notification (c. 1676 §1). Failure to respond may result in a decree declaring the respondent absent under c. 1592.",
    "",
    "## Tribunal Composition (DC art. 127 §4)",
    "",
    judges.map((j) => `- ${j}`).join("\n") || "_(To be assigned at Tribunal Constitution.)_",
    "",
    "---",
    "",
    `_____________________________  \nJudicial Vicar${ctx.judicialVicarName ? ` — ${ctx.judicialVicarName}` : ""}`,
    "",
    `_____________________________  \nNotary${ctx.notaryName ? ` — ${ctx.notaryName}` : ""}`,
  ].join("\n");
  return {
    actType: "CitationDecree",
    title: `Citation Decree — ${ctx.case.protocolNumber}`,
    markdown: md,
    requiredSignatories: ["JudicialVicar", "Notary"],
  };
}

/* ---------- Formula of Doubt Decree ---------- */

export function formulaOfDoubtDecree(
  ctx: TemplateContext,
  routing: "Ordinary" | "Briefer",
): GeneratedDocument {
  const md = [
    header(ctx, "Decree Determining the Formula of the Doubt"),
    "Per c. 1676 §2, the undersigned Judicial Vicar hereby determines the formula of the doubt in this cause as follows:",
    "",
    "## Formula of Doubt",
    "",
    ctx.grounds
      .map(
        (g) =>
          `- Whether the nullity of the marriage of the parties is proven on the ground of **${g.shortName}** (${g.canonReference}).`,
      )
      .join("\n"),
    "",
    `## Process Routing`,
    "",
    routing === "Briefer"
      ? "The case is routed to the **Briefer Process Before the Bishop** under c. 1683 (eligibility: both spouses consent; nullity manifest from facts and circumstances; no detailed inquiry required)."
      : "The case proceeds by way of **Ordinary Process**.",
    "",
    "## Recourse",
    "",
    "The parties may contest this formula within **ten (10) useful days** of notification (c. 1513 §3).",
    "",
    "---",
    "",
    `_____________________________  \nJudicial Vicar${ctx.judicialVicarName ? ` — ${ctx.judicialVicarName}` : ""}`,
    "",
    `_____________________________  \nNotary${ctx.notaryName ? ` — ${ctx.notaryName}` : ""}`,
  ].join("\n");
  return {
    actType: "FormulaOfDoubtDecree",
    title: `Formula of Doubt — ${ctx.case.protocolNumber}`,
    markdown: md,
    requiredSignatories: ["JudicialVicar", "Notary"],
  };
}

/* ---------- Constitution Decree ---------- */

export function constitutionDecree(ctx: TemplateContext): GeneratedDocument {
  if (!ctx.presidingJudgeName || !ctx.ponensName || !ctx.associateJudgeNames?.length)
    throw new Error("Constitution decree requires Presiding Judge, Ponens, and at least one Associate Judge.");
  if (!ctx.dbiName) throw new Error("Constitution decree requires a Defender of the Bond.");
  if (!ctx.notaryName) throw new Error("Constitution decree requires a Notary.");
  const md = [
    header(ctx, "Decree Constituting the Collegial Tribunal"),
    "In accordance with cc. 1425, 1426, 1429 and DC arts. 43, 46, 47, the following collegial tribunal is constituted to judge this cause:",
    "",
    `- **Presiding Judge (Praeses):** ${ctx.presidingJudgeName}`,
    `- **Ponens / Relator:** ${ctx.ponensName}`,
    ...ctx.associateJudgeNames.map((n) => `- **Associate Judge:** ${n}`),
    `- **Defender of the Bond:** ${ctx.dbiName}`,
    `- **Notary:** ${ctx.notaryName}`,
    "",
    "The Ponens, designated per c. 1429, shall have special responsibility for the study of the case and for the drafting of the sentence pursuant to c. 1610 §2.",
    "",
    "---",
    "",
    `_____________________________  \nJudicial Vicar${ctx.judicialVicarName ? ` — ${ctx.judicialVicarName}` : ""}`,
    "",
    `_____________________________  \nNotary — ${ctx.notaryName}`,
  ].join("\n");
  return {
    actType: "ConstitutionDecree",
    title: `Constitution Decree — ${ctx.case.protocolNumber}`,
    markdown: md,
    requiredSignatories: ["JudicialVicar", "Notary"],
  };
}

/* ---------- Sentence (cc. 1611–1612) ---------- */

export interface SentenceArgs {
  facts: string;
  reasonsInLaw: string;
  reasonsInFact: string;
  /** Map from ground short-name to disposition. */
  dispositions: Array<{ ground: string; disposition: "Affirmative" | "Negative"; reasoning: string }>;
  /** Optional prohibition (vetitum) on remarriage. */
  vetitum?: string;
}

export function sentence(ctx: TemplateContext, args: SentenceArgs): GeneratedDocument {
  // cc. 1611–1612 checklist.
  const problems: string[] = [];
  if (!ctx.presidingJudgeName) problems.push("Presiding Judge required.");
  if (!ctx.ponensName) problems.push("Ponens required.");
  if (!ctx.associateJudgeNames?.length) problems.push("Associate Judges required.");
  if (!ctx.notaryName) problems.push("Notary required (VALIDITY — c. 1437).");
  if (!args.facts.trim()) problems.push("Statement of facts required.");
  if (!args.reasonsInLaw.trim()) problems.push("Reasons in law required (c. 1612).");
  if (!args.reasonsInFact.trim()) problems.push("Reasons in fact required (c. 1612).");
  if (!args.dispositions.length) problems.push("Dispositive response per ground required.");
  if (problems.length) throw new Error(`Cannot finalize sentence: ${problems.join(" ")}`);

  const allJudges = [
    ctx.presidingJudgeName!,
    ctx.ponensName!,
    ...ctx.associateJudgeNames!,
  ];

  const md = [
    header(ctx, "Definitive Sentence"),
    "## Tribunal and Parties",
    "",
    `Before this ${ctx.tribunal.name}, composed of:`,
    "",
    ...allJudges.map((j) => `- ${j}`),
    "",
    `Defender of the Bond: ${ctx.dbiName ?? "_(not recorded)_"}  `,
    `Notary: ${ctx.notaryName!}`,
    "",
    "In the cause of the petitioner and respondent named above, concerning the marriage identified above.",
    "",
    "## Formula of Doubt",
    "",
    ctx.case.formulaOfDoubt ?? ctx.grounds.map((g) => `- ${g.shortName} (${g.canonReference})`).join("\n"),
    "",
    "## Facts of the Case",
    "",
    args.facts,
    "",
    "## Reasons in Law",
    "",
    args.reasonsInLaw,
    "",
    "## Reasons in Fact",
    "",
    args.reasonsInFact,
    "",
    "## Dispositive",
    "",
    ...args.dispositions.map(
      (d) =>
        `### On the ground of ${d.ground}\n\n**${d.disposition.toUpperCase()}** — it is proven${d.disposition === "Negative" ? " that the nullity of this marriage is NOT" : " that the nullity of this marriage IS"} established on this ground.\n\n${d.reasoning}`,
    ),
    "",
    args.vetitum ? `## Vetitum\n\n${args.vetitum}` : "",
    "",
    "---",
    "",
    "## Signatures (c. 1612 §4; c. 1437)",
    "",
    ...allJudges.map((j) => `_____________________________  \n${j}, Judge\n`),
    "",
    `_____________________________  \n${ctx.notaryName!}, Notary (VALIDITY — c. 1437)`,
    "",
    `**Date:** ${ctx.dateIssued}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    actType: "FinalSentence",
    title: `Sentence — ${ctx.case.protocolNumber}`,
    markdown: md,
    requiredSignatories: ["PresidingJudge", "Ponens", "AssociateJudge", "Notary"],
  };
}

/* ---------- Executive Status Notice ---------- */

export function executiveNotice(ctx: TemplateContext, vetitum?: string): GeneratedDocument {
  const md = [
    header(ctx, "Executive Status Notice"),
    "Pursuant to c. 1679 as revised by *Mitis Iudex Dominus Iesus*, the appeal terms having elapsed without appeal, the sentence declaring the nullity of the marriage identified above has become **EXECUTIVE**.",
    "",
    "The parties are free to enter new marriage, subject to any prohibition (vetitum) stated below.",
    "",
    vetitum ? `## Vetitum\n\n${vetitum}` : "No vetitum has been imposed.",
    "",
    "Notification is directed to the parish of marriage and the parish(es) of baptism of the parties for annotation in the sacramental registers.",
    "",
    "---",
    "",
    `_____________________________  \nJudicial Vicar${ctx.judicialVicarName ? ` — ${ctx.judicialVicarName}` : ""}`,
    "",
    `_____________________________  \nNotary${ctx.notaryName ? ` — ${ctx.notaryName}` : ""}`,
  ].join("\n");
  return {
    actType: "ExecutiveStatusNotice",
    title: `Executive Status Notice — ${ctx.case.protocolNumber}`,
    markdown: md,
    requiredSignatories: ["JudicialVicar", "Notary"],
  };
}
