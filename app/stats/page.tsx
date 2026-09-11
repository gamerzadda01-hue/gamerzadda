"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Stats = {
  totalGames: number;
  completedGames: number;
  wins: number;
  podiumFinishes: number;
  totalKills: number;
  totalWinnings: number;
  winRate: number;
  totalWithdrawn: number;
  withdrawalCount: number;
  bestKills: number;
  bestRank: number | null;
  bestTournamentTitle: string | null;
  categories: {
    freeFire: number;
    freeFireMax: number;
    clashSquad: number;
    loneWolf: number;
    other: number;
  };
};

export default function MyStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await fetch("/api/stats", {
          credentials: "include",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });

        const data = await response.json().catch(() => null);

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok || !data?.success) {
          setError(data?.error || "Unable to load your stats.");
          return;
        }

        setStats(data.stats);
      } catch (err) {
        console.error(err);
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [router]);

  const card = "rounded-[22px] border border-slate-100 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.07)]";

  return (
    <main className="min-h-screen bg-gradient-to-b from-red-50/60 via-white to-slate-50 pb-10 text-slate-900">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-red-100/70 bg-white/90 px-4 py-3 backdrop-blur-xl">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-slate-700 shadow-[0_8px_25px_rgba(16,185,129,0.10)] transition active:scale-95"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 transition group-hover:bg-emerald-100">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </span>
          </button>

          <div>
            <p className="text-[10px] font-black tracking-[0.18em] text-red-500">
              GAMERZADDA
            </p>
            <h1 className="text-xl font-black">My Stats</h1>
          </div>
        </header>

        <div className="px-4 pt-5">
          {loading ? (
            <div className="space-y-3">
              <div className="h-32 animate-pulse rounded-[24px] bg-slate-200" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-28 animate-pulse rounded-[22px] bg-slate-200" />
                <div className="h-28 animate-pulse rounded-[22px] bg-slate-200" />
                <div className="h-28 animate-pulse rounded-[22px] bg-slate-200" />
                <div className="h-28 animate-pulse rounded-[22px] bg-slate-200" />
              </div>
            </div>
          ) : error ? (
            <div className={`${card} p-6 text-center`}>
              <div className="text-4xl">⚠️</div>
              <p className="mt-3 font-bold text-slate-700">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white"
              >
                Try Again
              </button>
            </div>
          ) : stats ? (
            <>
              {/* Hero */}
              <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0f172a] via-[#123c32] to-[#18a957] p-5 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-emerald-300/10 blur-3xl" />

                <div className="relative">
                  <p className="text-xs font-bold text-white/70">YOUR GAMING JOURNEY</p>
                  <h2 className="mt-1 text-2xl font-black">Your performance at a glance</h2>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <HeroStat label="Games" value={stats.totalGames} />
                    <HeroStat label="Wins" value={stats.wins} />
                    <HeroStat label="Kills" value={stats.totalKills} />
                  </div>
                </div>
              </section>

              {/* Main stats */}
              <section className="mt-4 grid grid-cols-2 gap-3">
                <StatCard icon="🎮" label="Games Played" value={stats.totalGames} sub={`${stats.completedGames} results`} />
                <StatCard icon="🏆" label="Game Wins" value={stats.wins} sub={`${stats.winRate}% win rate`} />
                <StatCard icon="💥" label="Total Kills" value={stats.totalKills} sub="Across recorded results" />
                <StatCard icon="💰" label="Winnings" value={`₹${stats.totalWinnings.toFixed(2)}`} sub="Prize money earned" />
                <StatCard icon="💸" label="Total Withdrawn" value={`₹${stats.totalWithdrawn.toFixed(2)}`} sub={`${stats.withdrawalCount} approved withdrawals`} />
                <StatCard icon="🥇" label="Top 3 Finishes" value={stats.podiumFinishes} sub="Podium finishes" />
              </section>

              {/* Game categories */}
              <section className={`${card} mt-4 overflow-hidden`}>
                <div className="border-b border-slate-100 px-5 py-4">
                  <p className="text-[10px] font-black tracking-[0.16em] text-red-500">GAME BREAKDOWN</p>
                  <h3 className="mt-1 text-lg font-black">Where you play</h3>
                </div>

                <div className="p-3">
                  <CategoryRow icon="🔥" title="Free Fire" value={stats.categories.freeFire} total={stats.totalGames} />
                  <CategoryRow icon="🎮" title="Free Fire MAX" value={stats.categories.freeFireMax} total={stats.totalGames} />
                  <CategoryRow icon="⚔️" title="Clash Squad" value={stats.categories.clashSquad} total={stats.totalGames} />
                  <CategoryRow icon="🥷" title="Lone Wolf" value={stats.categories.loneWolf} total={stats.totalGames} />
                  {stats.categories.other > 0 && (
                    <CategoryRow icon="🎯" title="Other" value={stats.categories.other} total={stats.totalGames} />
                  )}
                </div>
              </section>

              {/* Personal records */}
              <section className={`${card} mt-4 border-red-100/70 p-5`}>
                <p className="text-[10px] font-black tracking-[0.16em] text-red-500">PERSONAL RECORDS</p>
                <div className="mt-3 space-y-3">
                  <RecordRow icon="💥" label="Most kills in one result" value={String(stats.bestKills)} />
                  <RecordRow icon="🏅" label="Best recorded rank" value={stats.bestRank ? `#${stats.bestRank}` : "—"} />
                  <RecordRow icon="💸" label="Total withdrawn" value={`₹${stats.totalWithdrawn.toFixed(2)}`} />
                </div>
              </section>

              {/* Encouragement */}
              <section className="mt-4 rounded-[22px] border border-emerald-100 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
                    🚀
                  </div>
                  <div>
                    <h3 className="font-black text-emerald-900">Keep pushing!</h3>
                    <p className="mt-1 text-xs font-medium leading-5 text-emerald-800/80">
                      Play more matches, improve your kills and climb the leaderboard.
                      Your stats update from your recorded tournament results.
                    </p>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-2 py-3 text-center backdrop-blur-sm">
      <div className="text-xl font-black">{value.toLocaleString("en-IN")}</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-white/70">{label}</div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="rounded-[22px] border border-red-100/70 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.07)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-xl">
        {icon}
      </div>
      <p className="mt-3 text-[11px] font-bold text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-[9px] font-semibold text-slate-400">{sub}</p>
    </div>
  );
}

function CategoryRow({
  icon,
  title,
  value,
  total,
}: {
  icon: string;
  title: string;
  value: number;
  total: number;
}) {
  const percent = total > 0 ? Math.min(100, (value / total) * 100) : 0;

  return (
    <div className="rounded-2xl px-2 py-3 transition hover:bg-slate-50">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-lg">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-black">{title}</span>
            <span className="text-sm font-black text-emerald-600">{value}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 to-emerald-400 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-lg">{icon}</span>
        <span className="truncate text-xs font-bold text-slate-600">{label}</span>
      </div>
      <span className="ml-3 shrink-0 text-sm font-black text-slate-900">{value}</span>
    </div>
  );
}
