"use server";

import { redirect } from "next/navigation";
import { requireCurrentOrg } from "../../../../lib/auth.ts";
import { createCase } from "../../../../lib/airtable/cases.ts";
import type { ProcessType } from "../../../../src/types/canonical.ts";

export async function createNewCase(formData: FormData) {
  const { org } = await requireCurrentOrg();

  const protocolNumber = formData.get("protocolNumber") as string;
  const processType = formData.get("processType") as ProcessType;
  const marriageDate = formData.get("marriageDate") as string;
  const marriagePlace = formData.get("marriagePlace") as string;
  const petitionerId = formData.get("petitionerId") as string;
  const respondentId = formData.get("respondentId") as string;
  const dioceseOfCelebrationId = formData.get("dioceseOfCelebrationId") as string;
  const tribunalId = formData.get("tribunalId") as string;
  const competenceBasis = (formData.get("competenceBasis") as string) || "";
  const competenceNotes = (formData.get("competenceNotes") as string) || "";

  const args: Parameters<typeof createCase>[1] = {
    protocolNumber,
    processType,
    petitionerId,
    respondentId,
    marriageDate,
    marriagePlace,
    dioceseOfCelebrationId,
    tribunalId,
  };
  if (competenceBasis) args.competenceBasis = competenceBasis;
  if (competenceNotes) args.competenceNotes = competenceNotes;

  const id = await createCase(org.id, args);

  redirect(`/admin/cases/${id}`);
}