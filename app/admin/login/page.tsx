"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      setError(error?.message || "Login failed");
      setLoading(false);
      return;
    }

    // Check admin role
    const { data: admin, error: adminError } = await supabase
      .from("users")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (adminError || admin?.role !== "admin") {
      await supabase.auth.signOut();
      setError("Access denied. Admin account required.");
      setLoading(false);
      return;
    }

    router.replace("/admin");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f5f5f5",
        padding: 20,
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: 400,
          background: "white",
          padding: 30,
          borderRadius: 16,
          boxShadow: "0 5px 25px rgba(0,0,0,0.1)",
        }}
      >
        <h1 style={{ marginBottom: 8 }}>Admin Login</h1>

        <p style={{ color: "#666", marginBottom: 25 }}>
          Login to GamerzAdda Admin Panel
        </p>

        <input
          type="email"
          placeholder="Admin Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            padding: 13,
            marginBottom: 15,
            border: "1px solid #ddd",
            borderRadius: 8,
            boxSizing: "border-box",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: 13,
            marginBottom: 15,
            border: "1px solid #ddd",
            borderRadius: 8,
            boxSizing: "border-box",
          }}
        />

        {error && (
          <div
            style={{
              color: "red",
              background: "#ffecec",
              padding: 10,
              borderRadius: 8,
              marginBottom: 15,
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
            padding: 14,
            border: "none",
            borderRadius: 8,
            background: "#111",
            color: "white",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}