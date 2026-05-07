import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { listMyOrgs, requireUser } from "../../lib/auth.ts";
import { signOut } from "../login/actions.ts";
import { switchOrg } from "./actions.ts";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const memberships = await listMyOrgs();
  const cookieOrg = cookies().get("org")?.value;
  const currentOrgId =
    memberships.find((m) => m.org.id === cookieOrg)?.org.id ?? memberships[0]?.org.id;

  return (
    <main>
      <nav>
        <div>
          <Link href="/admin">Status</Link>
          <Link href="/admin/cases">Cases</Link>
          <Link href="/admin/personnel">Personnel</Link>
          <Link href="/admin/bases">Bases</Link>
          <Link href="/admin/orgs">Organizations</Link>
        </div>        <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
          {memberships.length > 1 && currentOrgId ? (
            <form action={switchOrg}>
              <select name="orgId" defaultValue={currentOrgId} onChange={undefined}>
                {memberships.map((m) => (
                  <option key={m.org.id} value={m.org.id}>
                    {m.org.name} ({m.role})
                  </option>
                ))}
              </select>
              <button type="submit" className="secondary">
                Switch
              </button>
            </form>
          ) : memberships.length === 1 ? (
            <span className="muted">{memberships[0]!.org.name}</span>
          ) : null}
          <span className="muted">{user.email}</span>
          <form action={signOut}>
            <button className="secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </nav>
      {children}
    </main>
  );
}