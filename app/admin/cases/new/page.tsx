import { requireCurrentOrg } from "../../../../lib/auth.ts";
import { loadIntegration } from "../../../../lib/airtable/store.ts";
import { redirect } from "next/navigation";
import { createNewCase } from "./actions.ts";

export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  const { org } = await requireCurrentOrg();
  const state = await loadIntegration(org.id);
  if (!state?.selectedBase) redirect("/admin/bases");

  return (
    <section>
      <h2>New Case</h2>
      <form action={createNewCase}>
        <fieldset>
          <legend>Case Details</legend>

          <label>
            Protocol Number
            <input type="text" name="protocolNumber" placeholder="e.g. 2026/001" required />
          </label>

          <label>
            Process Type
            <select name="processType" required>
              <option value="Ordinary">Ordinary</option>              <option value="Briefer">Briefer</option>
              <option value="Documentary">Documentary</option>
            </select>
          </label>

          <label>
            Marriage Date
            <input type="date" name="marriageDate" required />
          </label>

          <label>
            Marriage Place
            <input type="text" name="marriagePlace" required />
          </label>

          <label>
            Competence Basis
            <select name="competenceBasis">
              <option value="">— Select —</option>
              <option value="PlaceOfCelebration">Place of Celebration</option>
              <option value="DomicilePetitioner">Domicile — Petitioner</option>
              <option value="DomicileRespondent">Domicile — Respondent</option>
              <option value="DomicileBoth">Domicile — Both</option>
              <option value="PlaceOfProofs">Place of Proofs</option>
            </select>
          </label>

          <label>
            Competence Notes (required if Place of Proofs)
            <textarea name="competenceNotes" rows={2} />
          </label>
        </fieldset>
        <fieldset>
          <legend>Parties (enter Airtable record IDs or create persons first)</legend>

          <label>
            Petitioner Record ID
            <input type="text" name="petitionerId" required />
          </label>

          <label>
            Respondent Record ID
            <input type="text" name="respondentId" required />
          </label>
        </fieldset>

        <fieldset>
          <legend>Tribunal</legend>

          <label>
            Diocese of Celebration Record ID
            <input type="text" name="dioceseOfCelebrationId" required />
          </label>

          <label>
            Assigned Tribunal Record ID
            <input type="text" name="tribunalId" required />
          </label>
        </fieldset>

        <button type="submit">Create Case</button>
      </form>
    </section>
  );
}