"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Tournament = {
  id: string;
  title: string;
  game: string | null;
  mode: string | null;
  max_players: number | null;
};

type Participant = {
  id: string;
  user_id: string;
  free_fire_uid: string | null;
  game_name: string | null;
  cancelled: boolean | null;
  user: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    free_fire_uid: string | null;
    game_name: string | null;
    level: number | null;
    role: string | null;
      ip_address: string | null;
    status: string | null;
    bio: string | null;
    avatar_url: string | null;
  } | null;
};

type DuoTeam = {
  id: string;
  team_code: string;
  team_name: string | null;
  creator_user_id: string;
  creator_ign: string | null;
  creator_uid: string | null;
  creator_level: number | null;
  member_user_id: string | null;
  member_ign: string | null;
  member_uid: string | null;
  member_level: number | null;
  status: string | null;
};

export default function ManageParticipantsPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Participant | null>(null);
  const [duoTeams, setDuoTeams] = useState<DuoTeam[]>([]);

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  async function loadData() {
    setLoading(true);
    setError("");
    setDuoTeams([]);

    try {
      const { data: t, error: tError } = await supabase
        .from("tournaments")
        .select("id, title, game, mode, max_players")
        .eq("id", tournamentId)
        .single();

      if (tError || !t) {
        setError("Tournament not found.");
        setLoading(false);
        return;
      }

      setTournament(t as Tournament);
      const isDuo = String(t.mode || "").trim().toLowerCase() === "duo";

      const { data: entryRows, error: pError } = await supabase
        .from("tournament_entries")
        .select("id, user_id, free_fire_uid, game_name, cancelled")
        .eq("tournament_id", tournamentId)
        .eq("cancelled", false);

      if (pError) throw pError;
      const entries = entryRows || [];

      if (isDuo) {
        const { data: teamRows, error: teamError } = await supabase
          .from("duo_teams")
          .select("id, team_code, team_name, creator_user_id, creator_ign, creator_uid, creator_level, member_user_id, member_ign, member_uid, member_level, status")
          .eq("tournament_id", tournamentId)
          .neq("status", "cancelled")
          .order("id", { ascending: true });
        if (teamError) throw teamError;
        setDuoTeams((teamRows || []) as DuoTeam[]);
      }

      const userIds = [...new Set(entries.map((item: any) => item.user_id).filter(Boolean))];
      let usersById: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: userRows, error: uError } = await supabase
          .from("users")
          .select("id, full_name, phone, email, free_fire_uid, game_name, level, role, ip_address, status, bio, avatar_url")
          .in("id", userIds);
        if (uError) throw uError;
        usersById = Object.fromEntries((userRows || []).map((user: any) => [String(user.id), user]));
      }

      setParticipants(entries.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        free_fire_uid: item.free_fire_uid ?? null,
        game_name: item.game_name ?? null,
        cancelled: Boolean(item.cancelled),
        user: usersById[String(item.user_id)] ?? null,
      })));
    } catch (err: any) {
      console.error("Participants:", err);
      setError(err?.message || "Unable to load participants.");
    } finally {
      setLoading(false);
    }
  }

  const isDuoTournament = String(tournament?.mode || "").trim().toLowerCase() === "duo";

  const filteredParticipants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => {
      const u = p.user;
      return [p.game_name, p.free_fire_uid, p.user_id, u?.full_name, u?.phone, u?.email, u?.game_name, u?.free_fire_uid]
        .some((value) => String(value ?? "").toLowerCase().includes(q));
    });
  }, [participants, search]);

  const filteredDuoTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return duoTeams;
    const byUser = new Map<string, Participant>(participants.map((p): [string, Participant] => [String(p.user_id), p]));
    return duoTeams.filter((team) => {
      const creator = byUser.get(String(team.creator_user_id));
      const member = team.member_user_id ? byUser.get(String(team.member_user_id)) : null;
      return [team.team_name, team.team_code, team.creator_ign, team.creator_uid, team.member_ign, team.member_uid, creator?.user?.full_name, creator?.user?.phone, member?.user?.full_name, member?.user?.phone]
        .some((value) => String(value ?? "").toLowerCase().includes(q));
    });
  }, [duoTeams, participants, search]);

  function formatDate(value: string | null) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function removeParticipant(participant: Participant) {
    const name =
      participant.game_name ||
      participant.user?.game_name ||
      participant.user?.full_name ||
      "this participant";

    if (!window.confirm(`Remove ${name} from this tournament?`)) return;

    const { error } = await supabase
      .from("tournament_entries")
      .update({ cancelled: true })
      .eq("id", participant.id)
      .eq("tournament_id", tournamentId);

    if (error) {
      setError(error.message);
      return;
    }

    setSelected(null);
    await loadData();
  }

  return (
    <main className="min-h-screen bg-[#070b10] text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/admin/tournaments/${tournamentId}`}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-gray-300 hover:bg-white/10"
            >
              ← BACK
            </Link>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                Tournament Participants
              </p>
              <h1 className="truncate text-xl font-black sm:text-2xl">
                {tournament?.title || "Loading..."}
              </h1>
              {tournament && (
                <p className="mt-1 text-xs text-gray-500">
                  {tournament.game || "—"} · {tournament.mode || "—"}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <div className="rounded-xl border border-white/10 bg-[#101722] px-4 py-2 text-center">
              <div className="text-[8px] font-black uppercase tracking-wider text-gray-500">
                {isDuoTournament ? "Teams" : "Joined"}
              </div>
              <div className="mt-0.5 text-lg font-black text-emerald-400">
                {isDuoTournament ? duoTeams.length : participants.length}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#101722] px-4 py-2 text-center">
              <div className="text-[8px] font-black uppercase tracking-wider text-gray-500">Slots</div>
              <div className="mt-0.5 text-lg font-black">
                {isDuoTournament ? 24 : tournament?.max_players ?? "—"}
              </div>
            </div>
            {isDuoTournament && (
              <div className="rounded-xl border border-white/10 bg-[#101722] px-4 py-2 text-center">
                <div className="text-[8px] font-black uppercase tracking-wider text-gray-500">Players</div>
                <div className="mt-0.5 text-lg font-black text-sky-400">{participants.length} / 48</div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-300">
            ⚠️ {error}
          </div>
        )}

        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0d141d] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black">All Joined Participants</h2>
            <p className="mt-1 text-[10px] text-gray-500">
              Click any participant to view complete user information.
            </p>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search game name, UID, name, phone..."
            className="w-full rounded-xl border border-white/10 bg-[#080d13] px-4 py-2.5 text-xs text-white outline-none placeholder:text-gray-600 focus:border-red-500 sm:max-w-[310px]"
          />
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-[#0d141d] py-20 text-center text-sm text-gray-500">
            Loading participants...
          </div>
        ) : isDuoTournament ? (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d141d]">
            {filteredDuoTeams.length === 0 ? (
              <div className="py-20 text-center text-sm text-gray-500">No active teams found.</div>
            ) : (
              filteredDuoTeams.map((team, index) => {
                const creator = participants.find((p) => String(p.user_id) === String(team.creator_user_id));
                const member = team.member_user_id ? participants.find((p) => String(p.user_id) === String(team.member_user_id)) : null;
                const players = [
                  { label: "PLAYER 1", participant: creator, ign: team.creator_ign, uid: team.creator_uid, level: team.creator_level },
                  ...(team.member_user_id ? [{ label: "PLAYER 2", participant: member, ign: team.member_ign, uid: team.member_uid, level: team.member_level }] : []),
                ];
                return (
                  <div key={team.id} className="border-b border-white/5 p-4 last:border-b-0">
                    <div className="mb-3 flex flex-col gap-2 rounded-xl border border-red-500/10 bg-red-500/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-[8px] font-black uppercase tracking-[0.18em] text-red-400">TEAM #{String(index + 1).padStart(2, "0")} · {team.team_code}</div>
                        <div className="mt-1 truncate text-sm font-black text-white">{team.team_name || `Team ${String(index + 1).padStart(2, "0")}`}</div>
                      </div>
                      <div className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-[8px] font-black uppercase text-gray-400">{team.member_user_id ? "2 / 2 PLAYERS" : "1 / 2 · WAITING"}</div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {players.map((row) => {
                        const p = row.participant;
                        const gameName = row.ign || p?.game_name || p?.user?.game_name || "—";
                        const uid = row.uid || p?.free_fire_uid || p?.user?.free_fire_uid || "—";
                        const level = row.level ?? p?.user?.level ?? "—";
                        return (
                          <button key={`${team.id}-${row.label}`} type="button" disabled={!p} onClick={() => p && setSelected(p)} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#080d13] p-3 text-left transition hover:bg-white/[0.025] disabled:cursor-default">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#111a25] text-sm">
                              {p?.user?.avatar_url ? <img src={p.user.avatar_url} alt="" className="h-full w-full object-cover" /> : "👤"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[8px] font-black uppercase tracking-wider text-gray-600">{row.label}</div>
                              <div className="truncate text-xs font-black text-white">{gameName}</div>
                              <div className="truncate font-mono text-[9px] text-emerald-400">UID: {uid}</div>
                              <div className="text-[9px] font-bold text-yellow-400">⭐ Level {level}</div>
                              {p?.user?.full_name && <div className="truncate text-[9px] text-gray-500">{p.user.full_name}</div>}
                            </div>
                          </button>
                        );
                      })}
                      {!team.member_user_id && (
                        <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-4 text-center">
                          <div><div className="text-lg">⏳</div><div className="mt-1 text-[9px] font-black uppercase tracking-wider text-gray-500">Waiting for Player 2</div></div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : filteredParticipants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d141d] py-20 text-center text-sm text-gray-500">No active participants found.</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d141d]">
            <div className="hidden grid-cols-[70px_1.5fr_1.2fr_100px_70px_110px] gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-3 text-[8px] font-black uppercase tracking-wider text-gray-500 md:grid"><div>#</div><div>Game Name</div><div>UID</div><div>Level</div><div>Status</div><div>Joined</div></div>
            <div>
              {filteredParticipants.map((participant, index) => {
                const gameName = participant.game_name || participant.user?.game_name || "—";
                const uid = participant.free_fire_uid || participant.user?.free_fire_uid || "—";
                const level = participant.user?.level ?? "—";
                return (
                  <button key={participant.id} type="button" onClick={() => setSelected(participant)} className="grid w-full grid-cols-[34px_1fr_auto] items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/[0.025] md:grid-cols-[70px_1.5fr_1.2fr_100px_70px_110px] md:gap-3">
                    <div className="text-xs font-black text-gray-600">#{String(index + 1).padStart(2, "0")}</div>
                    <div className="flex min-w-0 items-center gap-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#111a25] text-xs">{participant.user?.avatar_url ? <img src={participant.user.avatar_url} alt="" className="h-full w-full object-cover" /> : "👤"}</div><div className="min-w-0"><div className="truncate text-xs font-black text-white">{gameName}</div><div className="truncate text-[9px] text-gray-600 md:hidden">UID: {uid} · Level {level}</div></div></div>
                    <div className="hidden truncate font-mono text-[10px] font-bold text-gray-400 md:block">{uid}</div>
                    <div className="hidden text-xs font-black text-yellow-400 md:block">⭐ {level}</div>
                    <div className="hidden md:block"><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[8px] font-black text-emerald-400">ACTIVE</span></div>
                    <div className="hidden text-[9px] font-bold text-gray-500 md:block">{formatDate(null)}</div>
                    <div className="text-right text-gray-600 md:hidden">→</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0b121b] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b121b] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-red-400">
                  Participant Details
                </p>
                <h3 className="truncate text-lg font-black">
                  {selected.game_name ||
                    selected.user?.game_name ||
                    selected.user?.full_name ||
                    "Participant"}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black text-gray-300 hover:bg-white/10"
              >
                CLOSE
              </button>
            </div>

            <div className="p-5">
              <div className="mb-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#111a25] text-2xl">
                  {selected.user?.avatar_url ? (
                    <img
                      src={selected.user.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    "👤"
                  )}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-lg font-black">
                    {selected.game_name ||
                      selected.user?.game_name ||
                      "—"}
                  </div>
                  <div className="mt-1 font-mono text-xs text-emerald-400">
                    UID:{" "}
                    {selected.free_fire_uid ||
                      selected.user?.free_fire_uid ||
                      "—"}
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-yellow-400">
                    ⭐ Level {selected.user?.level ?? "—"}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Full Name" value={selected.user?.full_name} />
                <Detail label="Game Name" value={selected.game_name || selected.user?.game_name} />
                <Detail label="Free Fire UID" value={selected.free_fire_uid || selected.user?.free_fire_uid} />
                <Detail label="Level" value={selected.user?.level} />
                <Detail label="Phone" value={selected.user?.phone} />
                <Detail label="Email" value={selected.user?.email} />
                <Detail label="User ID" value={selected.user_id} mono />
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-[#080d13] p-4">
                <div className="mb-2 text-[8px] font-black uppercase tracking-wider text-gray-600">
                  Bio
                </div>
                <div className="text-xs leading-5 text-gray-300">
                  {selected.user?.bio || "—"}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => removeParticipant(selected)}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[10px] font-black text-red-300 hover:bg-red-500/20"
                >
                  REMOVE FROM TOURNAMENT
                </button>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-xl bg-white/10 px-4 py-2.5 text-[10px] font-black text-white hover:bg-white/15"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: unknown;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-[#080d13] p-3">
      <div className="mb-1 text-[8px] font-black uppercase tracking-wider text-gray-600">
        {label}
      </div>
      <div
        className={`break-words text-xs font-bold text-gray-200 ${
          mono ? "font-mono text-[10px]" : ""
        }`}
      >
        {String(value ?? "—")}
      </div>
    </div>
  );
}
