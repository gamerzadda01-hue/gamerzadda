"use client";

import Link from "next/link";
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
};

export default function PastMatchesAdminPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [gameFilter, setGameFilter] = useState("all");
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null);

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
      setTournaments((data || []) as Tournament[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadTournaments();
  }, []);

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
    // Past Matches page shows completed tournaments only.
    if (String(tournament.status || "").toLowerCase() !== "completed") {
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
          padding: 28px;
          box-sizing: border-box;
          background:
            radial-gradient(circle at 85% 0%, rgba(239, 22, 56, 0.08), transparent 28%),
            #070b12;
          color: #fff;
        }
        .topbar {
          display:flex; align-items:flex-start; justify-content:space-between;
          gap:20px; margin-bottom:24px;
        }
        .heading h1 { margin:0; font-size:28px; font-weight:950; color:#f5f7fb; }
        .heading p { margin:7px 0 0; color:#77849a; font-size:12px; }
        .create-button {
          display:inline-flex; align-items:center; justify-content:center;
          min-height:42px; padding:0 17px; border-radius:10px;
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
          min-height:34px; padding:0 9px; border-radius:8px;
          border:1px solid #27374c; background:#101a27; color:#aab6c7;
          text-decoration:none; cursor:pointer; font-size:8px; font-weight:900;
        }
        .action:hover { color:#fff; border-color:#3a4e69; background:#142031; }
        .action.green { color:#43dc96; border-color:rgba(67,220,150,.22); }
        .action.yellow { color:#ffc85a; border-color:rgba(255,200,90,.22); }
        .action.red { color:#ff7185; border-color:rgba(255,113,133,.22); }
        .action:disabled { opacity:.5; cursor:not-allowed; }
        .empty,.loading { padding:65px 20px; text-align:center; color:#718097; font-size:12px; }
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
          font-size:12px;
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
          padding:0 12px;
          font-size:11px;
          font-weight:800;
          cursor:pointer;
        }
        .game-filter:focus { border-color:rgba(239,22,56,.55); }
        @media(max-width:900px) {
          .tournament-admin { padding:20px 14px; }
          .cards { grid-template-columns:1fr; }
        }
        @media(max-width:600px) {
          .filters-bar { flex-direction:column; align-items:stretch; }
          .filter-wrap { width:100%; }
          .game-filter { width:100%; min-width:0; }
        }
        @media(max-width:600px) {
          .topbar { flex-direction:column; }
          .create-button { width:100%; }
          .stats { grid-template-columns:1fr 1fr; }
          .facts { grid-template-columns:1fr 1fr; }
          .card-actions { grid-template-columns:1fr 1fr; }
        }
      `}</style>

      <div className="topbar">
        <div className="heading">
          <h1>🕘 Past Matches</h1>
          <p>Choose a tournament to open its dedicated management page.</p>
        </div>
        <div style={{display:"flex", gap:10, flexWrap:"wrap", justifyContent:"flex-end"}}>
            <Link href="/admin/tournaments" className="create-button" style={{background:"#182333", border:"1px solid #2b3a4e"}}>
              ← ACTIVE TOURNAMENTS
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
          <div className="stat-label">Disabled</div>
          <div className="stat-value">
            {loading ? "—" : tournaments.filter((t) => t.status === "disabled").length}
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
                    <div className="fact-value">👥 {tournament.max_players || 0}</div>
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

              <div className="card-actions">
                <Link href={`/admin/tournaments/${tournament.id}`} className="action">
                  MANAGE
                </Link>
                <Link href={`/admin/tournaments/${tournament.id}`} className="action green">
                  EDIT
                </Link>
                <Link
                  href={`/admin/tournaments/${tournament.id}/participants`}
                  className="action green"
                >
                  👥 PARTICIPANTS
                </Link>
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
    </main>
  );
}
