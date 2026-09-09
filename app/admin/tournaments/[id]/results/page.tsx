"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Participant = {
  user_id: string;
  username: string | null;
  game_name: string | null;
  uid: string | null;
  rank: number | null;
  kills: number;
  winning_amount: number;
};

type MatchInfo = {
  id: string;
  status: string | null;
  room_id: string | null;
  room_password: string | null;
  start_time: string | null;
} | null;

export default function AdminResultsPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id || "");

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [title, setTitle] = useState("");
  const [match, setMatch] = useState<MatchInfo>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const sessionResult = await supabase.auth.getSession();
        const token = sessionResult.data.session?.access_token;
        if (!token) throw new Error("Admin session not found.");

        const response = await fetch(`/api/admin/tournaments/${encodeURIComponent(id)}/results`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Failed to load results.");

        setTitle(data?.tournament?.title || "Tournament Results");
        setMatch(data?.match || null);
        setParticipants(Array.isArray(data?.participants) ? data.participants : []);
      } catch (err) {
        console.error("Admin Results:", err);
        setError(err instanceof Error ? err.message : "Failed to load results.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f5f5] p-4">
        <div className="mx-auto max-w-5xl">
          <div className="h-12 animate-pulse rounded-xl bg-white" />
          <div className="mt-4 h-28 animate-pulse rounded-2xl bg-white" />
          <div className="mt-4 h-80 animate-pulse rounded-2xl bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f5f5] p-3 text-gray-900 sm:p-5">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <button type="button" onClick={() => router.back()} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black active:scale-95">
            ← BACK
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black">🏆 RESULTS</h1>
            <p className="truncate text-xs font-semibold text-gray-500">{title}</p>
          </div>
          <div className="rounded-xl bg-[#ff174f]/10 px-3 py-2 text-[9px] font-black text-[#ff174f]">🔒 LOCKED</div>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-white p-4 text-sm font-bold text-red-600">{error}</div>
        ) : null}

        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black">🔑 MATCH ID / PASSWORD</h2>
            <span className="rounded-full bg-gray-100 px-2 py-1 text-[8px] font-black uppercase text-gray-500">VIEW ONLY</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-[9px] font-black uppercase text-gray-400">Room ID</p>
              <p className="mt-1 break-all text-sm font-black text-gray-900">{match?.room_id || "—"}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-[9px] font-black uppercase text-gray-400">Room Password</p>
              <p className="mt-1 break-all text-sm font-black text-gray-900">{match?.room_password || "—"}</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-black">ALL PARTICIPANTS</h2>
            <p className="mt-1 text-[10px] font-semibold text-gray-400">Results are permanently locked after publishing.</p>
          </div>

          {participants.length === 0 ? (
            <div className="p-10 text-center text-sm font-bold text-gray-400">No participants found.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {participants.map((player, index) => (
                <div key={player.user_id} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_90px_90px_130px]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{player.game_name || player.username || "Player"}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-gray-500">Username: {player.username || "—"}</p>
                    <p className="text-[10px] font-semibold text-gray-500">UID: {player.uid || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
                    <span className="text-[9px] font-black text-gray-400">RANK</span>
                    <p className="mt-1 text-sm font-black">{player.rank ?? index + 1}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
                    <span className="text-[9px] font-black text-gray-400">KILLS</span>
                    <p className="mt-1 text-sm font-black">{player.kills}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2">
                    <span className="text-[9px] font-black text-emerald-500">WINNING</span>
                    <p className="mt-1 text-sm font-black text-emerald-600">₹{Number(player.winning_amount || 0).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-[#ff174f]/20 bg-white p-3 text-center text-[10px] font-black text-[#ff174f]">
          🔒 RESULTS LOCKED — RANK, KILLS, WINNING AMOUNT AND MATCH DATA CANNOT BE CHANGED FROM THIS PAGE.
        </div>
      </div>
    </main>
  );
}
