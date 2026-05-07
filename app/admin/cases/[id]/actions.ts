"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOrg } from "../../../../lib/auth.ts";
import { updateCaseStatus, createAct, authenticateAct } from "../../../../lib/airtable/cases.ts";
import type { AnyState } from "../../../../src/types/canonical.ts";

export async function advanceCase(formData: FormData) {
  const { org } = await requireCurrentOrg();
  const caseRecordId = formData.get("caseRecordId") as string;
  const targetState = formData.get("targetState") as AnyState;

  // Determine which date field to set based on target state
  const dateFields: Record<string, string> = {};
  const today = new Date().toISOString().split("T")[0]!;

  const dateMap: Partial<Record<AnyState, string>> = {
    Admitted: "Date Admitted",
    FormulaOfDoubt: "Date of Formula",
    FormulaBrieferRouting: "Date of Formula",
    Instruction: "Date Instruction Opened",
    PublicationOfActs: "Date Publication Decree",
    ConclusionAndDiscussion: "Date Conclusion Decree",
    SentencePublication: "Date Sentence Published",
    SentenceDrafting: "Date Sentence",
    Executive: "Date Executive",
  };

  if (dateMap[targetState]) {
    dateFields[dateMap[targetState]!] = today;
  }

  await updateCaseStatus(org.id, caseRecordId, targetState, dateFields);
  revalidatePath(`/admin/cases/${caseRecordId}`);
}

export async function createActAction(formData: FormData) {
  const { org } = await requireCurrentOrg();
  const caseRecordId = formData.get("caseRecordId") as string;
  const actType = formData.get("actType") as string;
  const actCategory = formData.get("actCategory") as string;
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;
  const createdByPersonnelId = formData.get("createdByPersonnelId") as string;

  await createAct(org.id, {
    caseRecordId,
    actType,
    actCategory,
    title,
    content,
    createdByPersonnelId,
  });

  revalidatePath(`/admin/cases/${caseRecordId}`);
}

export async function authenticateActAction(formData: FormData) {
  const { org } = await requireCurrentOrg();
  const actRecordId = formData.get("actRecordId") as string;
  const caseRecordId = formData.get("caseRecordId") as string;

  // For now, we use a placeholder notary ID. In production, this would be
  // the current user's personnel record.
  // TODO: resolve the current user → personnel record mapping
  await authenticateAct(org.id, actRecordId, "NOTARY_PLACEHOLDER");

  revalidatePath(`/admin/cases/${caseRecordId}`);
}