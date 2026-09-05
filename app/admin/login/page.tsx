 "use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter email and password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError || !data.user) {
        throw new Error(loginError?.message || "Login failed.");
      }

      const { data: admin, error: adminError } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (adminError || admin?.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("Access denied. Admin account required.");
      }

      router.replace("/admin");
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background:
          "linear-gradient(135deg,#070b14 0%,#0b1220 50%,#101827 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#fff",
          borderRadius: "18px",
          padding: "32px",
          boxShadow: "0 20px 60px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "44px" }}>🔐</div>
          <h1 style={{ margin: "10px 0 6px", fontSize: "28px" }}>
            GamerzAdda
          </h1>
          <p style={{ margin: 0, color: "#666" }}>Admin Panel Login</p>
        </div>

        <form onSubmit={handleLogin}>
          <label
            style={{
              display: "block",
              marginBottom: "7px",
              fontWeight: 600,
            }}
          >
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin email"
            autoComplete="email"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 14px",
              border: "1px solid #ddd",
              borderRadius: "10px",
              marginBottom: "18px",
              fontSize: "15px",
            }}
          />

          <label
            style={{
              display: "block",
              marginBottom: "7px",
              fontWeight: 600,
            }}
          >
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            autoComplete="current-password"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "13px 14px",
              border: "1px solid #ddd",
              borderRadius: "10px",
              marginBottom: "18px",
              fontSize: "15px",
            }}
          />

          {error && (
            <div
              style={{
                background: "#fff1f2",
                color: "#be123c",
                border: "1px solid #fecdd3",
                padding: "11px 12px",
                borderRadius: "9px",
                marginBottom: "16px",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              border: 0,
              borderRadius: "10px",
              padding: "14px",
              background: loading ? "#777" : "#111827",
              color: "#fff",
              fontWeight: 700,
              fontSize: "15px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Login to Admin Panel"}
          </button>
        </form>
      </div>
    </main>
  );
}
