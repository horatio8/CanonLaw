import { redirect } from "next/navigation";
import { getUser } from "../../lib/auth.ts";
import { signIn, signUp } from "./actions.ts";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { confirm?: string; error?: string; next?: string };
}) {
  if (await getUser()) redirect(searchParams.next ?? "/admin");
  const showDemo = process.env.SHOW_DEMO_CREDENTIALS !== "false";
  return (
    <main>
      <h1>Sign in</h1>
      {searchParams.confirm ? (
        <div className="flash">
          Confirmation email sent to <strong>{searchParams.confirm}</strong>. Click the link in
          your inbox to activate the account.
        </div>
      ) : null}
      {searchParams.error ? (
        <div className="flash error">
          {searchParams.error}
          {/^invalid login credentials/i.test(searchParams.error) ? (
            <>
              <br />
              <span style={{ fontSize: ".9em" }}>
                If you intended to use the demo account but haven't seeded it yet, run{" "}
                <code>npm run seed:demo</code> with{" "}
                <code>SUPABASE_SERVICE_ROLE_KEY</code> set, then try again.
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      <form>
        <input type="hidden" name="next" value={searchParams.next ?? "/admin"} readOnly />
        <div className="form-row">
          <label>
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              size={30}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              minLength={8}
              size={30}
            />
          </label>
        </div>
        <div className="form-row">
          <button type="submit" formAction={signIn}>
            Sign in
          </button>
          <button type="submit" formAction={signUp} className="secondary">
            Create account
          </button>
        </div>
      </form>

      {showDemo ? (
        <div style={{ marginTop: "2rem", padding: ".8rem 1rem", border: "1px dashed #aaa", borderRadius: "4px", background: "#f8f8f8" }}>
          <p style={{ margin: 0 }}>
            <strong>Demo account</strong> (seeded by <code>supabase/seed.sql</code>):
          </p>
          <ul style={{ margin: ".4rem 0 0", paddingLeft: "1.4rem" }}>
            <li>
              Email: <code>vicar@example.com</code>
            </li>
            <li>
              Password: <code>Tribunal2026!</code>
            </li>
            <li>
              Organization: <strong>Demo Tribunal</strong> (you are super-admin)
            </li>
          </ul>
        </div>
      ) : null}
    </main>
  );
}
