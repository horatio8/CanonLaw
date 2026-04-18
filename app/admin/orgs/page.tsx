import Link from "next/link";
import { listMyOrgs } from "../../../lib/auth.ts";
import { createOrg } from "./actions.ts";

export const dynamic = "force-dynamic";

export default async function OrgsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const memberships = await listMyOrgs();
  return (
    <>
      <h1>Organizations</h1>
      {memberships.length === 0 ? (
        <p>
          You aren't a member of any organization yet. Create one to begin — you'll become its
          super-admin automatically.
        </p>
      ) : (
        <ul>
          {memberships.map((m) => (
            <li key={m.org.id}>
              <strong>{m.org.name}</strong> <code>{m.org.slug}</code>{" "}
              <span className="muted">({m.role})</span>{" "}
              <Link href="/admin">Open</Link>
            </li>
          ))}
        </ul>
      )}

      <h2>Create a new organization</h2>
      {searchParams.error ? <div className="flash error">{searchParams.error}</div> : null}
      <form action={createOrg}>
        <div className="form-row">
          <label>
            Name
            <input name="name" required size={30} placeholder="Diocese of Springfield" />
          </label>
        </div>
        <div className="form-row">
          <label>
            Slug
            <input name="slug" required size={30} pattern="[a-z0-9\-]{3,40}" placeholder="springfield" />
          </label>
          <span className="muted">lowercase letters, numbers, dashes</span>
        </div>
        <button type="submit">Create organization</button>
      </form>
    </>
  );
}
