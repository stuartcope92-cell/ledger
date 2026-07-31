// ── Login gate — email/password only (no OAuth providers configured) ───
import { useState } from "react";
import { LogIn } from "lucide-react";
import { C } from "../theme";
import { Btn, Card, Field } from "../components/ui";
import { supabase } from "../services/supabase";

type Mode = "signIn" | "signUp";

export function Login() {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    setCheckEmail(false);
    try {
      if (mode === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        // Projects with email confirmation on don't return a session until
        // the user clicks the link in their inbox — tell them, rather than
        // silently doing nothing that looks like a failed sign-up.
        if (!data.session) setCheckEmail(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 460,
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "24px 18px",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ textAlign: "center", margin: "0 0 24px", fontSize: 26, letterSpacing: -0.5 }}>
        <span style={{ color: C.accent }}>▚</span> Ledger
      </h1>

      <Card>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />

        {error && (
          <p style={{ fontSize: 12, color: C.warn, marginTop: -4, marginBottom: 12 }}>{error}</p>
        )}
        {checkEmail && (
          <p style={{ fontSize: 12, color: C.accent, marginTop: -4, marginBottom: 12 }}>
            Check your email to confirm your account, then sign in.
          </p>
        )}

        <Btn
          onClick={submit}
          disabled={!email.trim() || !password || submitting}
          style={{ width: "100%", padding: "12px 0" }}
        >
          <LogIn size={16} /> {mode === "signIn" ? "Sign in" : "Create account"}
        </Btn>
      </Card>

      <button
        onClick={() => {
          setMode(mode === "signIn" ? "signUp" : "signIn");
          setError(null);
          setCheckEmail(false);
        }}
        style={{
          background: "none",
          border: "none",
          color: C.dim,
          fontSize: 13,
          marginTop: 16,
          cursor: "pointer",
          textAlign: "center",
        }}
      >
        {mode === "signIn" ? "No account yet? " : "Already have an account? "}
        <span style={{ color: C.accent, fontWeight: 600 }}>
          {mode === "signIn" ? "Create one" : "Sign in"}
        </span>
      </button>
    </div>
  );
}
