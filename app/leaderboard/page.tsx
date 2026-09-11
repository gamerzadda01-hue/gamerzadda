"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type GameFilter =
  | "ALL"
  | "FREE FIRE"
  | "FREE FIRE MAX"
  | "CLASH SQUAD"
  | "LONE WOLF";

type TimeFilter = "ALL" | "WEEKLY" | "MONTHLY";

type LeaderboardPlayer = {
  id: string;
  name: string;
  bio: string;
  avatar: string | null;
  winning: number;
};

const GAMES: GameFilter[] = [
  "ALL",
  "FREE FIRE",
  "FREE FIRE MAX",
  "CLASH SQUAD",
  "LONE WOLF",
];

const TIMES: TimeFilter[] = ["ALL", "WEEKLY", "MONTHLY"];

function normalizeGame(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatMoney(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("ALL");
  const [gameFilter, setGameFilter] = useState<GameFilter>("ALL");
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLoading(true);
      setError("");

      try {
        /*
         * Results are stored by the existing Admin Results flow in
         * tournament_results:
         *   tournament_id, user_id, winning_amount, updated_at
         *
         * The game comes from tournaments.game and player details come
         * from the existing users table.
         */
        let resultsQuery = supabase
          .from("tournament_results")
          .select("tournament_id,user_id,winning_amount,updated_at")
          .gt("winning_amount", 0);

        if (timeFilter === "WEEKLY") {
          resultsQuery = resultsQuery.gte(
            "updated_at",
            startOfWeek().toISOString()
          );
        }

        if (timeFilter === "MONTHLY") {
          resultsQuery = resultsQuery.gte(
            "updated_at",
            startOfMonth().toISOString()
          );
        }

        const { data: resultRows, error: resultsError } =
          await resultsQuery;

        if (resultsError) {
          throw resultsError;
        }

        const tournamentIds = [
          ...new Set(
            (resultRows || [])
              .map((row: any) => String(row.tournament_id ?? "").trim())
              .filter(Boolean)
          ),
        ];

        if (tournamentIds.length === 0) {
          if (!cancelled) setPlayers([]);
          return;
        }

        const { data: tournaments, error: tournamentsError } = await supabase
          .from("tournaments")
          .select("id,game")
          .in("id", tournamentIds);

        if (tournamentsError) {
          throw tournamentsError;
        }

        const tournamentMap = new Map(
          (tournaments || []).map((tournament: any) => [
            String(tournament.id),
            tournament,
          ])
        );

        const rows = (resultRows || []).filter((row: any) => {
          if (gameFilter === "ALL") return true;

          const tournament = tournamentMap.get(
            String(row.tournament_id ?? "")
          );

          return (
            normalizeGame(tournament?.game) ===
            normalizeGame(gameFilter)
          );
        });

        const totals = new Map<string, number>();

        rows.forEach((row: any) => {
          const userId = String(row.user_id ?? "").trim();
          const amount = Number(row.winning_amount ?? 0);

          if (!userId || !Number.isFinite(amount) || amount <= 0) return;

          totals.set(userId, (totals.get(userId) || 0) + amount);
        });

        const userIds = Array.from(totals.keys());

        if (userIds.length === 0) {
          if (!cancelled) setPlayers([]);
          return;
        }

        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("id,full_name,game_name,bio")
          .in("id", userIds);

        if (usersError) {
          throw usersError;
        }

        const profileMap = new Map(
          (users || []).map((user: any) => [
            String(user.id),
            user,
          ])
        );

        const result = userIds
          .map((id) => {
            const user: any = profileMap.get(id);

            return {
              id,
              name:
                user?.game_name ||
                user?.full_name ||
                "GAMERZADDA PLAYER",
              bio: user?.bio || "GAMERZADDA Player",
              avatar: user?.avatar_url || null,
              winning: totals.get(id) || 0,
            };
          })
          .filter((player) => player.winning > 0)
          .sort((a, b) => b.winning - a.winning)
          .slice(0, 100);

        if (!cancelled) setPlayers(result);
      } catch (err) {
        console.error("Leaderboard:", err);

        if (!cancelled) {
          setPlayers([]);
          setError(
            "Leaderboard data could not be loaded. Check the winning table/columns."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLeaderboard();

    return () => { cancelled = true; };
  }, [timeFilter, gameFilter]);

  const rankedPlayers = useMemo(() => {
    let previousAmount: number | null = null;
    let currentRank = 0;
    return players.map((player, index) => {
      if (previousAmount === null || player.winning !== previousAmount) currentRank = index + 1;
      previousAmount = player.winning;
      return { ...player, rank: currentRank };
    });
  }, [players]);

  return (
    <main className="min-h-screen bg-white pb-24 text-gray-900">
      <button
        type="button"
        onClick={() => router.push("/")}
        aria-label="Go to homepage"
        className="fixed left-4 top-4 z-[100] flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-slate-700 shadow-lg transition active:scale-95"
      >
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
      </button>
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-[#d90429]/95 backdrop-blur-xl px-4 py-3 text-slate-900 shadow-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-gray-600">
              GAMERZADDA
            </p>
            <h1 className="text-xl font-black leading-tight tracking-tight">LEADERBOARD</h1>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-xl backdrop-blur-xl shadow-lg">
            🏆
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-3 pt-3">
        <div className="overflow-hidden rounded-[24px] border border-gray-200 bg-white/70 shadow-[0_12px_40px_rgba(0,0,0,0.10)] backdrop-blur-2xl">
          <div className="relative px-5 pb-5 pt-5 text-slate-900">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#d90429]/25 blur-2xl" />
            <div className="absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-[#00c853]/15 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-[#d90429]/80 text-2xl shadow-lg shadow-[#d90429]/25 backdrop-blur-xl">
                🏆
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-black tracking-tight">Top Winning Players</h2>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-900/45">
                  Ranked by match winnings only
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 border-t border-gray-200 bg-white0 backdrop-blur-xl p-1.5">
            {TIMES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTimeFilter(item)}
                className={`rounded-[14px] py-2.5 text-[10px] font-black tracking-wide transition-all ${
                  timeFilter === item
                    ? "bg-[#d90429] text-slate-900 shadow-md"
                    : "text-gray-500 hover:bg-white hover:text-slate-800"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-200 bg-white/70 p-2 shadow-lg backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-900/45">
              Game
            </span>
            <span className="text-[9px] font-bold text-slate-900/55">TOP 100</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {GAMES.map((game) => (
              <button
                key={game}
                type="button"
                onClick={() => setGameFilter(game)}
                className={`shrink-0 rounded-xl px-3 py-2 text-[9px] font-black transition-all ${
                  gameFilter === game
                    ? "bg-[#d90429] text-slate-900 shadow-sm"
                    : "bg-[#f5f5f5] text-gray-500 hover:bg-white"
                }`}
              >
                {game}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between px-1">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-900/45">Leaderboard</p>
            <h3 className="text-lg font-black tracking-tight text-slate-900">Winning Rankings</h3>
          </div>
          {!loading && !error && rankedPlayers.length > 0 && (
            <span className="rounded-full border border-[#00c853]/20 bg-[#00c853]/10 px-2.5 py-1 text-[9px] font-black text-[#00c853]">
              {rankedPlayers.length} PLAYERS
            </span>
          )}
        </div>

        {loading ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex h-[76px] animate-pulse items-center gap-3 rounded-xl border border-gray-200 bg-white/70 p-3 backdrop-blur-xl">
                <div className="h-10 w-10 rounded-xl bg-white" />
                <div className="h-11 w-11 rounded-full bg-white" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-white" />
                  <div className="h-2.5 w-24 rounded bg-white" />
                </div>
                <div className="h-4 w-16 rounded bg-white" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-3 rounded-xl border border-gray-200 bg-white/70 p-7 text-center shadow-lg backdrop-blur-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#d90429]/10 text-xl">⚠️</div>
            <p className="mt-3 text-sm font-black text-slate-900">Unable to load leaderboard</p>
            <p className="mx-auto mt-1 max-w-xs text-[10px] font-semibold leading-4 text-slate-900/45">{error}</p>
          </div>
        ) : rankedPlayers.length === 0 ? (
          <div className="mt-3 rounded-xl border border-gray-200 bg-white/70 p-9 text-center shadow-lg backdrop-blur-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[#00c853]/10 text-2xl">🏆</div>
            <p className="mt-3 text-sm font-black text-slate-900">No winners yet</p>
            <p className="mt-1 text-[10px] font-semibold text-slate-900/45">Players will appear here after winning a match.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {rankedPlayers.map((player) => {
              const isTopThree = player.rank <= 3;
              return (
                <div
                  key={player.id}
                  className={`group relative flex items-center gap-2.5 overflow-hidden rounded-xl border p-2.5 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-lg hover:border-gray-200 ${
                    isTopThree
                      ? "border-[#ff174f]/10 bg-white"
                      : "border-black/5 bg-white"
                  }`}
                >
                  {isTopThree && <div className="absolute inset-y-0 left-0 w-1 bg-[#d90429]" />}

                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-black ${
                    player.rank === 1
                      ? "bg-[#d90429] text-slate-900"
                      : player.rank === 2
                        ? "bg-gray-100 text-gray-900"
                        : player.rank === 3
                          ? "bg-amber-100 text-amber-700"
                          : "bg-[#f3f4f6] text-gray-500"
                  }`}>
                    {player.rank === 1 ? "👑" : `#${player.rank}`}
                  </div>

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-2 ring-white">
                    {player.avatar ? (
                      <img src={player.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-base">👤</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-black leading-5 text-slate-900">{player.name}</div>
                    <div className="mt-0.5 truncate text-[10px] font-semibold leading-4 text-slate-900/45">{player.bio}</div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-900/45">Won</div>
                    <div className="mt-0.5 text-[13px] font-black text-[#00c853]">{formatMoney(player.winning)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
