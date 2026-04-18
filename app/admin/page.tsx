import Link from "next/link";
import { redirect } from "next/navigation";
import { listMyOrgs, requireCurrentOrg } from "../../lib/auth.ts";
import { loadIntegration } from "../../lib/airtable/store.ts";
import { disconnectAirtable } from "./bases/actions.ts";

export const dynamic = "force-dynamic";

export default async function AdminStatusPage() {
  const memberships = await listMyOrgs();
  if (memberships.length === 0) redirect("/admin/orgs");
  const { org, role } = await requireCurrentOrg();
  const integration = await loadIntegration(org.id);

  return (
    <>
      <h1>{org.name}</h1>
      <p className="muted">
        slug <code>{org.slug}</code> · your role: <code>{role}</code>
      </p>

      <h2>Airtable connection</h2>
      {integration ? (
        <>
          <p>
            ✅ Connected as <strong>{integration.airtableUserEmail ?? "Airtable user"}</strong>
            {integration.airtableUserId ? (
              <>
                {" "}
                <code>{integration.airtableUserId}</code>
              </>
            ) : null}
          </p>
          <p className="muted">
            Scopes: {integration.scope}. Access token valid until{" "}
            {new Date(integration.expiresAt).toLocaleString()}.
          </p>
          {role === "super_admin" ? (
            <form action={disconnectAirtable}>
              <button className="danger" type="submit">
                Disconnect Airtable
              </button>
            </form>
          ) : null}
        </>
      ) : (
        <>
          <p>⛔ Not connected.</p>
          {role === "super_admin" ? (
            <p>
              <Link className="btn" href="/api/airtable/authorize">
                Connect Airtable
              </Link>
            </p>
          ) : (
            <p className="muted">Ask a super-admin of this organization to connect.</p>
          )}
        </>
      )}

      <h2>Selected base</h2>
      {integration?.selectedBase ? (
        <>
          <p>
            <strong>{integration.selectedBase.baseName}</strong>{" "}
            <code>{integration.selectedBase.baseId}</code>
          </p>
          <p className="muted">
            {integration.selectedBase.lastProvisionedAt
              ? `Last provisioned ${new Date(integration.selectedBase.lastProvisionedAt).toLocaleString()}`
              : "Not yet provisioned."}
          </p>
          <p>
            <Link className="btn secondary" href="/admin/bases">
              Change base
            </Link>
          </p>
        </>
      ) : integration ? (
        <p>
          <Link className="btn" href="/admin/bases">
            Pick or create a base
          </Link>
        </p>
      ) : (
        <p className="muted">Connect Airtable to choose a base.</p>
      )}
    </>
  );
}
