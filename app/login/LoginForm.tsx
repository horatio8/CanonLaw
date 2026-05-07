"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/client.ts";

export default function LoginForm({
  next,
  appUrl,
}: {
  next: string;
  appUrl: string;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    setSent(null);

    const supabase = createBrowserSupabaseClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      setSent(email.trim());
    }
  }

  return (
    <>
      {sent ? (
        <div className="flash">
          Link sent to <strong>{sent}</strong>. Check your inbox.
        </div>
      ) : null}
      {error ? <div className="flash error">{error}</div> : null}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            size={30}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send link"}
          </button>
        </div>
      </form>
    </>
  );
}
