"use client";

import { useState } from "react";

const tournaments = [
  {
    title: "FREE FIRE MAX SOLO",
    mode: "SOLO",
    entry: "₹10",
    prize: "₹500",
    players: "32/48",
    time: "10:00 PM",
  },
  {
    title: "FREE FIRE MAX DUO",
    mode: "DUO",
    entry: "₹20",
    prize: "₹1,000",
    players: "24/48",
    time: "10:30 PM",
  },
  {
    title: "FREE FIRE MAX SQUAD",
    mode: "SQUAD",
    entry: "₹50",
    prize: "₹2,500",
    players: "16/48",
    time: "11:00 PM",
  },
];

export default function FreeFireMaxPage() {
  const [activeTab, setActiveTab] = useState("ALL");

  const filtered =
    activeTab === "ALL"
      ? tournaments
      : tournaments.filter((t) => t.mode === activeTab);

  return (
    <main className="min-h-screen bg-[#070b14] pb-24 text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-gradient-to-r from-red-700 via-red-600 to-pink-600 px-4 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => (window.location.href = "/")}
            className="text-2xl font-bold"
          >
            ←
          </button>

          <div className="text-center">
            <h1 className="text-lg font-black">FREE FIRE MAX</h1>
            <p className="text-[10px] font-bold text-white/80">
              TOURNAMENTS
            </p>
          </div>

          <div className="rounded-lg bg-black/20 px-3 py-2 text-xs font-bold">
            ₹0
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="px-4 pt-5">
        <div className="overflow-hidden rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-700/80 to-pink-600/60 p-5">
          <p className="text-xs font-bold text-white/70">
            GAMERZADDA ESPORTS
          </p>

          <h2 className="mt-2 text-2xl font-black">
            FREE FIRE MAX
          </h2>

          <p className="mt-1 text-sm font-semibold text-white/80">
            Play. Compete. Win Big. 🏆
          </p>

          <button
            onClick={() => window.scrollTo({ top: 350, behavior: "smooth" })}
            className="mt-4 rounded-xl bg-white px-5 py-3 text-xs font-black text-red-600"
          >
            JOIN TOURNAMENT
          </button>
        </div>
      </section>

      {/* TABS */}
      <section className="px-4 pt-5">
        <div className="flex gap-2 overflow-x-auto">
          {["ALL", "SOLO", "DUO", "SQUAD"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap rounded-xl px-5 py-3 text-xs font-black ${
                activeTab === tab
                  ? "bg-red-600"
                  : "bg-white/10 text-white/60"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {/* TOURNAMENTS */}
      <section className="px-4 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black">Live Tournaments</h2>

          <span className="text-xs font-bold text-red-400">
            {filtered.length} Matches
          </span>
        </div>

        <div className="space-y-4">
          {filtered.map((tournament) => (
            <div
              key={tournament.title}
              className="rounded-2xl border border-white/10 bg-[#101622] p-4 shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-black">
                    {tournament.title}
                  </h3>

                  <p className="mt-1 text-[10px] font-bold text-white/40">
                    FREE FIRE MAX • {tournament.mode}
                  </p>
                </div>

                <span className="rounded-lg bg-green-500/10 px-2 py-1 text-[9px] font-black text-green-400">
                  LIVE
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-[9px] text-white/40">ENTRY</p>
                  <p className="mt-1 text-sm font-black">
                    {tournament.entry}
                  </p>
                </div>

                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-[9px] text-white/40">PRIZE</p>
                  <p className="mt-1 text-sm font-black text-yellow-400">
                    {tournament.prize}
                  </p>
                </div>

                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-[9px] text-white/40">PLAYERS</p>
                  <p className="mt-1 text-sm font-black">
                    {tournament.players}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs font-bold text-white/50">
                  Starts {tournament.time}
                </p>

                <button
                  onClick={() => alert("Tournament joining will be connected next.")}
                  className="rounded-xl bg-red-600 px-5 py-3 text-xs font-black"
                >
                  JOIN NOW →
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* INFO */}
      <section className="px-4 pt-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-black">
            🏆 How to Play
          </h3>

          <div className="mt-3 space-y-2 text-xs font-semibold text-white/60">
            <p>1. Select your tournament</p>
            <p>2. Join the match</p>
            <p>3. Get room details</p>
            <p>4. Play and win rewards</p>
          </div>
        </div>
      </section>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#080c14]/95 px-3 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around">
          <button
            onClick={() => (window.location.href = "/")}
            className="text-xs font-bold text-white/50"
          >
            🏠
            <span className="ml-1">Home</span>
          </button>

          <button className="text-xs font-bold text-red-500">
            🎮
            <span className="ml-1">Tournaments</span>
          </button>

          <button className="text-xs font-bold text-white/50">
            🏆
            <span className="ml-1">Leaderboard</span>
          </button>

          <button className="text-xs font-bold text-white/50">
            👤
            <span className="ml-1">Profile</span>
          </button>
        </div>
      </nav>
    </main>
  );
}