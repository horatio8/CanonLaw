import Link from "next/link";
import { getUser } from "../lib/auth.ts";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  return (
    <main>
      <h1>Canon Law Tribunal</h1>
      <p>
        Judicial process management for marriage nullity cases per the 1983 Code of Canon Law
        as amended by <i>Mitis Iudex Dominus Iesus</i> (2015).
      </p>
      {user ? (
        <p>
          <Link className="btn" href="/admin">
            Open admin console
          </Link>{" "}
          <span className="muted">Signed in as {user.email}</span>
        </p>
      ) : (
        <p>
          <Link className="btn" href="/login">
            Sign in
          </Link>
        </p>
      )}
    </main>
  );
}
