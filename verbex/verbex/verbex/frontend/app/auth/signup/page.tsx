"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signup } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await signup(email, password);
      localStorage.setItem("token", data.token);
      router.push("/agents");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <h1 style={styles.logo}>⚡ Verbex</h1>
        <p style={styles.subtitle}>Create your account</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
        <p style={styles.footer}>
          Already have an account?{" "}
          <a href="/auth/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  box: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "36px",
    width: "100%",
    maxWidth: "420px",
  },
  logo: { fontSize: "24px", fontWeight: 700, marginBottom: "6px" },
  subtitle: { color: "var(--text-muted)", fontSize: "14px", marginBottom: "28px" },
  form: { display: "flex", flexDirection: "column", gap: "18px" },
  footer: { marginTop: "20px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" },
};
