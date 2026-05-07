import Link from "next/link";
import { requireCurrentOrg } from "../../../../lib/auth.ts";
import { getCase, listActsForCase, listAssignmentsForCase, listDeadlinesForCase } from "../../../../lib/airtable/cases.ts";
import { allowedNextStates } from "../../../../src/state-machine/states.ts";
import { advanceCase, createActAction, authenticateActAction } from "./actions.ts";
import type { ProcessType } from "../../../../src/types/canonical.ts";
import type { CaseDetail } from "../../../../lib/airtable/cases.ts";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  const { org } = await requireCurrentOrg();

  let caseData: Awaited<ReturnType<typeof getCase>>;
  try {
    caseData = await getCase(org.id, params.id);
  } catch (e) {
    return (
      <section>
        <p className="error">Failed to load case: {(e as Error).message}</p>
        <Link href="/admin/cases">← Back to cases</Link>
      </section>
    );
  }

  const [acts, assignments, deadlines] = await Promise.all([
    listActsForCase(org.id, params.id),
    listAssignmentsForCase(org.id, params.id),
    listDeadlinesForCase(org.id, params.id),
  ]);

  const nextStates = allowedNextStates(caseData.processType as ProcessType, caseData.caseStatus);

  return (
    <section>
      <Link href="/admin/cases">← Back to cases</Link>

      <h2>
        Case {caseData.protocolNumber}{" "}
        <span className="muted">({caseData.processType})</span>
      </h2>

      {/* Status + Advance Controls */}
      <div style={{ border: "1px solid var(--border)", padding: "1rem", marginBottom: "1.5rem" }}>
        <h3>
          Status: <strong>{caseData.caseStatus}</strong>
        </h3>
        {nextStates.length > 0 && (
          <div>
            <p style={{ marginBottom: "0.5rem" }}>Advance case to:</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {nextStates.map((ns) => (
                <form key={ns.gate} action={advanceCase}>
                  <input type="hidden" name="caseRecordId" value={params.id} />
                  <input type="hidden" name="targetState" value={ns.state} />
                  <input type="hidden" name="gate" value={ns.gate} />
                  <button type="submit" title={`Gate: ${ns.gate}`}>
                    {ns.label}
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}
        {nextStates.length === 0 && caseData.caseStatus === "Executive" && (
          <p className="muted">Case is in terminal state (Executive).</p>
        )}
      </div>

      {/* Case Data */}
      <details open>
        <summary>Case Details</summary>
        <table>
          <tbody>
            <tr><td>Marriage Date</td><td>{caseData.marriageDate}</td></tr>
            <tr><td>Marriage Place</td><td>{caseData.marriagePlace}</td></tr>
            <tr><td>Competence Basis</td><td>{caseData.competenceBasis ?? "—"}</td></tr>
            <tr><td>Formula of Doubt</td><td>{caseData.formulaOfDoubt ?? "—"}</td></tr>
            <tr><td>Appeal Status</td><td>{caseData.appealStatus}</td></tr>
            <tr><td>Date Filed</td><td>{caseData.dateFiled}</td></tr>
            <tr><td>Date Admitted</td><td>{caseData.dateAdmitted ?? "—"}</td></tr>
            <tr><td>Date Sentence</td><td>{caseData.dateSentence ?? "—"}</td></tr>
            <tr><td>Date Executive</td><td>{caseData.dateExecutive ?? "—"}</td></tr>
            <tr><td>1-Year Benchmark</td><td>{caseData.oneYearBenchmarkFlag ? "⚠ Yes" : "No"}</td></tr>
            <tr><td>Notes</td><td>{caseData.notes ?? "—"}</td></tr>
          </tbody>
        </table>
      </details>

      {/* Assignments */}
      <details open>
        <summary>Case Assignments ({assignments.length})</summary>
        {assignments.length === 0 ? (
          <p className="muted">No assignments yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Personnel ID</th>
                <th>Date Assigned</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a._recordId}>
                  <td>{a.roleInCase}</td>
                  <td>{a.personnelId}</td>
                  <td>{a.dateAssigned}</td>
                  <td>{a.activeOnCase ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>

      {/* Deadlines */}
      <details open>
        <summary>Deadlines ({deadlines.length})</summary>
        {deadlines.length === 0 ? (
          <p className="muted">No deadlines set.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {deadlines.map((d) => (
                <tr key={d._recordId} style={d.status === "Expired" ? { color: "red" } : undefined}>
                  <td>{d.deadlineType}</td>
                  <td>{d.dueDate}</td>
                  <td>{d.status}</td>
                  <td>{d.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>

      {/* Acts */}
      <details open>
        <summary>Acts ({acts.length})</summary>
        {acts.length === 0 ? (
          <p className="muted">No acts on file.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Date</th>
                <th>Auth?</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {acts.map((act) => (
                <tr key={act._recordId}>
                  <td>{act.actType}</td>
                  <td>{act.title}</td>
                  <td>{act.dateCreated}</td>
                  <td>{act.isAuthenticated ? "✓ Notarized" : "⚠ Pending"}</td>
                  <td>
                    {!act.isAuthenticated && (
                      <form action={authenticateActAction} style={{ display: "inline" }}>
                        <input type="hidden" name="actRecordId" value={act._recordId} />
                        <input type="hidden" name="caseRecordId" value={params.id} />
                        <button type="submit" className="secondary" style={{ fontSize: "0.8em" }}>
                          Authenticate
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Create new act */}
        <details style={{ marginTop: "1rem" }}>
          <summary>Create New Act</summary>
          <form action={createActAction}>
            <input type="hidden" name="caseRecordId" value={params.id} />
            <label>
              Act Type
              <select name="actType" required>
                <option value="Libellus">Libellus</option>
                <option value="AdmissionDecree">Admission Decree</option>
                <option value="RejectionDecree">Rejection Decree</option>
                <option value="CitationDecree">Citation Decree</option>
                <option value="FormulaOfDoubtDecree">Formula of Doubt Decree</option>
                <option value="ConstitutionDecree">Constitution Decree</option>
                <option value="PartyExamination">Party Examination</option>
                <option value="WitnessExamination">Witness Examination</option>
                <option value="DocumentaryExhibit">Documentary Exhibit</option>
                <option value="ExpertReport">Expert Report</option>
                <option value="PublicationDecree">Publication Decree</option>
                <option value="DecreeOfConclusion">Decree of Conclusion</option>
                <option value="DBIObservations">DBI Observations</option>
                <option value="PartyBrief">Party Brief</option>
                <option value="FinalSentence">Final Sentence</option>
                <option value="ExecutiveStatusNotice">Executive Status Notice</option>
              </select>
            </label>
            <label>
              Category
              <select name="actCategory" required>
                <option value="Procedural">Procedural</option>
                <option value="Merits">Merits</option>
                <option value="Administrative">Administrative</option>
              </select>
            </label>
            <label>
              Title
              <input type="text" name="title" required />
            </label>
            <label>
              Content
              <textarea name="content" rows={4} required />
            </label>
            <label>
              Created By (Personnel Record ID)
              <input type="text" name="createdByPersonnelId" required />
            </label>
            <button type="submit">Create Act</button>
          </form>
        </details>
      </details>
    </section>
  );
}
