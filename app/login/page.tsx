import { redirect } from "next/navigation";
import { getUser } from "../../lib/auth.ts";
import { sendMagicLink } from "./actions.ts";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { sent?: string; error?: string; next?: string };
}) {
  if (await getUser()) redirect(searchParams.next ?? "/admin");
  return (
    <main>
      <h1>Sign in</h1>
      <p>We'll email you a secure sign-in link.</p>
      {searchParams.sent ? (
        <div className="flash">
          Link sent to <strong>{searchParams.sent}</strong>. Check your inbox.
        </div>
      ) : null}
      {searchParams.error ? <div className="flash error">{searchParams.error}</div> : null}
      <form action={sendMagicLink}>
        <input
          type="hidden"
          name="next"
          value={searchParams.next ?? "/admin"}
          readOnly
        />
        <div className="form-row">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required size={30} />
          <button type="submit">Send link</button>
        </div>
      </form>
    </main>
  );
}
