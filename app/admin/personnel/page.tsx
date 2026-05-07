import { requireCurrentOrg } from "../../../lib/auth.ts";
import { listPersonnel, listPersons } from "../../../lib/airtable/cases.ts";
import { loadIntegration } from "../../../lib/airtable/store.ts";
import Link from "next/link";
import { createPersonAction } from "./actions.ts";

export const dynamic = "force-dynamic";

export default async function PersonnelPage() {
  const { org } = await requireCurrentOrg();
  const state = await loadIntegration(org.id);

  if (!state?.selectedBase) {
    return (
      <section>
        <h2>Personnel</h2>
        <p>
          No Airtable base connected.{" "}
          <Link href="/admin/bases">Connect and provision a base</Link> first.
        </p>
      </section>
    );
  }

  let personnel: Awaited<ReturnType<typeof listPersonnel>>;
  let persons: Awaited<ReturnType<typeof listPersons>>;
  try {
    [personnel, persons] = await Promise.all([
      listPersonnel(org.id),
      listPersons(org.id),
    ]);
  } catch (e) {
    return (
      <section>
        <h2>Personnel</h2>
        <p className="error">Failed to load: {(e as Error).message}</p>
      </section>
    );
  }

  // Build a person name lookup
  const personMap = new Map(persons.map((p: { _recordId: string; firstName: string; lastName: string }) => [p._recordId, `${p.firstName} ${p.lastName}`]));

  return (
    <section>
      <h2>Tribunal Personnel ({personnel.length})</h2>

      {personnel.length === 0 ? (
        <p>No personnel records yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Canonical Role</th>
              <th>Active</th>
              <th>Oath Taken</th>
              <th>Appointment Date</th>
            </tr>
          </thead>
          <tbody>
            {personnel.map((p) => (
              <tr key={p._recordId}>
                <td>{personMap.get(p.personId) ?? p.personId}</td>
                <td>{p.canonicalRole}</td>
                <td>{p.active ? "✓" : "—"}</td>
                <td>{p.oathTaken ? "✓" : "⚠ No"}</td>
                <td>{p.appointmentDate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <hr />

      <h3>Persons Directory ({persons.length})</h3>
      {persons.length === 0 ? (
        <p>No persons in directory.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Types</th>
              <th>Email</th>
              <th>Record ID</th>
            </tr>
          </thead>
          <tbody>
            {persons.map((p) => (
              <tr key={p._recordId}>
                <td>{p.titlePrefix ? `${p.titlePrefix} ` : ""}{p.firstName} {p.lastName}</td>
                <td>{p.personTypes.join(", ")}</td>
                <td>{p.email ?? "—"}</td>
                <td className="muted" style={{ fontSize: "0.75em" }}>{p._recordId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <hr />

      <details>
        <summary>Add New Person</summary>
        <form action={createPersonAction}>
          <label>
            First Name
            <input type="text" name="firstName" required />
          </label>
          <label>
            Last Name
            <input type="text" name="lastName" required />
          </label>
          <label>
            Title/Prefix
            <select name="titlePrefix">
              <option value="">— None —</option>
              <option value="Mr">Mr</option>
              <option value="Mrs">Mrs</option>
              <option value="Ms">Ms</option>
              <option value="Rev">Rev</option>
              <option value="Rev Mr">Rev Mr</option>
              <option value="Msgr">Msgr</option>
              <option value="Most Rev">Most Rev</option>
            </select>
          </label>
          <label>
            Email
            <input type="email" name="email" />
          </label>
          <label>
            Phone
            <input type="tel" name="phone" />
          </label>
          <label>
            Person Types (hold Ctrl/Cmd to multi-select)
            <select name="personTypes" multiple required>
              <option value="Petitioner">Petitioner</option>
              <option value="Respondent">Respondent</option>
              <option value="Witness">Witness</option>
              <option value="Expert">Expert</option>
              <option value="Guardian">Guardian</option>
            </select>
          </label>
          <button type="submit">Add Person</button>
        </form>
      </details>
    </section>
  );
}
