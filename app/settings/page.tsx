"use client";

import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();

  const logout = async () => {
    const ok = window.confirm("Are you sure you want to logout?");
    if (!ok) return;

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {}

    try {
      localStorage.removeItem("gamerzadda_device_id");
    } catch {}

    router.replace("/login");
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0f14",
        color: "#fff",
        padding: "20px",
      }}
    >
      <div
        style={{
          maxWidth: 700,
          margin: "0 auto",
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: "transparent",
            border: "none",
            color: "#fff",
            fontSize: 24,
            cursor: "pointer",
            marginBottom: 20,
          }}
        >
          ←
        </button>

        <h1 style={{ fontSize: 28, marginBottom: 25 }}>Settings</h1>

        <div
          onClick={() => router.push("/profile")}
          style={{
            padding: 18,
            background: "#151b23",
            borderRadius: 14,
            marginBottom: 12,
            cursor: "pointer",
          }}
        >
          👤 My Profile
        </div>

        <div
          onClick={() => router.push("/profile")}
          style={{
            padding: 18,
            background: "#151b23",
            borderRadius: 14,
            marginBottom: 12,
            cursor: "pointer",
          }}
        >
          🎮 Game Account
        </div>

        <div
          onClick={() => router.push("/profile")}
          style={{
            padding: 18,
            background: "#151b23",
            borderRadius: 14,
            marginBottom: 12,
            cursor: "pointer",
          }}
        >
          🔐 Security
        </div>

        <div
          onClick={() => router.push("/referrals")}
          style={{
            padding: 18,
            background: "#151b23",
            borderRadius: 14,
            marginBottom: 12,
            cursor: "pointer",
          }}
        >
          🎁 My Referrals
        </div>

        <div
          onClick={() => router.push("/support")}
          style={{
            padding: 18,
            background: "#151b23",
            borderRadius: 14,
            marginBottom: 25,
            cursor: "pointer",
          }}
        >
          💬 Help & Support
        </div>

        <button
          onClick={logout}
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 14,
            border: "1px solid #ef4444",
            background: "#35151a",
            color: "#ff6b6b",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          🚪 Logout
        </button>
      </div>
    </main>
  );
}