"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tournament = {
  id: string;
  title: string;
  game: string;
  mode: string;
  entry_fee: number;
  prize_pool: number;
  kill_reward: number;
  max_players: number;
  map: string | null;
  rules: string[] | null;
  start_time: string | null;
  status: string;
};

type Participant = {
  id: string;
  user_id: string;
  game_name: string;
  free_fire_uid: string;
  level: number | null;
  email: string;
};

export default function AdminPage() {
  const router = useRouter();

  const [checkingAdmin, setCheckingAdmin] = useState(true);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedTournament, setSelectedTournament] =
    useState<Tournament | null>(null);

  const [title, setTitle] = useState("");
  const [game, setGame] = useState("Free Fire");
  const [mode, setMode] = useState("Solo");
  const [entryFee, setEntryFee] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [killReward, setKillReward] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("48");
  const [map, setMap] = useState("Bermuda Classic");
  const [rules, setRules] = useState("");
  const [startTime, setStartTime] = useState("");
  const [status, setStatus] = useState("upcoming");

  // ==========================================
  // ADMIN AUTH CHECK
  // ==========================================

  useEffect(() => {
    async function checkAdmin() {
      setCheckingAdmin(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // User not logged in
      if (!user) {
        router.replace("/admin/login");
        return;
      }

      // Check admin role from public.users
      const { data: admin, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || admin?.role !== "admin") {
        await supabase.auth.signOut();
        router.replace("/admin/login");
        return;
      }

      setCheckingAdmin(false);
    }

    checkAdmin();
  }, [router]);

  // ==========================================
  // LOAD TOURNAMENTS
  // ==========================================

  async function loadTournaments() {
    setLoading(true);

    const { data, error } = await supabase
      .from("tournaments")
      .select(
        "id,title,game,mode,entry_fee,prize_pool,kill_reward,max_players,map,rules,start_time,status"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Tournament loading failed: " + error.message);
    } else {
      setTournaments(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!checkingAdmin) {
      loadTournaments();
    }
  }, [checkingAdmin]);

  // ==========================================
  // RESET FORM
  // ==========================================

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setGame("Free Fire");
    setMode("Solo");
    setEntryFee("");
    setPrizePool("");
    setKillReward("");
    setMaxPlayers("48");
    setMap("Bermuda Classic");
    setRules("");
    setStartTime("");
    setStatus("upcoming");
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  // ==========================================
  // EDIT TOURNAMENT
  // ==========================================

  function editTournament(tournament: Tournament) {
    setEditingId(tournament.id);

    setTitle(tournament.title);
    setGame(tournament.game);
    setMode(tournament.mode);
    setEntryFee(String(tournament.entry_fee));
    setPrizePool(String(tournament.prize_pool));
    setKillReward(String(tournament.kill_reward));
    setMaxPlayers(String(tournament.max_players));
    setMap(tournament.map || "");

    setRules(
      Array.isArray(tournament.rules)
        ? tournament.rules.join("\n")
        : ""
    );

    if (tournament.start_time) {
      const date = new Date(tournament.start_time);

      const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 16);

      setStartTime(localDate);
    } else {
      setStartTime("");
    }

    setStatus(tournament.status);

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ==========================================
  // CREATE TOURNAMENT
  // ==========================================

  async function createTournament(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      alert("Tournament title required");
      return;
    }

    if (!entryFee || !prizePool || !maxPlayers) {
      alert("Please fill all required fields");
      return;
    }

    setCreating(true);

    const rulesArray = rules
      .split("\n")
      .map((rule) => rule.trim())
      .filter(Boolean);

    const { error } = await supabase
      .from("tournaments")
      .insert({
        title: title.trim(),
        game,
        mode,
        entry_fee: Number(entryFee),
        prize_pool: Number(prizePool),
        kill_reward: Number(killReward || 0),
        max_players: Number(maxPlayers),
        map: map.trim() || null,
        rules: rulesArray,
        start_time: startTime
          ? new Date(startTime).toISOString()
          : null,
        status,
      });

    if (error) {
      console.error("Create error:", error);
      alert("Create failed: " + error.message);
      setCreating(false);
      return;
    }

    alert("Tournament created successfully ✅");

    resetForm();
    setShowForm(false);

    await loadTournaments();

    setCreating(false);
  }

  // ==========================================
  // UPDATE TOURNAMENT
  // ==========================================

  async function updateTournament(e: React.FormEvent) {
    e.preventDefault();

    if (!editingId) {
      alert("Tournament ID missing");
      return;
    }

    if (!title.trim()) {
      alert("Tournament title required");
      return;
    }

    if (!entryFee || !prizePool || !maxPlayers) {
      alert("Please fill all required fields");
      return;
    }

    setSaving(true);

    const rulesArray = rules
      .split("\n")
      .map((rule) => rule.trim())
      .filter(Boolean);

    const { data, error } = await supabase
      .from("tournaments")
      .update({
        title: title.trim(),
        game,
        mode,
        entry_fee: Number(entryFee),
        prize_pool: Number(prizePool),
        kill_reward: Number(killReward || 0),
        max_players: Number(maxPlayers),
        map: map.trim() || null,
        rules: rulesArray,
        start_time: startTime
          ? new Date(startTime).toISOString()
          : null,
        status,
      })
      .eq("id", editingId)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      alert("Update failed: " + error.message);
      setSaving(false);
      return;
    }

    if (!data) {
      alert(
        "Update did not change anything. Please check your permissions."
      );
      setSaving(false);
      return;
    }

    alert("Tournament updated successfully ✅");

    resetForm();
    setShowForm(false);

    await loadTournaments();

    setSaving(false);
  }

  // ==========================================
  // DELETE TOURNAMENT
  // ==========================================

  async function deleteTournament(
    id: string,
    name: string
  ) {
    const confirmed = window.confirm(
      `Delete "${name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("tournaments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      alert("Delete failed: " + error.message);
      return;
    }

    alert("Tournament deleted successfully 🗑️");

    await loadTournaments();
  }

  // ==========================================
  // CHANGE STATUS
  // ==========================================

  async function changeStatus(
    id: string,
    newStatus: string
  ) {
    const { data, error } = await supabase
      .from("tournaments")
      .update({
        status: newStatus,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Status update error:", error);
      alert("Status update failed: " + error.message);
      return;
    }

    if (!data) {
      alert("Status was not changed.");
      return;
    }

    await loadTournaments();
  }

  // ==========================================
  // PARTICIPANTS
  // ==========================================

  async function showParticipants(
    tournament: Tournament
  ) {
    setSelectedTournament(tournament);
    setParticipantsOpen(true);
    setParticipantsLoading(true);
    setParticipants([]);

    const { data, error } = await supabase
      .from("tournament_entries")
      .select(
        `
        id,
        user_id,
        users (
          email,
          game_name,
          free_fire_uid,
          level
        )
        `
      )
      .eq("tournament_id", tournament.id);

    if (error) {
      console.error("Participants error:", error);
      alert(
        "Participants loading failed: " +
          error.message
      );
      setParticipantsLoading(false);
      return;
    }

    const formatted: Participant[] = (
      data || []
    ).map((item: any) => ({
      id: item.id,
      user_id: item.user_id,
      email: item.users?.email || "-",
      game_name: item.users?.game_name || "-",
      free_fire_uid:
        item.users?.free_fire_uid || "-",
      level: item.users?.level ?? null,
    }));

    setParticipants(formatted);
    setParticipantsLoading(false);
  }

  // ==========================================
  // REMOVE PARTICIPANT
  // ==========================================

  async function removeParticipant(
    participantId: string,
    gameName: string
  ) {
    const confirmed = window.confirm(
      `Remove ${gameName} from this tournament?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("tournament_entries")
      .delete()
      .eq("id", participantId);

    if (error) {
      console.error("Remove participant error:", error);
      alert("Remove failed: " + error.message);
      return;
    }

    if (selectedTournament) {
      await showParticipants(selectedTournament);
    }

    await loadTournaments();
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async function logout() {
    const confirmed = window.confirm(
      "Logout from Admin Panel?"
    );

    if (!confirmed) return;

    await supabase.auth.signOut();

    router.replace("/admin/login");
  }

  // ==========================================
  // AUTH LOADING SCREEN
  // ==========================================

  if (checkingAdmin) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#f5f5f5",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: "30px 40px",
            borderRadius: "12px",
            boxShadow:
              "0 2px 10px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "35px" }}>
            🔐
          </div>

          <h3>Checking Admin Access...</h3>

          <p style={{ color: "#777" }}>
            Please wait
          </p>
        </div>
      </main>
    );
  }

  // ==========================================
  // ADMIN PANEL
  // ==========================================

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        padding: "25px",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "30px",
                fontWeight: "800",
              }}
            >
              GamerzAdda Admin Panel
            </h1>

            <p
              style={{
                color: "#666",
                marginTop: "7px",
              }}
            >
              Manage tournaments, participants and
              matches
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={openCreate}
              style={primaryButton}
            >
              ➕ Create Tournament
            </button>

            <button
              onClick={logout}
              style={logoutButton}
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {/* CREATE / EDIT FORM */}

        {showForm && (
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                {editingId
                  ? "✏️ Edit Tournament"
                  : "➕ Create Tournament"}
              </h2>

              <button
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                style={closeButton}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={
                editingId
                  ? updateTournament
                  : createTournament
              }
              style={{
                display: "grid",
                gap: "15px",
              }}
            >
              <label>
                Tournament Title *
                <input
                  value={title}
                  onChange={(e) =>
                    setTitle(e.target.value)
                  }
                  placeholder="Venom Survival Battle 🔥"
                  style={inputStyle}
                />
              </label>

              <label>
                Game
                <select
                  value={game}
                  onChange={(e) =>
                    setGame(e.target.value)
                  }
                  style={inputStyle}
                >
                  <option>Free Fire</option>
                  <option>Free Fire MAX</option>
                </select>
              </label>

              <label>
                Mode
                <select
                  value={mode}
                  onChange={(e) =>
                    setMode(e.target.value)
                  }
                  style={inputStyle}
                >
                  <option>Solo</option>
                  <option>Duo</option>
                  <option>Squad</option>
                </select>
              </label>

              <label>
                Entry Fee ₹ *
                <input
                  type="number"
                  min="0"
                  value={entryFee}
                  onChange={(e) =>
                    setEntryFee(e.target.value)
                  }
                  placeholder="34"
                  style={inputStyle}
                />
              </label>

              <label>
                Prize Pool ₹ *
                <input
                  type="number"
                  min="0"
                  value={prizePool}
                  onChange={(e) =>
                    setPrizePool(e.target.value)
                  }
                  placeholder="1225"
                  style={inputStyle}
                />
              </label>

              <label>
                Kill Reward ₹
                <input
                  type="number"
                  min="0"
                  value={killReward}
                  onChange={(e) =>
                    setKillReward(e.target.value)
                  }
                  placeholder="5"
                  style={inputStyle}
                />
              </label>

              <label>
                Maximum Players *
                <input
                  type="number"
                  min="1"
                  value={maxPlayers}
                  onChange={(e) =>
                    setMaxPlayers(e.target.value)
                  }
                  placeholder="48"
                  style={inputStyle}
                />
              </label>

              <label>
                Map
                <input
                  value={map}
                  onChange={(e) =>
                    setMap(e.target.value)
                  }
                  placeholder="Bermuda Classic"
                  style={inputStyle}
                />
              </label>

              <label>
                Start Date & Time
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) =>
                    setStartTime(e.target.value)
                  }
                  style={inputStyle}
                />
              </label>

              <label>
                Status
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value)
                  }
                  style={inputStyle}
                >
                  <option value="upcoming">
                    Upcoming
                  </option>

                  <option value="live">
                    Live
                  </option>

                  <option value="completed">
                    Completed
                  </option>

                  <option value="cancelled">
                    Cancelled
                  </option>
                </select>
              </label>

              <label>
                Rules
                <textarea
                  value={rules}
                  onChange={(e) =>
                    setRules(e.target.value)
                  }
                  placeholder={
                    "Vehicle NOT ALLOWED\nAir Drop NOT ALLOWED\nDouble Vector NOT ALLOWED"
                  }
                  rows={6}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                  }}
                />

                <small
                  style={{
                    color: "#777",
                  }}
                >
                  Har rule ko new line me likho.
                </small>
              </label>

              <button
                type="submit"
                disabled={creating || saving}
                style={{
                  ...primaryButton,
                  width: "100%",
                  opacity:
                    creating || saving ? 0.6 : 1,
                }}
              >
                {creating
                  ? "Creating..."
                  : saving
                  ? "Saving Changes..."
                  : editingId
                  ? "💾 Save Changes"
                  : "➕ Create Tournament"}
              </button>
            </form>
          </div>
        )}

        {/* TOURNAMENTS */}

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2 style={{ margin: 0 }}>
              All Tournaments 📋
            </h2>

            <button
              onClick={loadTournaments}
              style={secondaryButton}
            >
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <p>Loading tournaments...</p>
          ) : tournaments.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: "#777",
              }}
            >
              <div style={{ fontSize: "45px" }}>
                🎮
              </div>

              <p>No tournaments found.</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "18px",
              }}
            >
              {tournaments.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  onEdit={() =>
                    editTournament(tournament)
                  }
                  onDelete={() =>
                    deleteTournament(
                      tournament.id,
                      tournament.title
                    )
                  }
                  onParticipants={() =>
                    showParticipants(tournament)
                  }
                  onStatusChange={(newStatus) =>
                    changeStatus(
                      tournament.id,
                      newStatus
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PARTICIPANTS MODAL */}

      {participantsOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  👥 Participants
                </h2>

                <p
                  style={{
                    marginBottom: 0,
                    color: "#666",
                  }}
                >
                  {selectedTournament?.title}
                </p>
              </div>

              <button
                onClick={() => {
                  setParticipantsOpen(false);
                  setSelectedTournament(null);
                  setParticipants([]);
                }}
                style={closeButton}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                marginTop: "20px",
                marginBottom: "15px",
                padding: "15px",
                background: "#f5f5f5",
                borderRadius: "10px",
              }}
            >
              <strong>
                {participants.length}
              </strong>{" "}
              /{" "}
              <strong>
                {selectedTournament?.max_players}
              </strong>{" "}
              Players Joined
            </div>

            {participantsLoading ? (
              <p>Loading participants...</p>
            ) : participants.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "35px",
                  color: "#777",
                }}
              >
                No participants joined yet.
              </div>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "700px",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#f5f5f5",
                      }}
                    >
                      <th style={thStyle}>#</th>

                      <th style={thStyle}>
                        Game Name
                      </th>

                      <th style={thStyle}>UID</th>

                      <th style={thStyle}>
                        Level
                      </th>

                      <th style={thStyle}>
                        Email
                      </th>

                      <th style={thStyle}>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {participants.map(
                      (participant, index) => (
                        <tr
                          key={participant.id}
                        >
                          <td style={tdStyle}>
                            {index + 1}
                          </td>

                          <td style={tdStyle}>
                            <strong>
                              {
                                participant.game_name
                              }
                            </strong>
                          </td>

                          <td style={tdStyle}>
                            {
                              participant.free_fire_uid
                            }
                          </td>

                          <td style={tdStyle}>
                            {participant.level ??
                              "-"}
                          </td>

                          <td style={tdStyle}>
                            {participant.email}
                          </td>

                          <td style={tdStyle}>
                            <button
                              onClick={() =>
                                removeParticipant(
                                  participant.id,
                                  participant.game_name
                                )
                              }
                              style={{
                                ...dangerButton,
                                padding:
                                  "7px 10px",
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/* ==========================================
   TOURNAMENT CARD
========================================== */

function TournamentCard({
  tournament,
  onEdit,
  onDelete,
  onParticipants,
  onStatusChange,
}: {
  tournament: Tournament;
  onEdit: () => void;
  onDelete: () => void;
  onParticipants: () => void;
  onStatusChange: (status: string) => void;
}) {
  const [participantCount, setParticipantCount] =
    useState<number | null>(null);

  useEffect(() => {
    async function getCount() {
      const { count, error } = await supabase
        .from("tournament_entries")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("tournament_id", tournament.id);

      if (error) {
        console.error(
          "Participant count error:",
          error
        );
      }

      setParticipantCount(count ?? 0);
    }

    getCount();
  }, [tournament.id]);

  const joined = participantCount ?? 0;
  const max = tournament.max_players;

  const percentage =
    max > 0
      ? Math.min((joined / max) * 100, 100)
      : 0;

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "12px",
        padding: "20px",
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "15px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            style={{
              marginTop: 0,
              marginBottom: "8px",
              fontSize: "21px",
            }}
          >
            {tournament.title}
          </h3>

          <span
            style={{
              display: "inline-block",
              padding: "5px 10px",
              borderRadius: "20px",
              background:
                tournament.status === "live"
                  ? "#dcfce7"
                  : tournament.status ===
                    "cancelled"
                  ? "#fee2e2"
                  : tournament.status ===
                    "completed"
                  ? "#e5e7eb"
                  : "#fef3c7",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            {tournament.status.toUpperCase()}
          </span>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "#777",
            wordBreak: "break-all",
          }}
        >
          ID: {tournament.id}
        </div>
      </div>

      {/* DETAILS GRID */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(150px,1fr))",
          gap: "10px",
          marginTop: "20px",
        }}
      >
        <Info
          label="Game"
          value={tournament.game}
        />

        <Info
          label="Mode"
          value={tournament.mode}
        />

        <Info
          label="Entry Fee"
          value={`₹${tournament.entry_fee}`}
        />

        <Info
          label="Prize Pool"
          value={`₹${tournament.prize_pool}`}
        />

        <Info
          label="Kill Reward"
          value={`₹${tournament.kill_reward}`}
        />

        <Info
          label="Players"
          value={`${joined} / ${max}`}
        />

        <Info
          label="Map"
          value={tournament.map || "-"}
        />

        <Info
          label="Start"
          value={formatDateLocal(
            tournament.start_time
          )}
        />
      </div>

      {/* PLAYER PROGRESS */}

      <div
        style={{
          marginTop: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "13px",
            marginBottom: "6px",
          }}
        >
          <strong>Participants</strong>

          <span>
            {joined}/{max}
          </span>
        </div>

        <div
          style={{
            height: "8px",
            background: "#e5e7eb",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${percentage}%`,
              height: "100%",
              background: "#e50914",
            }}
          />
        </div>
      </div>

      {/* ACTIONS */}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "20px",
        }}
      >
        <button
          onClick={onEdit}
          style={editButton}
        >
          ✏️ Edit
        </button>

        <button
          onClick={onParticipants}
          style={secondaryButton}
        >
          👥 Participants
        </button>

        <button
          onClick={onDelete}
          style={dangerButton}
        >
          🗑️ Delete
        </button>
      </div>

      {/* STATUS CONTROLS */}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid #eee",
        }}
      >
        <span
          style={{
            fontSize: "13px",
            fontWeight: "bold",
            padding: "9px 0",
            marginRight: "5px",
          }}
        >
          Status:
        </span>

        <button
          onClick={() =>
            onStatusChange("upcoming")
          }
          style={statusButton}
        >
          Upcoming
        </button>

        <button
          onClick={() =>
            onStatusChange("live")
          }
          style={statusButton}
        >
          ▶️ Start / Live
        </button>

        <button
          onClick={() =>
            onStatusChange("completed")
          }
          style={statusButton}
        >
          🏁 Complete
        </button>

        <button
          onClick={() =>
            onStatusChange("cancelled")
          }
          style={statusButton}
        >
          ⛔ Cancel
        </button>
      </div>
    </div>
  );
}

/* ==========================================
   INFO
========================================== */

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "12px",
        background: "#f8f8f8",
        borderRadius: "8px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: "#777",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>

      <strong
        style={{
          fontSize: "14px",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

/* ==========================================
   DATE
========================================== */

function formatDateLocal(
  dateString: string | null
) {
  if (!dateString) return "Not set";

  return new Date(dateString).toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }
  );
}

/* ==========================================
   STYLES
========================================== */

const cardStyle: React.CSSProperties = {
  background: "#fff",
  padding: "25px",
  borderRadius: "12px",
  marginTop: "25px",
  marginBottom: "25px",
  boxShadow:
    "0 2px 10px rgba(0,0,0,0.05)",
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  marginTop: "6px",
  border: "1px solid #ccc",
  borderRadius: "7px",
  fontSize: "15px",
  background: "#fff",
};

const primaryButton: React.CSSProperties = {
  padding: "12px 18px",
  border: "none",
  borderRadius: "8px",
  background: "#e50914",
  color: "#fff",
  fontSize: "15px",
  fontWeight: "bold",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  padding: "9px 13px",
  border: "1px solid #ddd",
  borderRadius: "7px",
  background: "#fff",
  color: "#222",
  fontSize: "13px",
  fontWeight: "bold",
  cursor: "pointer",
};

const editButton: React.CSSProperties = {
  padding: "9px 13px",
  border: "none",
  borderRadius: "7px",
  background: "#f59e0b",
  color: "#fff",
  fontSize: "13px",
  fontWeight: "bold",
  cursor: "pointer",
};

const dangerButton: React.CSSProperties = {
  padding: "9px 13px",
  border: "none",
  borderRadius: "7px",
  background: "#dc2626",
  color: "#fff",
  fontSize: "13px",
  fontWeight: "bold",
  cursor: "pointer",
};

const logoutButton: React.CSSProperties = {
  padding: "12px 18px",
  border: "1px solid #ddd",
  borderRadius: "8px",
  background: "#fff",
  color: "#dc2626",
  fontSize: "14px",
  fontWeight: "bold",
  cursor: "pointer",
};

const statusButton: React.CSSProperties = {
  padding: "8px 11px",
  border: "1px solid #ddd",
  borderRadius: "7px",
  background: "#fff",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer",
};

const closeButton: React.CSSProperties = {
  border: "none",
  background: "#eee",
  width: "35px",
  height: "35px",
  borderRadius: "50%",
  cursor: "pointer",
  fontSize: "16px",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  zIndex: 9999,
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "1000px",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: "14px",
  padding: "25px",
  boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #ddd",
  fontSize: "13px",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #eee",
  fontSize: "13px",
};