"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOrg } from "../../../lib/auth.ts";
import { createPerson } from "../../../lib/airtable/cases.ts";

export async function createPersonAction(formData: FormData) {
  const { org } = await requireCurrentOrg();

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const titlePrefix = (formData.get("titlePrefix") as string) || "";
  const email = (formData.get("email") as string) || "";
  const phone = (formData.get("phone") as string) || "";
  const personTypes = formData.getAll("personTypes") as string[];

  const args: Parameters<typeof createPerson>[1] = {
    firstName,
    lastName,
    personTypes,
  };
  if (titlePrefix) args.titlePrefix = titlePrefix;
  if (email) args.email = email;
  if (phone) args.phone = phone;

  await createPerson(org.id, args);

  revalidatePath("/admin/personnel");
}