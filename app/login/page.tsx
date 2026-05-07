import { redirect } from "next/navigation";
import { getUser } from "../../lib/auth.ts";
import { appUrl } from "../../lib/supabase/env.ts";
import LoginForm from "./LoginForm.tsx";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { sent?: string; error?: string; next?: string };
}) {
  if (await getUser()) redirect(searchParams.next ?? "/admin");
  const next = searchParams.next ?? "/admin";
  return (
    <main>
      <h1>Sign in</h1>
      <p>We'll email you a secure sign-in link.</p>
      {searchParams.error ? <div className="flash error">{searchParams.error}</div> : null}
      <LoginForm next={next} appUrl={appUrl()} />
    </main>
  );
}
