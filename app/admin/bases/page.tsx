import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentOrg } from "../../../lib/auth.ts";
import { clientForOrg } from "../../../lib/airtable/service.ts";
import { loadIntegration } from "../../../lib/airtable/store.ts";
import {
  createBase,
  provisionBase,
  seedGroundsAction,
  selectBase,
} from "./actions.ts";

export const dynamic = "force-dynamic";

export default async function BasesPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  const { org, role } = await requireCurrentOrg();
  const integration = await loadIntegration(org.id);
  if (!integration) redirect("/admin");

  let bases: Array<{ id: string; name: string; permissionLevel: string }> = [];
  let listError: string | null = null;
  try {
    const client = await clientForOrg(org.id);
    bases = await client.listBases();
  } catch (e) {
    listError = (e as Error).message;
  }

  const isSuper = role === "super_admin";
  const current = integration.selectedBase?.baseId;

  return (
    <>
      <h1>Airtable bases for {org.name}</h1>
      {searchParams.error ? <div className="flash error">{searchParams.error}</div> : null}
      {searchParams.ok ? <div className="flash">{searchParams.ok}</div> : null}
      {listError ? <div className="flash error">Could not list bases: {listError}</div> : null}

      <p>
        Pick an existing base or create a new one from the Tribunal schema. After selection, use{" "}
        <strong>Sync schema</strong> to ensure all 13 tables exist.
      </p>

      {bases.length === 0 && !listError ? (
        <p className="muted">No bases visible. Create a new one below.</p>
      ) : (
        <ul className="bases">
          {bases.map((b) => (
            <li key={b.id}>
              <div className="grow">
                <strong>{b.name}</strong> <code>{b.id}</code>
                <br />
                <span className="muted">permission: {b.permissionLevel}</span>
              </div>
              {isSuper ? (
                <form action={selectBase}>
                  <input type="hidden" name="baseId" value={b.id} />
                  <input type="hidden" name="baseName" value={b.name} />
                  <button type="submit">{current === b.id ? "Re-select" : "Select"}</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {isSuper ? (
        <>
          <h2>Create a new base from the Tribunal schema</h2>
          <form action={createBase}>
            <div className="form-row">
              <label>
                Workspace ID
                <input
                  name="workspaceId"
                  required
                  placeholder="wspXXXXXXXXXXXXXX"
                  size={30}
                />
              </label>
            </div>
            <button type="submit">Create base</button>
            <p className="muted">
              Find your workspace ID in the Airtable URL when viewing the workspace home.
              Creating a base with 13 tables takes up to ~30s.
            </p>
          </form>

          {integration.selectedBase ? (
            <>
              <h2>Provisioning</h2>
              <p>
                Selected: <strong>{integration.selectedBase.baseName}</strong>{" "}
                <code>{integration.selectedBase.baseId}</code>
              </p>
              <p className="muted">
                {integration.selectedBase.lastProvisionedAt
                  ? `Last provisioned ${new Date(
                      integration.selectedBase.lastProvisionedAt,
                    ).toLocaleString()}`
                  : "Not yet provisioned."}
              </p>
              <form action={provisionBase}>
                <button type="submit">Sync schema into this base</button>
                <span className="muted"> Adds missing tables/fields. Never deletes data.</span>
              </form>
              <form action={seedGroundsAction} style={{ marginTop: ".6rem" }}>
                <button className="secondary" type="submit">
                  Seed canonical grounds of nullity
                </button>
              </form>
            </>
          ) : null}
        </>
      ) : (
        <p className="muted">Only super-admins may select or provision bases.</p>
      )}

      <p style={{ marginTop: "2rem" }}>
        <Link href="/admin">← Back to status</Link>
      </p>
    </>
  );
}
