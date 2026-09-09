"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tournament = {
  id: string;
  title: string;
  game: string | null;
  mode: string | null;
  entry_fee: number | null;
  prize_pool: number | null;
  kill_reward: number | null;
  max_players: number | null;
  start_time: string | null;
  map: string | null;
  status: string | null;
  created_at: string | null;
};

export default function PastMatchesAdminPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [gameFilter, setGameFilter] = useState("all");

  async function loadTournaments() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("tournaments")
      .select(`
        id,
        title,
        game,
        mode,
        entry_fee,
        prize_pool,
        kill_reward,
        max_players,
        start_time,
        map,
        status,
        created_at
      `)
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage(error.message);
      setTournaments([]);
    } else {
      setTournaments((data || []) as Tournament[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadTournaments();
  }, []);

  function formatDate(date: string | null) {
    if (!date) return "Not scheduled";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;

    return parsed.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function matchesGameFilter(tournament: Tournament) {
    if (gameFilter === "all") return true;

    const game = String(tournament.game || "").toLowerCase().replace(/[_-]/g, " ");
    const mode = String(tournament.mode || "").toLowerCase().replace(/[_-]/g, " ");
    const combined = `${game} ${mode}`;

    if (gameFilter === "freefire") {
      return (game.includes("free fire") || game === "ff" || game === "freefire") && !combined.includes("max");
    }
    if (gameFilter === "freefiremax") {
      return combined.includes("free fire max") || combined.includes("freefire max") || combined.includes("ff max") || game === "ffmax";
    }
    if (gameFilter === "clashsquad") {
      return mode.includes("clash squad") || game.includes("clash squad") || combined.includes("clash squad");
    }
    if (gameFilter === "lonewolf") {
      return mode.includes("lone wolf") || game.includes("lone wolf") || combined.includes("lone wolf");
    }
    return true;
  }

  const filteredTournaments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tournaments.filter((tournament) => {
      const matchesSearch =
        !query ||
        String(tournament.title || "").toLowerCase().includes(query) ||
        String(tournament.id || "").toLowerCase().includes(query);
      return matchesSearch && matchesGameFilter(tournament);
    });
  }, [tournaments, searchQuery, gameFilter]);

  return (
    <main className="min-h-screen bg-[#070b12] p-4 text-white sm:p-7">
      <style jsx>{`
        .card { transition: .18s ease; }
        .card:hover { transform: translateY(-1px); border-color:#30435b; }
        .action { transition:.15s ease; }
        .action:hover { filter:brightness(1.08); transform:translateY(-1px); }
        @media(max-width:600px){ .topbar{flex-direction:column!important;} .topbutton{width:100%;} }
      `}</style>

      <div className="mx-auto max-w-6xl">
        <div className="topbar mb-6 flex items-start justify-between gap-5">
          <div>
            <h1 className="text-[28px] font-black tracking-tight">🕘 Past Matches</h1>
            <p className="mt-1 text-xs font-semibold text-[#77849a]">
              Past tournaments are view-only and permanently locked.
            </p>
          </div>
          <Link
            href="/admin/tournaments"
            className="topbutton inline-flex min-h-[42px] items-center justify-center rounded-[10px] border border-[#2b3a4e] bg-[#182333] px-4 text-[10px] font-black text-white"
          >
            ← ACTIVE TOURNAMENTS
          </Link>
        </div>

        {message && (
          <div className="mb-4 rounded-xl border border-[#5b2632] bg-[#1b1017] p-3 text-[11px] font-bold text-[#ff8da0]">
            ⚠️ {message}
          </div>
        )}

        <div className="mb-5 flex flex-col gap-3 rounded-[14px] border border-white/[.07] bg-[#0d121c]/95 p-3 sm:flex-row">
          <div className="flex-1">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tournament name or ID..."
              className="h-[42px] w-full rounded-[10px] border border-white/[.09] bg-[#090e17] px-3 text-xs font-semibold text-white outline-none placeholder:text-[#667388] focus:border-[#ff174f]"
            />
          </div>
          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value)}
            className="h-[42px] rounded-[10px] border border-white/[.09] bg-[#090e17] px-3 text-[11px] font-black text-white outline-none sm:min-w-[170px]"
          >
            <option value="all">All Games</option>
            <option value="freefire">Free Fire</option>
            <option value="freefiremax">Free Fire MAX</option>
            <option value="clashsquad">Clash Squad</option>
            <option value="lonewolf">Lone Wolf</option>
          </select>
        </div>

        {loading ? (
          <div className="rounded-[14px] border border-[#1d2a3b] bg-[#0d1520] p-16 text-center text-xs font-bold text-[#718097]">
            Loading past tournaments...
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="rounded-[14px] border border-[#1d2a3b] bg-[#0d1520] p-16 text-center text-xs font-bold text-[#718097]">
            No past tournaments found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredTournaments.map((tournament) => (
              <article key={tournament.id} className="card overflow-hidden rounded-[14px] border border-[#1d2a3b] bg-gradient-to-b from-[#0f1824] to-[#0b131e]">
                <div className="border-b border-[#1a2738] p-[17px]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-black text-[#f5f7fb]">{tournament.title}</div>
                      <div className="mt-1 text-[9px] font-semibold text-[#65748a]">
                        {tournament.game || "—"} · {tournament.mode || "—"} · {tournament.map || "No map"}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/[.07] px-2 py-1 text-[7px] font-black uppercase text-[#aab5c5]">
                      COMPLETED
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-[#182638] bg-[#09111b] p-2">
                      <div className="text-[7px] font-black uppercase text-[#56657a]">Entry</div>
                      <div className="mt-1 text-[10px] font-black text-[#35d88e]">₹{Number(tournament.entry_fee || 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg border border-[#182638] bg-[#09111b] p-2">
                      <div className="text-[7px] font-black uppercase text-[#56657a]">Prize</div>
                      <div className="mt-1 text-[10px] font-black text-[#35d88e]">₹{Number(tournament.prize_pool || 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg border border-[#182638] bg-[#09111b] p-2">
                      <div className="text-[7px] font-black uppercase text-[#56657a]">Players</div>
                      <div className="mt-1 text-[10px] font-black text-[#dce4ee]">👥 {tournament.max_players || 0}</div>
                    </div>
                    <div className="rounded-lg border border-[#182638] bg-[#09111b] p-2">
                      <div className="text-[7px] font-black uppercase text-[#56657a]">Kill</div>
                      <div className="mt-1 text-[10px] font-black text-[#35d88e]">₹{Number(tournament.kill_reward || 0).toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="mt-3 text-[9px] font-semibold text-[#65748a]">
                    Starts: {formatDate(tournament.start_time)}
                  </div>
                  <div className="mt-1 break-all text-[8px] font-semibold text-[#526177]">
                    ID: {tournament.id}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3">
                  <Link href={`/admin/tournaments/${tournament.id}/results`} className="action inline-flex min-h-[36px] items-center justify-center rounded-lg border border-[#ff174f]/40 bg-[#ff174f]/10 text-[8px] font-black text-[#ff5a7e]">
                    🏆 RESULTS
                  </Link>
                  <Link href={`/admin/tournaments/${tournament.id}/participants`} className="action inline-flex min-h-[36px] items-center justify-center rounded-lg border border-emerald-400/20 bg-[#101a27] text-[8px] font-black text-[#43dc96]">
                    👥 PARTICIPANTS
                  </Link>
                  <Link href={`/admin/tournaments/${tournament.id}/results`} className="action inline-flex min-h-[36px] items-center justify-center rounded-lg border border-sky-400/20 bg-[#101a27] text-[8px] font-black text-sky-300">
                    🔑 ID / PASS
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
