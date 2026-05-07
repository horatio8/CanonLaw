import Link from "next/link";
import { requireCurrentOrg } from "../../../lib/auth.ts";
import { listCases } from "../../../lib/airtable/cases.ts";
import { loadIntegration } from "../../../lib/airtable/store.ts";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const { org } = await requireCurrentOrg();
  const state = await loadIntegration(org.id);

  if (!state?.selectedBase) {
    return (
      <section>
        <h2>Cases</h2>
        <p>
          No Airtable base connected.{" "}
          <Link href="/admin/bases">Connect and provision a base</Link> to start
          managing cases.
        </p>
      </section>
    );
  }

  let cases: Awaited<ReturnType<typeof listCases>>;
  try {
    cases = await listCases(org.id);
  } catch (e) {    return (
      <section>
        <h2>Cases</h2>
        <p className="error">Failed to load cases: {(e as Error).message}</p>
      </section>
    );
  }

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Cases ({cases.length})</h2>
        <Link href="/admin/cases/new">
          <button>+ New Case</button>
        </Link>
      </div>

      {cases.length === 0 ? (
        <p>No cases yet. Create a new case to get started.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Protocol</th>
              <th>Process</th>
              <th>Status</th>
              <th>Date Filed</th>
              <th>Appeal</th>
            </tr>
          </thead>          <tbody>
            {cases.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/cases/${c.id}`}>
                    {c.protocolNumber || "(no protocol)"}
                  </Link>
                </td>
                <td>{c.processType}</td>
                <td>{c.caseStatus}</td>
                <td>{c.dateFiled ?? "—"}</td>
                <td>{c.appealStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}