"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ParticipantUser = {
  full_name: string | null;
  email: string | null;
  game_name: string | null;
  free_fire_uid: string | null;
  level: number | null;
  bio: string | null;
  avatar_url: string | null;
};

type Participant = {
  id: string;
  user_id: string;
  game_name: string | null;
  free_fire_uid: string | null;
  level: number | null;
  joined_at: string | null;
  user: ParticipantUser | null;
};

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
  rules: string[] | null;
  status: string | null;
  banner_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  joined_players?: number;
  room_id?: string | null;
  room_password?: string | null;
};


export default function TournamentsAdminPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKeysPopup, setShowKeysPopup] = useState(false);
  const [keysTournamentId, setKeysTournamentId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [gameFilter, setGameFilter] = useState("all");
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null);
  const [keys, setKeys] = useState<Record<string, { roomId: string; roomPassword: string }>>({});
  const [liveKeysSaving, setLiveKeysSaving] = useState<string | null>(null);

  async function loadTournaments() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("tournaments")
      .select(
        `
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
        rules,
        status,
        banner_url,
        created_at,
        updated_at
        `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage(error.message);
      setTournaments([]);
    } else {
      const baseTournaments = (data || []) as Tournament[];

      const matchRows = await Promise.all(
        baseTournaments.map(async (tournament) => {
          const { data: matchData } = await supabase
            .from("matches")
            .select("room_id, room_password")
            .eq("tournament_id", tournament.id)
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: tournament.id,
            roomId: matchData?.room_id ?? "",
            roomPassword: matchData?.room_password ?? "",
          };
        })
      );

      setKeys(
        Object.fromEntries(
          matchRows.map((row) => [row.id, { roomId: row.roomId, roomPassword: row.roomPassword }])
        )
      );

      // Count only active/joined entries (cancelled entries are excluded).
      const withJoinedCounts = await Promise.all(
        baseTournaments.map(async (tournament) => {
          const { count, error: countError } = await supabase
            .from("tournament_entries")
            .select("id", { count: "exact", head: true })
            .eq("tournament_id", tournament.id)
            .eq("cancelled", false);

          if (countError) {
            console.error(`Player count failed for ${tournament.id}:`, countError);
          }

          return {
            ...tournament,
            joined_players: count ?? 0,
          };
        })
      );

      setTournaments(withJoinedCounts);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadTournaments();
  }, []);

  async function makeKeysLive(tournamentId: string) {
    const current = keys[tournamentId] || {
      roomId: "",
      roomPassword: "",
    };

    const roomId = current.roomId.trim();
    const roomPassword = current.roomPassword.trim();

    if (!roomId || !roomPassword) {
      alert("Enter Room ID and Room Password first.");
      return;
    }

    setLiveKeysSaving(tournamentId);

    try {
      // Get the current Supabase Auth session so the API can verify
      // the logged-in admin using a Bearer access token.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/admin/keys", {
        method: "POST",
        headers,
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          tournamentId,
          roomId,
          roomPassword,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || "Failed to send LIVE KEYS."
        );
      }

      setTournaments((currentTournaments) =>
        currentTournaments.map((tournament) =>
          tournament.id === tournamentId
            ? {
                ...tournament,
                status: "live",
                room_id: roomId,
                room_password: roomPassword,
                updated_at: new Date().toISOString(),
              }
            : tournament
        )
      );

      alert("LIVE KEYS sent to users successfully.");

      setShowKeysPopup(false);
      setKeysTournamentId(null);

      await loadTournaments();
    } catch (error) {
      console.error("LIVE KEYS error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Failed to send LIVE KEYS."
      );
    } finally {
      setLiveKeysSaving(null);
    }
  }

  async function showParticipants(tournament: Tournament) {
    setSelectedTournament(tournament);
    setParticipantsOpen(true);
    setParticipantsLoading(true);
    setParticipants([]);
    setExpandedParticipant(null);

    const { data, error } = await supabase
      .from("tournament_entries")
      .select(`
        id,
        user_id,
        game_name,
        free_fire_uid,
        created_at,
        users (
          full_name,
          email,
          game_name,
          free_fire_uid,
          level,
          bio,
          avatar_url
        )
      `)
      .eq("tournament_id", tournament.id)
      .eq("cancelled", false)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setMessage(error.message);
      setParticipants([]);
    } else {
      setParticipants(
        (data || []).map((entry: any) => ({
          id: entry.id,
          user_id: entry.user_id,
          game_name: entry.game_name ?? entry.users?.game_name ?? null,
          free_fire_uid: entry.free_fire_uid ?? entry.users?.free_fire_uid ?? null,
          level: entry.users?.level ?? null,
          joined_at: entry.created_at ?? null,
          user: entry.users ?? null,
        }))
      );
    }

    setParticipantsLoading(false);
  }

  function closeParticipants() {
    setParticipantsOpen(false);
    setSelectedTournament(null);
    setParticipants([]);
    setExpandedParticipant(null);
  }

  function formatJoinedDate(date: string | null) {
    if (!date) return "Not available";
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

  async function toggleStatus(tournament: Tournament) {
    const newStatus =
      tournament.status === "disabled"
        ? "upcoming"
        : "disabled";

    const { error } = await supabase
      .from("tournaments")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tournament.id);

    if (error) {
      alert(error.message);
      return;
    }

    setTournaments((current) =>
      current.map((item) =>
        item.id === tournament.id
          ? {
              ...item,
              status: newStatus,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );
  }

  async function deleteTournament(tournament: Tournament) {
    const confirmed = window.confirm(
      `Delete "${tournament.title}" permanently?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setDeleting(tournament.id);

    /*
     * Delete tournament entries first.
     * This prevents foreign-key errors when tournament_entries
     * references tournaments.id.
     */
    const { error: entriesError } = await supabase
      .from("tournament_entries")
      .delete()
      .eq("tournament_id", tournament.id);

    if (entriesError) {
      console.error(entriesError);
      alert(
        `Could not delete tournament entries:\n${entriesError.message}`
      );
      setDeleting(null);
      return;
    }

    /*
     * Delete results before matches.
     * results.match_id can reference matches.id.
     */
    const { data: tournamentMatches, error: matchLookupError } =
      await supabase
        .from("matches")
        .select("id")
        .eq("tournament_id", tournament.id);

    if (matchLookupError) {
      console.error(matchLookupError);
      alert(
        `Could not check tournament matches:\n${matchLookupError.message}`
      );
      setDeleting(null);
      return;
    }

    const matchIds = (tournamentMatches || []).map(
      (match) => match.id
    );

    if (matchIds.length > 0) {
      const { error: resultsError } = await supabase
        .from("results")
        .delete()
        .in("match_id", matchIds);

      if (resultsError) {
        console.error(resultsError);
        alert(
          `Could not delete tournament results:\n${resultsError.message}`
        );
        setDeleting(null);
        return;
      }
    }

    /*
     * Now matches can safely be deleted.
     */
    const { error: matchesError } = await supabase
      .from("matches")
      .delete()
      .eq("tournament_id", tournament.id);

    if (matchesError) {
      console.error(matchesError);
      alert(
        `Could not delete tournament matches:\n${matchesError.message}`
      );
      setDeleting(null);
      return;
    }

    /*
     * tournament_prizes use ON DELETE CASCADE,
     * so their rows are removed automatically.
     */
    const { error } = await supabase
      .from("tournaments")
      .delete()
      .eq("id", tournament.id);

    if (error) {
      console.error(error);
      alert(error.message);
      setDeleting(null);
      return;
    }

    setTournaments((current) =>
      current.filter((item) => item.id !== tournament.id)
    );

    setDeleting(null);
  }

  function formatDate(date: string | null) {
    if (!date) return "Not scheduled";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function matchesGameFilter(tournament: Tournament, filter: string) {
    if (filter === "all") return true;

    const game = String(tournament.game || "").toLowerCase().replace(/[_-]/g, " ");
    const mode = String(tournament.mode || "").toLowerCase().replace(/[_-]/g, " ");
    const combined = `${game} ${mode}`;

    if (filter === "freefire") {
      return (game.includes("free fire") || game === "ff" || game === "freefire") &&
        !combined.includes("max");
    }

    if (filter === "freefiremax") {
      return combined.includes("free fire max") || combined.includes("freefire max") || combined.includes("ff max") || game === "ffmax";
    }

    if (filter === "clashsquad") {
      return mode.includes("clash squad") || game.includes("clash squad") || combined.includes("clash squad");
    }

    if (filter === "lonewolf") {
      return mode.includes("lone wolf") || game.includes("lone wolf") || combined.includes("lone wolf");
    }

    return true;
  }

  const filteredTournaments = tournaments.filter((tournament) => {
    // Completed tournaments are kept separately on the Past Matches page.
    if (String(tournament.status || "").toLowerCase() === "completed") {
      return false;
    }

    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query ||
      String(tournament.title || "").toLowerCase().includes(query) ||
      String(tournament.id || "").toLowerCase().includes(query);

    return matchesSearch && matchesGameFilter(tournament, gameFilter);
  });

  function getStatusClass(status: string | null) {
    switch (status) {
      case "live":
        return "live";

      case "completed":
        return "completed";

      case "disabled":
        return "disabled";

      default:
        return "upcoming";
    }
  }

  return (
    <main className="tournament-admin">
      <style jsx>{`
        .tournament-admin {
          min-height: 100vh;
          padding: 18px;
          box-sizing: border-box;
          background:
            radial-gradient(circle at 85% 0%, rgba(239, 22, 56, 0.08), transparent 28%),
            #070b12;
          color: #fff;
        }
        .topbar {
          display:flex; align-items:flex-start; justify-content:space-between;
          gap:12px; margin-bottom:16px;
        }
        .heading h1 { margin:0; font-size:22px; font-weight:950; color:#f5f7fb; }
        .heading p { margin:4px 0 0; color:#77849a; font-size:10px; }
        .create-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 14px;
          border-radius: 11px;
          border: 1px solid rgba(255,255,255,.10);
          box-shadow: 0 7px 20px rgba(0,0,0,.20);
          transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
          text-decoration: none;
        }

        .create-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(0,0,0,.28);
          filter: brightness(1.05);
        }

        .create-button:active {
          transform: scale(.98);
        }

        .create-button {
          display:inline-flex; align-items:center; justify-content:center;
          min-height:34px; padding:0 17px; border-radius:10px;
          background:linear-gradient(135deg,#ef1638,#c90d2e);
          color:#fff; text-decoration:none; font-size:10px; font-weight:900;
          box-shadow:0 8px 25px rgba(239,22,56,.2);
        }
        .message {
          margin-bottom:18px; padding:12px 14px; border:1px solid #5b2632;
          border-radius:9px; background:#1b1017; color:#ff8da0;
          font-size:11px; font-weight:700;
        }
        .stats {
          display:grid; grid-template-columns:repeat(4,minmax(0,1fr));
          gap:12px; margin-bottom:20px;
        }
        .stat {
          padding:16px; border:1px solid #1d2a3b; border-radius:11px; background:#0d1520;
        }
        .stat-label {
          color:#718097; font-size:9px; font-weight:800;
          text-transform:uppercase; letter-spacing:1px;
        }
        .stat-value { margin-top:7px; color:#f4f7fb; font-size:22px; font-weight:950; }
        .stat-value.green { color:#36d991; }

        .cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
        .card {
          overflow:hidden; border:1px solid #1d2a3b; border-radius:14px;
          background:linear-gradient(180deg,#0f1824,#0b131e);
          transition:.18s ease;
        }
        .card:hover { border-color:#30435b; transform:translateY(-1px); }
        .card-top { padding:17px; border-bottom:1px solid #1a2738; }
        .title-line { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .title { min-width:0; color:#f5f7fb; font-size:15px; font-weight:950; }
        .sub { margin-top:5px; color:#65748a; font-size:9px; }
        .status {
          flex-shrink:0; padding:5px 8px; border-radius:999px;
          font-size:7px; font-weight:900; text-transform:uppercase;
        }
        .upcoming { color:#58a9ff; background:rgba(88,169,255,.1); }
        .live { color:#36dc91; background:rgba(54,220,145,.1); }
        .completed { color:#aab5c5; background:rgba(170,181,197,.1); }
        .disabled { color:#ff687f; background:rgba(255,104,127,.1); }
        .facts {
          display:grid; grid-template-columns:repeat(4,minmax(0,1fr));
          gap:7px; margin-top:15px;
        }
        .fact {
          min-width:0; padding:9px; border:1px solid #182638;
          border-radius:9px; background:#09111b;
        }
        .fact-label { color:#56657a; font-size:7px; font-weight:900; text-transform:uppercase; }
        .fact-value { margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
          color:#dce4ee; font-size:10px; font-weight:900; }
        .money { color:#35d88e; }
        .card-actions {
          display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:12px 17px;
          background:rgba(255,255,255,.012);
        }
        .action {
          display:inline-flex; align-items:center; justify-content:center;
          min-height:30px; padding:0 7px; border-radius:8px;
          border:1px solid #27374c; background:#101a27; color:#aab6c7;
          text-decoration:none; cursor:pointer; font-size:8px; font-weight:900;
        }
        .action:hover { color:#fff; border-color:#3a4e69; background:#142031; }
        .action.green { color:#43dc96; border-color:rgba(67,220,150,.22); }
        .action.yellow { color:#ffc85a; border-color:rgba(255,200,90,.22); }
        .action.red { color:#ff7185; border-color:rgba(255,113,133,.22); }
        .action:disabled { opacity:.5; cursor:not-allowed; }
        .empty,.loading { padding:65px 20px; text-align:center; color:#718097; font-size:10px; }
        .filters-bar {
          display:flex;
          align-items:center;
          gap:12px;
          margin-bottom:18px;
          padding:12px;
          border:1px solid rgba(255,255,255,.07);
          border-radius:14px;
          background:rgba(13,18,28,.92);
        }
        .search-wrap {
          position:relative;
          flex:1;
          min-width:0;
        }
        .search-icon {
          position:absolute;
          left:13px;
          top:50%;
          transform:translateY(-50%);
          color:#8c98ab;
          font-size:20px;
          pointer-events:none;
        }
        .search-input {
          width:100%;
          height:42px;
          box-sizing:border-box;
          border:1px solid rgba(255,255,255,.09);
          border-radius:10px;
          outline:none;
          background:#090e17;
          color:#f5f7fb;
          padding:0 38px 0 38px;
          font-size:10px;
        }
        .search-input::placeholder { color:#667388; }
        .search-input:focus { border-color:rgba(239,22,56,.55); box-shadow:0 0 0 3px rgba(239,22,56,.08); }
        .clear-search {
          position:absolute;
          right:9px;
          top:50%;
          transform:translateY(-50%);
          border:0;
          background:transparent;
          color:#9aa6b8;
          cursor:pointer;
          font-size:20px;
          line-height:1;
        }
        .filter-wrap { display:flex; align-items:center; gap:9px; flex-shrink:0; }
        .filter-label { color:#718097; font-size:9px; font-weight:900; letter-spacing:.8px; }
        .game-filter {
          height:42px;
          min-width:165px;
          border:1px solid rgba(255,255,255,.09);
          border-radius:10px;
          outline:none;
          background:#090e17;
          color:#f5f7fb;
          padding:0 9px;
          font-size:11px;
          font-weight:800;
          cursor:pointer;
        }
        .game-filter:focus { border-color:rgba(239,22,56,.55); }
        @media(max-width:900px) {
          .tournament-admin { padding:12px 9px; }
          .cards { grid-template-columns:1fr; gap:7px; }
          .card { border-radius:10px; }
          .card-top { padding:10px !important; }
          .title { font-size:14px !important; }
          .sub { font-size:9px !important; }
          .facts { gap:5px !important; }
          .fact { padding:7px !important; }
          .fact-label { font-size:8px !important; }
          .fact-value { font-size:10px !important; }
          .card-actions { gap:5px !important; padding:8px 9px !important; }
          .action { min-height:30px !important; font-size:8px !important; padding:0 6px !important; }
        }
        @media(max-width:600px) {
          .filters-bar { flex-direction:column; align-items:stretch; gap:7px !important; margin-bottom:10px !important; padding:8px !important; }
          .filter-wrap { width:100%; gap:6px !important; }
          .game-filter { width:100%; min-width:0; height:34px !important; font-size:9px !important; }
          .search-input { height:34px !important; font-size:10px !important; padding-left:32px !important; }
          .search-icon { left:10px !important; font-size:16px !important; }
          .heading h1 { font-size:19px !important; }
          .heading p { font-size:9px !important; }
          .topbar { margin-bottom:10px !important; gap:8px !important; }
          .create-button { min-height:32px !important; font-size:9px !important; padding:0 10px !important; }
          .stats { gap:6px !important; margin-bottom:10px !important; }
          .stat { padding:8px !important; }
          .stat-label { font-size:7px !important; }
          .stat-value { font-size:13px !important; }
          .keys-popup { width:calc(100vw - 24px) !important; max-width:none !important; padding:12px !important; }
        }
        @media(max-width:600px) {
          .topbar { flex-direction:column; }
          .create-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 0 14px;
          border-radius: 11px;
          border: 1px solid rgba(255,255,255,.10);
          box-shadow: 0 7px 20px rgba(0,0,0,.20);
          transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
          text-decoration: none;
        }

        .create-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px rgba(0,0,0,.28);
          filter: brightness(1.05);
        }

        .create-button:active {
          transform: scale(.98);
        }

        .create-button { width:100%; }
          .stats { grid-template-columns:1fr 1fr; }
          .facts { grid-template-columns:1fr 1fr; }
          .card-actions { grid-template-columns:1fr 1fr; }
        }

        .start-time-highlight {
          display:flex; align-items:center; gap:7px; width:100%; margin-bottom:14px;
          padding:11px 13px; border:1px solid #fecaca; border-radius:9px;
          background:linear-gradient(135deg,#fff1f2 0%,#ffffff 100%);
          box-shadow:0 4px 12px rgba(239,68,68,.08);
        }
        .start-time-icon {
          display:flex; align-items:center; justify-content:center; width:34px; height:34px;
          flex:0 0 34px; border-radius:10px; background:#ef4444; color:#fff; font-size:17px;
          box-shadow:0 3px 8px rgba(239,68,68,.2);
        }
        .start-time-highlight > span:last-child { display:flex; min-width:0; flex-direction:column; gap:2px; }
        .start-time-highlight small { font-size:9px; font-weight:900; letter-spacing:.12em; color:#ef4444; }
        .start-time-highlight strong { font-size:10px; line-height:1.2; font-weight:900; color:#111827; }
      `}</style>

      <div className="topbar">
        <div className="heading">
          <h1>🏆 Tournament Management</h1>
          <p>Choose a tournament to open its dedicated management page.</p>
        </div>
        <div style={{display:"flex", gap:7, flexWrap:"wrap", justifyContent:"flex-end"}}>
            <Link href="/admin/tournaments/past-matches" className="create-button" style={{background:"#182333", border:"1px solid #2b3a4e"}}>
              🕘 PAST MATCHES
            </Link>
            <Link href="/admin/tournaments/create" className="create-button">
          ＋ CREATE TOURNAMENT
        </Link>
          </div>
        </div>

      {message && <div className="message">⚠️ {message}</div>}

      <div className="filters-bar">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search match name or match ID..."
            className="search-input"
          />
          {searchQuery && (
            <button type="button" className="clear-search" onClick={() => setSearchQuery("")}>
              ×
            </button>
          )}
        </div>

        <div className="filter-wrap">
          <span className="filter-label">FILTER</span>
          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value)}
            className="game-filter"
          >
            <option value="all">All Games</option>
            <option value="freefire">Free Fire</option>
            <option value="freefiremax">Free Fire MAX</option>
            <option value="clashsquad">Clash Squad</option>
            <option value="lonewolf">Lone Wolf</option>
          </select>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Total</div>
          <div className="stat-value">{loading ? "—" : tournaments.length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Upcoming</div>
          <div className="stat-value">
            {loading ? "—" : tournaments.filter((t) => t.status === "upcoming").length}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Live</div>
          <div className="stat-value green">
            {loading ? "—" : tournaments.filter((t) => t.status === "live").length}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Completed</div>
          <div className="stat-value">
            {loading ? "—" : tournaments.filter((t) => t.status === "completed").length}
          </div>
        </div>
      </div>

      {loading ? (
        <section className="card"><div className="loading">Loading tournaments...</div></section>
      ) : tournaments.length === 0 ? (
        <section className="card">
          <div className="empty">
            No tournaments found.
            <br />
            Create your first tournament.
          </div>
        </section>
      ) : filteredTournaments.length === 0 ? (
        <section className="card">
          <div className="empty">
            No tournaments match your search/filter.
            <br />
            Try another match name, match ID, or game filter.
          </div>
        </section>
      ) : (
        <div className="cards">
          {filteredTournaments.map((tournament) => (
            <article className="card" key={tournament.id}>
              <div className="card-top">
                <div className="title-line">
                  <div style={{minWidth:0}}>
                    <div className="start-time-highlight">
                      <span className="start-time-icon">⏰</span>
                      <span>
                        <small>STARTS</small>
                        <strong>{formatDate(tournament.start_time)}</strong>
                      </span>
                    </div>
                    <div className="title">{tournament.title}</div>
                    <div className="sub">
                      {tournament.game || "—"} · {tournament.mode || "—"} · {tournament.map || "No map"}
                    </div>
                  </div>
                  <span className={`status ${getStatusClass(tournament.status)}`}>
                    {tournament.status || "upcoming"}
                  </span>
                </div>

                <div className="facts">
                  <div className="fact">
                    <div className="fact-label">Entry</div>
                    <div className="fact-value money">₹{Number(tournament.entry_fee || 0).toFixed(2)}</div>
                  </div>
                  <div className="fact">
                    <div className="fact-label">Prize</div>
                    <div className="fact-value money">₹{Number(tournament.prize_pool || 0).toFixed(2)}</div>
                  </div>
                  <div className="fact">
                    <div className="fact-label">Players</div>
                    <div className="fact-value">👥 {tournament.joined_players || 0}/{tournament.max_players || 0}</div>
                  </div>
                  <div className="fact">
                    <div className="fact-label">Kill</div>
                    <div className="fact-value money">₹{Number(tournament.kill_reward || 0).toFixed(2)}</div>
                  </div>
                </div>

                <div className="sub" style={{marginTop:12}}>
                  Starts: {formatDate(tournament.start_time)}
                </div>
              </div>

              <div style={{marginTop:14, padding:12, border:"1px solid rgba(255,255,255,.07)", borderRadius:12, background:"rgba(255,255,255,.015)"}}>
                <button
                  type="button"
                  onClick={() => {
                    setKeysTournamentId(tournament.id);
                    setShowKeysPopup(true);
                  }}
                  style={{width:"100%", border:"1px solid rgba(255,255,255,.10)", borderRadius:8, padding:"8px 10px", background:"#111b28", color:"#fff", fontWeight:900, cursor:"pointer"}}
                >
                  🔑 KEYS
                </button>
              </div>

              <div className="card-actions">
                <button
                  type="button"
                  className="action action-edit"
                  onClick={() => router.push(`/admin/tournaments/${tournament.id}`)}
                >
                  EDIT
                </button>
                <button
                  type="button"
                  className="action action-participants"
                  onClick={() => router.push(`/admin/tournaments/${tournament.id}/participants`)}
                >
                  👥 PARTICIPANTS
                </button>
                <button
                  type="button"
                  className="action green"
                  onClick={() => router.push(`/admin/tournaments/${tournament.id}/results`)}
                >
                  🏆 RESULTS
                </button>
                <button
                  className={`action ${tournament.status === "disabled" ? "green" : "yellow"}`}
                  onClick={() => toggleStatus(tournament)}
                >
                  {tournament.status === "disabled" ? "ENABLE" : "DISABLE"}
                </button>
                <button
                  className="action red"
                  disabled={deleting === tournament.id}
                  onClick={() => deleteTournament(tournament)}
                  style={{gridColumn:"1 / -1"}}
                >
                  {deleting === tournament.id ? "DELETING..." : "DELETE TOURNAMENT"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {showKeysPopup && keysTournamentId && (() => {
        const current = keys[keysTournamentId] || { roomId: "", roomPassword: "" };
        const selected = tournaments.find((t) => t.id === keysTournamentId);
        return (
          <div
            onClick={() => setShowKeysPopup(false)}
            style={{position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,.72)", backdropFilter:"blur(7px)"}}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{width:"100%", maxWidth:430, border:"1px solid rgba(255,255,255,.10)", borderRadius:18, background:"#101722", padding:20, boxShadow:"0 25px 70px rgba(0,0,0,.55)"}}
            >
              <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:18}}>
                <div>
                  <div style={{fontSize:18, fontWeight:950}}>🔑 KEYS</div>
                  <div style={{marginTop:4, fontSize:10, color:"#718097"}}>{selected?.title || "Tournament"}</div>
                </div>
                <button type="button" onClick={() => setShowKeysPopup(false)} style={{border:0, background:"rgba(255,255,255,.06)", color:"#9aa6b8", borderRadius:9, padding:"7px 10px", cursor:"pointer"}}>✕</button>
              </div>

              <div style={{display:"grid", gap:14}}>
                <div>
                  <label style={{display:"block", marginBottom:7, fontSize:10, fontWeight:900, color:"#8b98aa"}}>ROOM ID</label>
                  <input
                    value={current.roomId}
                    onChange={(e) => setKeys((prev) => ({...prev, [keysTournamentId]: {...current, roomId:e.target.value}}))}
                    placeholder="Enter Room ID"
                    className="search-input"
                    style={{width:"100%", boxSizing:"border-box"}}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{display:"block", marginBottom:7, fontSize:10, fontWeight:900, color:"#8b98aa"}}>ROOM PASSWORD</label>
                  <input
                    value={current.roomPassword}
                    onChange={(e) => setKeys((prev) => ({...prev, [keysTournamentId]: {...current, roomPassword:e.target.value}}))}
                    placeholder="Enter Room Password"
                    className="search-input"
                    style={{width:"100%", boxSizing:"border-box"}}
                  />
                </div>
              </div>

              <div style={{display:"grid", gridTemplateColumns:"1fr 1.5fr", gap:9, marginTop:18}}>
                <button type="button" onClick={() => setShowKeysPopup(false)} className="action" style={{minHeight:42}}>CANCEL</button>
                <button
                  type="button"
                  onClick={async () => { await makeKeysLive(keysTournamentId); }}
                  disabled={liveKeysSaving === keysTournamentId || !current.roomId.trim() || !current.roomPassword.trim()}
                  style={{minHeight:42, border:0, borderRadius:8, background:"#ef1638", color:"#fff", fontSize:9, fontWeight:950, cursor:"pointer", opacity:(liveKeysSaving === keysTournamentId || !current.roomId.trim() || !current.roomPassword.trim()) ? .5 : 1}}
                >
                  {liveKeysSaving === keysTournamentId ? "GOING LIVE..." : "🔴 LIVE KEYS"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </main>
  );
}
