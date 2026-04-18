"use server";

import { redirect } from "next/navigation";
import { requireSuperAdmin } from "../../../lib/auth.ts";
import { clientForOrg } from "../../../lib/airtable/service.ts";
import {
  clearIntegration,
  loadIntegration,
  saveBase,
} from "../../../lib/airtable/store.ts";
import {
  provisionExistingBase,
  provisionNewBase,
  seedGrounds,
} from "../../../src/airtable/provisioner.ts";

function ok(message: string): never {
  redirect(`/admin/bases?ok=${encodeURIComponent(message)}`);
}
function err(message: string): never {
  redirect(`/admin/bases?error=${encodeURIComponent(message)}`);
}

export async function selectBase(formData: FormData): Promise<void> {
  const { org } = await requireSuperAdmin();
  const baseId = String(formData.get("baseId") ?? "");
  const baseName = String(formData.get("baseName") ?? "");
  if (!baseId || !baseName) err("Missing base id or name.");
  const existing = await loadIntegration(org.id);
  // If re-selecting the same base, keep the known tableIds.
  const tableIds =
    existing?.selectedBase?.baseId === baseId ? existing.selectedBase.tableIds : {};
  await saveBase({ orgId: org.id, baseId, baseName, tableIds });
  ok(`Selected "${baseName}".`);
}

export async function createBase(formData: FormData): Promise<void> {
  const { org } = await requireSuperAdmin();
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  if (!workspaceId) err("Workspace ID is required.");
  try {
    const client = await clientForOrg(org.id);
    const result = await provisionNewBase(client, workspaceId);
    await saveBase({
      orgId: org.id,
      baseId: result.baseId,
      baseName: result.baseName,
      tableIds: result.tableIds,
      lastProvisionedAt: Date.now(),
    });
    ok(
      `Created base "${result.baseName}" with ${result.createdTables.length} tables.`,
    );
  } catch (e) {
    err((e as Error).message);
  }
}

export async function provisionBase(): Promise<void> {
  const { org } = await requireSuperAdmin();
  const state = await loadIntegration(org.id);
  if (!state?.selectedBase) err("Select a base first.");
  try {
    const client = await clientForOrg(org.id);
    const result = await provisionExistingBase(client, state!.selectedBase!.baseId);
    await saveBase({
      orgId: org.id,
      baseId: state!.selectedBase!.baseId,
      baseName: state!.selectedBase!.baseName,
      tableIds: result.tableIds,
      lastProvisionedAt: Date.now(),
    });
    ok(
      `Synced: ${result.createdTables.length} new table(s), ${result.addedFields.length} new field(s), ${result.preexistingTables.length} pre-existing table(s).`,
    );
  } catch (e) {
    err((e as Error).message);
  }
}

export async function seedGroundsAction(): Promise<void> {
  const { org } = await requireSuperAdmin();
  const state = await loadIntegration(org.id);
  if (!state?.selectedBase) err("Select a base first.");
  if (!state!.selectedBase!.tableIds["Grounds of Nullity"]) {
    err("Run 'Sync schema' first so the Grounds of Nullity table exists.");
  }
  try {
    const client = await clientForOrg(org.id);
    const result = await seedGrounds(
      client,
      state!.selectedBase!.baseId,
      state!.selectedBase!.tableIds,
    );
    ok(`Inserted ${result.inserted} grounds of nullity.`);
  } catch (e) {
    err((e as Error).message);
  }
}

export async function disconnectAirtable(): Promise<void> {
  const { org } = await requireSuperAdmin();
  await clearIntegration(org.id);
  redirect("/admin");
}
