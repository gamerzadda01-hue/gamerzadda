"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      try {
        window.localStorage.removeItem("gamerzadda_device_id");
      } catch {}

      router.replace("/login");
    }
  }

  return (
    <main className="min-h-screen bg-[#070b18] text-white">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#ff174f] via-[#ed1749] to-[#ff2857] px-4 py-4 shadow-xl">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#641d3b]/80 text-xl"
            aria-label="Go back"
          >
            ←
          </button>
          <h1 className="text-xl font-black">Settings</h1>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-8">
        <section className="rounded-2xl border border-red-500/20 bg-[#11182b] p-1">
          <button
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center gap-4 rounded-xl px-5 py-4 text-left font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-60"
          >
            <span className="text-xl">🚪</span>
            <span>{loggingOut ? "Logging out..." : "Logout"}</span>
          </button>
        </section>
      </div>
    </main>
  );
}
