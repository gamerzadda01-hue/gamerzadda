"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

const menu = [
  ["▦", "Overview", "/admin"],
  ["♟", "Member Database", "/admin/members"],
  ["₹", "Deposit Bonus", "/admin/deposit-bonus"],
  ["↗", "Withdrawals", "/admin/withdrawals"],
  ["♛", "Tournaments", "/admin#tournaments"],
  ["◌", "Support Chat", "/admin/support"],
  ["▧", "Banners", "/admin/banners"],
  ["♢", "Notifications", "/admin/notifications"],
  ["▥", "Daily Analytics", "/admin/analytics"],
] as const;

export default function AdminPage() {
  const router = useRouter();
  const pathname = usePathname();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [minDeposit, setMinDeposit] = useState("10");
  const [bonusPercent, setBonusPercent] = useState("10");
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [stats, setStats] = useState({
    users: 0,
    deposits: 0,
    pendingWithdrawals: 0,
    tournaments: 0,
    supportTickets: 0,
    tournamentEntries: 0,
  });

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

  /* =========================
     ADMIN AUTH
  ========================= */

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

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

  /* =========================
     DASHBOARD STATS
  ========================= */

  async function loadDashboardStats() {
    setDashboardLoading(true);

    const [
      users,
      deposits,
      withdrawals,
      tournaments,
      tickets,
      entries,
    ] = await Promise.all([
      supabase
        .from("users")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("deposit_orders")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("withdraw_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      supabase
        .from("tournaments")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true }),

      supabase
        .from("tournament_entries")
        .select("id", { count: "exact", head: true }),
    ]);

    setStats({
      users: users.count || 0,
      deposits: deposits.count || 0,
      pendingWithdrawals: withdrawals.count || 0,
      tournaments: tournaments.count || 0,
      supportTickets: tickets.count || 0,
      tournamentEntries: entries.count || 0,
    });

    setDashboardLoading(false);
  }

  /* =========================
     WALLET SETTINGS
  ========================= */

  async function loadWalletSettings() {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "min_deposit_amount",
        "deposit_bonus_percent",
      ]);

    if (error) {
      console.error("Wallet settings error:", error);
      return;
    }

    for (const item of data || []) {
      if (item.key === "min_deposit_amount") {
        setMinDeposit(String(item.value));
      }

      if (item.key === "deposit_bonus_percent") {
        setBonusPercent(String(item.value));
      }
    }
  }

  async function saveWalletSettings() {
    const min = Number(minDeposit);
    const bonus = Number(bonusPercent);

    if (!Number.isFinite(min) || min <= 0) {
      alert("Minimum deposit must be greater than 0.");
      return;
    }

    if (!Number.isFinite(bonus) || bonus < 0 || bonus > 100) {
      alert("Bonus must be between 0% and 100%.");
      return;
    }

    setSettingsSaving(true);

    const { error } = await supabase
      .from("app_settings")
      .upsert(
        [
          {
            key: "min_deposit_amount",
            value: min,
            updated_at: new Date().toISOString(),
          },
          {
            key: "deposit_bonus_percent",
            value: bonus,
            updated_at: new Date().toISOString(),
          },
        ],
        {
          onConflict: "key",
        }
      );

    setSettingsSaving(false);

    if (error) {
      alert("Settings save failed: " + error.message);
      return;
    }

    alert("Wallet settings updated successfully ✅");
  }

  /* =========================
     TOURNAMENTS
  ========================= */

  async function loadTournaments() {
    setLoading(true);

    const { data, error } = await supabase
      .from("tournaments")
      .select(
        "id,title,game,mode,entry_fee,prize_pool,kill_reward,max_players,map,rules,start_time,status"
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      alert(
        "Tournament loading failed: " +
          error.message
      );
    } else {
      setTournaments(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!checkingAdmin) {
      loadTournaments();
      loadWalletSettings();
      loadDashboardStats();
    }
  }, [checkingAdmin]);

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

    setTimeout(() => {
      document
        .getElementById("tournament-editor")
        ?.scrollIntoView({
          behavior: "smooth",
        });
    }, 50);
  }

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

    setStatus(tournament.status);

    if (tournament.start_time) {
      const date = new Date(
        tournament.start_time
      );

      const localDate = new Date(
        date.getTime() -
          date.getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 16);

      setStartTime(localDate);
    } else {
      setStartTime("");
    }

    setShowForm(true);

    setTimeout(() => {
      document
        .getElementById("tournament-editor")
        ?.scrollIntoView({
          behavior: "smooth",
        });
    }, 50);
  }

  function formValues() {
    return {
      title: title.trim(),
      game,
      mode,
      entry_fee: Number(entryFee),
      prize_pool: Number(prizePool),
      kill_reward: Number(killReward || 0),
      max_players: Number(maxPlayers),
      map: map.trim() || null,
      rules: rules
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
      start_time: startTime
        ? new Date(startTime).toISOString()
        : null,
      status,
    };
  }

  async function createTournament(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!title.trim()) {
      alert("Tournament title required");
      return;
    }

    if (!entryFee || !prizePool || !maxPlayers) {
      alert(
        "Please fill all required fields"
      );
      return;
    }

    setCreating(true);

    const { error } = await supabase
      .from("tournaments")
      .insert(formValues());

    setCreating(false);

    if (error) {
      alert(
        "Create failed: " +
          error.message
      );
      return;
    }

    alert(
      "Tournament created successfully ✅"
    );

    resetForm();
    setShowForm(false);

    await loadTournaments();
  }

  async function updateTournament(
    e: React.FormEvent
  ) {
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
      alert(
        "Please fill all required fields"
      );
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("tournaments")
      .update(formValues())
      .eq("id", editingId)
      .select()
      .single();

    setSaving(false);

    if (error) {
      alert(
        "Update failed: " +
          error.message
      );
      return;
    }

    if (!data) {
      alert(
        "Update did not change anything. Check permissions."
      );
      return;
    }

    alert(
      "Tournament updated successfully ✅"
    );

    resetForm();
    setShowForm(false);

    await loadTournaments();
  }

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
      alert(
        "Delete failed: " +
          error.message
      );
      return;
    }

    await loadTournaments();
  }

  async function changeStatus(
    id: string,
    newStatus: string
  ) {
    const { error } = await supabase
      .from("tournaments")
      .update({
        status: newStatus,
      })
      .eq("id", id);

    if (error) {
      alert(
        "Status update failed: " +
          error.message
      );
      return;
    }

    await loadTournaments();
  }

  /* =========================
     PARTICIPANTS
  ========================= */

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
      .eq(
        "tournament_id",
        tournament.id
      );

    if (error) {
      setParticipantsLoading(false);

      alert(
        "Participants loading failed: " +
          error.message
      );

      return;
    }

    const formatted: Participant[] = (
      data || []
    ).map((item: any) => ({
      id: item.id,
      user_id: item.user_id,
      email:
        item.users?.email || "-",
      game_name:
        item.users?.game_name || "-",
      free_fire_uid:
        item.users?.free_fire_uid || "-",
      level:
        item.users?.level ?? null,
    }));

    setParticipants(formatted);
    setParticipantsLoading(false);
  }

  async function removeParticipant(
    id: string,
    gameName: string
  ) {
    const confirmed = window.confirm(
      `Remove ${gameName} from this tournament?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("tournament_entries")
      .delete()
      .eq("id", id);

    if (error) {
      alert(
        "Remove failed: " +
          error.message
      );
      return;
    }

    if (selectedTournament) {
      await showParticipants(
        selectedTournament
      );
    }

    await loadTournaments();
  }

  /* =========================
     NAVIGATION
  ========================= */

  function navigate(href: string) {
    setSidebarOpen(false);

    if (
      href ===
      "/admin#tournaments"
    ) {
      if (pathname === "/admin") {
        document
          .getElementById("tournaments")
          ?.scrollIntoView({
            behavior: "smooth",
          });
      } else {
        router.push(href);
      }

      return;
    }

    router.push(href);
  }

  /* =========================
     LOGOUT
  ========================= */

  async function logout() {
    const confirmed = window.confirm(
      "Logout from Admin Panel?"
    );

    if (!confirmed) return;

    await supabase.auth.signOut();

    router.replace(
      "/admin/login"
    );
  }

  /* =========================
     LOADING
  ========================= */

  if (checkingAdmin) {
    return (
      <main style={loadingPage}>
        <div style={loadingBox}>
          <div
            style={{
              fontSize: 32,
            }}
          >
            🔐
          </div>

          <b>
            Checking access
          </b>

          <small>
            Admin authentication…
          </small>
        </div>
      </main>
    );
  }

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #070b12;
        }

        button,
        input,
        select,
        textarea {
          font: inherit;
        }

        :root {
          --blue: 54, 143, 255;
          --green: 54, 226, 139;
          --red: 242, 28, 62;
          --purple: 164, 91, 255;
          --orange: 255, 157, 61;
          --cyan: 54, 211, 255;
        }

        @media (max-width: 1100px) {
          .admin-stats {
            grid-template-columns:
              repeat(3, minmax(0, 1fr))
              !important;
          }

          .admin-form {
            grid-template-columns:
              repeat(2, minmax(0, 1fr))
              !important;
          }
        }

        @media (max-width: 760px) {
          .admin-sidebar {
            position: fixed !important;
            left: 0;
            top: 0;
            transform: translateX(-105%);
            transition: transform 0.22s ease;
            box-shadow:
              12px 0 35px
              rgba(0, 0, 0, 0.35);
          }

          .admin-sidebar-open {
            transform: translateX(0)
              !important;
          }

          .admin-backdrop {
            display: block !important;
          }

          .admin-menu-button {
            display: grid !important;
            place-items: center;
          }

          .admin-topbar {
            padding: 0 12px !important;
          }

          .admin-inner {
            padding: 16px 12px !important;
          }

          .admin-page-header {
            align-items:
              flex-start !important;
          }

          .admin-page-header h1 {
            font-size: 24px !important;
          }

          .admin-stats {
            grid-template-columns:
              repeat(2, minmax(0, 1fr))
              !important;
          }

          .admin-form {
            grid-template-columns:
              1fr !important;
          }

          .admin-quick {
            display: block !important;
          }

          .admin-quick-links {
            margin-top: 10px;
          }

          .admin-tcard {
            flex-direction:
              column !important;
            align-items:
              flex-start !important;
          }

          .admin-tactions {
            justify-content:
              flex-start !important;
          }

          .admin-search span {
            display: none;
          }

          .admin-search {
            flex:
              0 1 45px !important;
            justify-content: center;
          }

          .admin-topright
            .admin-online {
            display: none;
          }
        }
      `}</style>

      <main style={page}>
        {/* SIDEBAR */}

        <aside
          className={
            sidebarOpen
              ? "admin-sidebar admin-sidebar-open"
              : "admin-sidebar"
          }
          style={sidebar}
        >
          {/* BRAND */}

          <div style={brand}>
            <div style={brandMark}>
              🎮
            </div>

            <div>
              <b>
                GAMERZ
                <span
                  style={{
                    color: "#f21c3e",
                  }}
                >
                  ADDA
                </span>
              </b>

              <small>
                ADMIN CONTROL
              </small>
            </div>
          </div>

          <div
            style={sectionLabel}
          >
            MAIN
          </div>

          {/* MENU */}

          <nav>
            {menu.map(
              ([
                icon,
                label,
                href,
              ]) => {
                const active =
                  href === "/admin"
                    ? pathname ===
                      "/admin"
                    : pathname ===
                      href.split(
                        "#"
                      )[0];

                return (
                  <button
                    key={label}
                    onClick={() =>
                      navigate(
                        href
                      )
                    }
                    style={{
                      ...navItem,
                      ...(active
                        ? navActive
                        : {}),
                    }}
                  >
                    <span
                      style={
                        navIcon
                      }
                    >
                      {icon}
                    </span>

                    <span>
                      {label}
                    </span>

                    {label ===
                      "Withdrawals" &&
                    stats.pendingWithdrawals >
                      0 ? (
                      <em
                        style={{
                          marginLeft:
                            "auto",
                          background:
                            "#f21c3e",
                          color:
                            "#fff",
                          borderRadius:
                            99,
                          padding:
                            "2px 6px",
                          fontSize:
                            9,
                          fontStyle:
                            "normal",
                        }}
                      >
                        {
                          stats.pendingWithdrawals
                        }
                      </em>
                    ) : null}
                  </button>
                );
              }
            )}
          </nav>

          {/* SYSTEM */}

          <div
            style={{
              marginTop:
                "auto",
            }}
          >
            <div
              style={
                sectionLabel
              }
            >
              SYSTEM
            </div>

            <button
              onClick={() =>
                loadDashboardStats()
              }
              style={navItem}
            >
              <span
                style={navIcon}
              >
                ↻
              </span>

              <span>
                Refresh Data
              </span>
            </button>

            <button
              onClick={logout}
              style={navItem}
            >
              <span
                style={navIcon}
              >
                ⇥
              </span>

              <span>
                Logout
              </span>
            </button>

            <div
              style={
                adminBadge
              }
            >
              <span
                style={{
                  color:
                    "#36e28b",
                }}
              >
                ●
              </span>

              <div>
                <b>
                  Admin
                </b>

                <small>
                  Super Admin
                </small>
              </div>
            </div>
          </div>
        </aside>

        {/* MOBILE BACKDROP */}

        {sidebarOpen && (
          <button
            aria-label="Close sidebar"
            onClick={() =>
              setSidebarOpen(
                false
              )
            }
            className="admin-backdrop"
            style={backdrop}
          />
        )}

        {/* MAIN CONTENT */}

        <section
          style={content}
        >
          {/* TOPBAR */}

          <header
            className="admin-topbar"
            style={topbar}
          >
            <button
              onClick={() =>
                setSidebarOpen(
                  (v) => !v
                )
              }
              className="admin-menu-button"
              style={menuButton}
            >
              ☰
            </button>

            <div
              className="admin-search"
              style={searchBox}
            >
              ⌕

              <span>
                Search users,
                tournaments,
                transactions…
              </span>
            </div>

            <div
              className="admin-topright"
              style={topRight}
            >
              <span
                className="admin-online"
                style={online}
              >
                <i
                  style={{
                    display:
                      "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius:
                      "50%",
                    background:
                      "#36e28b",
                    marginRight: 6,
                  }}
                />

                System Online
              </span>

              <button
                style={
                  iconButton
                }
              >
                ◔
              </button>
            </div>
          </header>

          <div
            className="admin-inner"
            style={inner}
          >
            {/* PAGE HEADER */}

            <div
              className="admin-page-header"
              style={pageHeader}
            >
              <div>
                <div
                  style={
                    eyebrow
                  }
                >
                  CONTROL CENTER /
                  OVERVIEW
                </div>

                <h1
                  style={{
                    margin:
                      "0 0 4px",
                    fontSize: 28,
                  }}
                >
                  Dashboard
                </h1>

                <p
                  style={{
                    margin: 0,
                    color:
                      "#657187",
                    fontSize: 11,
                  }}
                >
                  Platform performance
                  and operational
                  controls
                </p>
              </div>

              <button
                onClick={
                  openCreate
                }
                style={
                  primaryButton
                }
              >
                ＋ New Tournament
              </button>
            </div>

            {/* STATS */}

            <section
              className="admin-stats"
              style={
                statsGrid
              }
            >
              <Stat
                icon="♟"
                label="Members"
                value={
                  dashboardLoading
                    ? "…"
                    : stats.users
                }
                tone="blue"
              />

              <Stat
                icon="₹"
                label="Deposits"
                value={
                  dashboardLoading
                    ? "…"
                    : stats.deposits
                }
                tone="green"
              />

              <Stat
                icon="↗"
                label="Pending Payouts"
                value={
                  dashboardLoading
                    ? "…"
                    : stats.pendingWithdrawals
                }
                tone="red"
              />

              <Stat
                icon="♛"
                label="Tournaments"
                value={
                  dashboardLoading
                    ? "…"
                    : stats.tournaments
                }
                tone="purple"
              />

              <Stat
                icon="◌"
                label="Support"
                value={
                  dashboardLoading
                    ? "…"
                    : stats.supportTickets
                }
                tone="orange"
              />

              <Stat
                icon="◈"
                label="Entries"
                value={
                  dashboardLoading
                    ? "…"
                    : stats.tournamentEntries
                }
                tone="cyan"
              />
            </section>

            {/* QUICK MODULES */}

            <section
              className="admin-quick"
              style={
                quickBar
              }
            >
              <div>
                <b>
                  Quick modules
                </b>

                <small>
                  Open management
                  area
                </small>
              </div>

              <div
                className="admin-quick-links"
                style={
                  quickLinks
                }
              >
                {menu
                  .slice(1)
                  .map(
                    ([
                      icon,
                      label,
                      href,
                    ]) => (
                      <button
                        key={
                          label
                        }
                        onClick={() =>
                          navigate(
                            href
                          )
                        }
                        style={
                          quickBtn
                        }
                      >
                        <span>
                          {icon}
                        </span>{" "}
                        {label}
                      </button>
                    )
                  )}
              </div>
            </section>

            {/* DEPOSIT BONUS */}

            <section
              id="wallet-settings"
              style={card}
            >
              <div
                style={
                  cardHead
                }
              >
                <div>
                  <div
                    style={
                      eyebrow
                    }
                  >
                    FINANCE /
                    CONFIG
                  </div>

                  <h2
                    style={{
                      margin:
                        "0 0 4px",
                      fontSize: 17,
                    }}
                  >
                    Deposit Bonus
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color:
                        "#657187",
                      fontSize: 10,
                    }}
                  >
                    Minimum deposit
                    and promotional
                    credit controls.
                  </p>
                </div>

                <span
                  style={
                    statusPill
                  }
                >
                  ● LIVE
                </span>
              </div>

              <div
                className="admin-form"
                style={
                  formGrid
                }
              >
                <label
                  style={field}
                >
                  <span>
                    Minimum Deposit ₹
                  </span>

                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={
                      minDeposit
                    }
                    onChange={(e) =>
                      setMinDeposit(
                        e.target
                          .value
                      )
                    }
                    style={input}
                  />
                </label>

                <label
                  style={field}
                >
                  <span>
                    Bonus Percent %
                  </span>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      bonusPercent
                    }
                    onChange={(e) =>
                      setBonusPercent(
                        e.target
                          .value
                      )
                    }
                    style={input}
                  />
                </label>

                <div
                  style={
                    previewBox
                  }
                >
                  <small>
                    Example credit
                  </small>

                  <b>
                    ₹
                    {(
                      100 +
                      (100 *
                        Number(
                          bonusPercent ||
                            0
                        )) /
                        100
                    ).toFixed(2)}
                  </b>

                  <span>
                    on ₹100
                    deposit
                  </span>
                </div>
              </div>

              <button
                onClick={
                  saveWalletSettings
                }
                disabled={
                  settingsSaving
                }
                style={
                  primaryButton
                }
              >
                {settingsSaving
                  ? "Saving…"
                  : "Save Settings"}
              </button>
            </section>

            {/* TOURNAMENT EDITOR */}

            {showForm && (
              <section
                id="tournament-editor"
                style={card}
              >
                <div
                  style={
                    cardHead
                  }
                >
                  <div>
                    <div
                      style={
                        eyebrow
                      }
                    >
                      TOURNAMENT ENGINE
                      / EDITOR
                    </div>

                    <h2
                      style={{
                        margin: 0,
                        fontSize: 17,
                      }}
                    >
                      {editingId
                        ? "Edit Tournament"
                        : "Create Tournament"}
                    </h2>
                  </div>

                  <button
                    onClick={() => {
                      resetForm();
                      setShowForm(
                        false
                      );
                    }}
                    style={
                      closeBtn
                    }
                  >
                    ×
                  </button>
                </div>

                <form
                  onSubmit={
                    editingId
                      ? updateTournament
                      : createTournament
                  }
                  className="admin-form"
                  style={
                    formGrid
                  }
                >
                  <label
                    style={field}
                  >
                    <span>
                      Title *
                    </span>

                    <input
                      value={title}
                      onChange={(e) =>
                        setTitle(
                          e.target
                            .value
                        )
                      }
                      placeholder="Venom Survival Battle"
                      style={input}
                    />
                  </label>

                  <label
                    style={field}
                  >
                    <span>
                      Game
                    </span>

                    <select
                      value={game}
                      onChange={(e) =>
                        setGame(
                          e.target
                            .value
                        )
                      }
                      style={input}
                    >
                      <option>
                        Free Fire
                      </option>

                      <option>
                        Free Fire MAX
                      </option>
                    </select>
                  </label>

                  <label
                    style={field}
                  >
                    <span>
                      Mode
                    </span>

                    <select
                      value={mode}
                      onChange={(e) =>
                        setMode(
                          e.target
                            .value
                        )
                      }
                      style={input}
                    >
                      <option>
                        Solo
                      </option>

                      <option>
                        Duo
                      </option>

                      <option>
                        Squad
                      </option>
                    </select>
                  </label>

                  <label
                    style={field}
                  >
                    <span>
                      Entry Fee ₹ *
                    </span>

                    <input
                      type="number"
                      min="0"
                      value={
                        entryFee
                      }
                      onChange={(e) =>
                        setEntryFee(
                          e.target
                            .value
                        )
                      }
                      style={input}
                    />
                  </label>

                  <label
                    style={field}
                  >
                    <span>
                      Prize Pool ₹ *
                    </span>

                    <input
                      type="number"
                      min="0"
                      value={
                        prizePool
                      }
                      onChange={(e) =>
                        setPrizePool(
                          e.target
                            .value
                        )
                      }
                      style={input}
                    />
                  </label>

                  <label
                    style={field}
                  >
                    <span>
                      Kill Reward ₹
                    </span>

                    <input
                      type="number"
                      min="0"
                      value={
                        killReward
                      }
                      onChange={(e) =>
                        setKillReward(
                          e.target
                            .value
                        )
                      }
                      style={input}
                    />
                  </label>

                  <label
                    style={field}
                  >
                    <span>
                      Maximum Players *
                    </span>

                    <input
                      type="number"
                      min="1"
                      value={
                        maxPlayers
                      }
                      onChange={(e) =>
                        setMaxPlayers(
                          e.target
                            .value
                        )
                      }
                      style={input}
                    />
                  </label>

                  <label
                    style={field}
                  >
                    <span>
                      Map
                    </span>

                    <input
                      value={map}
                      onChange={(e) =>
                        setMap(
                          e.target
                            .value
                        )
                      }
                      style={input}
                    />
                  </label>

                  <label
                    style={field}
                  >
                    <span>
                      Start Date &
                      Time
                    </span>

                    <input
                      type="datetime-local"
                      value={
                        startTime
                      }
                      onChange={(e) =>
                        setStartTime(
                          e.target
                            .value
                        )
                      }
                      style={input}
                    />
                  </label>

                  <label
                    style={field}
                  >
                    <span>
                      Status
                    </span>

                    <select
                      value={
                        status
                      }
                      onChange={(e) =>
                        setStatus(
                          e.target
                            .value
                        )
                      }
                      style={input}
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

                  <label
                    style={{
                      ...field,
                      gridColumn:
                        "1 / -1",
                    }}
                  >
                    <span>
                      Rules{" "}
                      <small>
                        one per line
                      </small>
                    </span>

                    <textarea
                      rows={5}
                      value={
                        rules
                      }
                      onChange={(e) =>
                        setRules(
                          e.target
                            .value
                        )
                      }
                      style={{
                        ...input,
                        resize:
                          "vertical",
                      }}
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={
                      creating ||
                      saving
                    }
                    style={{
                      ...primaryButton,
                      gridColumn:
                        "1 / -1",
                      opacity:
                        creating ||
                        saving
                          ? 0.6
                          : 1,
                    }}
                  >
                    {creating
                      ? "Creating…"
                      : saving
                      ? "Saving…"
                      : editingId
                      ? "Save Changes"
                      : "Create Tournament"}
                  </button>
                </form>
              </section>
            )}

            {/* TOURNAMENT LIST */}

            <section
              id="tournaments"
              style={card}
            >
              <div
                style={
                  cardHead
                }
              >
                <div>
                  <div
                    style={
                      eyebrow
                    }
                  >
                    TOURNAMENT ENGINE
                  </div>

                  <h2
                    style={{
                      margin:
                        "0 0 4px",
                      fontSize: 17,
                    }}
                  >
                    All Tournaments
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color:
                        "#657187",
                      fontSize: 10,
                    }}
                  >
                    Manage rooms,
                    entries,
                    rewards and
                    status.
                  </p>
                </div>

                <button
                  onClick={
                    loadTournaments
                  }
                  style={
                    secondaryButton
                  }
                >
                  ↻ Refresh
                </button>
              </div>

              {loading ? (
                <div
                  style={empty}
                >
                  Loading
                  tournaments…
                </div>
              ) : tournaments.length ===
                0 ? (
                <div
                  style={empty}
                >
                  No tournaments
                  found.
                </div>
              ) : (
                <div
                  style={{
                    display:
                      "grid",
                    gap: 10,
                  }}
                >
                  {tournaments.map(
                    (t) => (
                      <TournamentCard
                        key={t.id}
                        tournament={
                          t
                        }
                        onEdit={() =>
                          editTournament(
                            t
                          )
                        }
                        onDelete={() =>
                          deleteTournament(
                            t.id,
                            t.title
                          )
                        }
                        onParticipants={() =>
                          showParticipants(
                            t
                          )
                        }
                        onStatusChange={(
                          s
                        ) =>
                          changeStatus(
                            t.id,
                            s
                          )
                        }
                      />
                    )
                  )}
                </div>
              )}
            </section>
          </div>
        </section>

        {/* PARTICIPANTS MODAL */}

        {participantsOpen && (
          <div
            style={overlay}
          >
            <div
              style={modal}
            >
              <div
                style={
                  cardHead
                }
              >
                <div>
                  <div
                    style={
                      eyebrow
                    }
                  >
                    TOURNAMENT /
                    PLAYERS
                  </div>

                  <h2
                    style={{
                      margin:
                        "0 0 3px",
                      fontSize: 17,
                    }}
                  >
                    Participants
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color:
                        "#657187",
                      fontSize: 10,
                    }}
                  >
                    {
                      selectedTournament?.title
                    }
                  </p>
                </div>

                <button
                  onClick={() => {
                    setParticipantsOpen(
                      false
                    );
                    setSelectedTournament(
                      null
                    );
                    setParticipants(
                      []
                    );
                  }}
                  style={
                    closeBtn
                  }
                >
                  ×
                </button>
              </div>

              <div
                style={
                  joinCount
                }
              >
                <b>
                  {
                    participants.length
                  }
                </b>

                <span>
                  {" "}
                  /{" "}
                  {
                    selectedTournament?.max_players
                  }{" "}
                  players joined
                </span>
              </div>

              {participantsLoading ? (
                <div
                  style={empty}
                >
                  Loading…
                </div>
              ) : participants.length ===
                0 ? (
                <div
                  style={empty}
                >
                  No participants
                  joined yet.
                </div>
              ) : (
                <div
                  style={{
                    overflowX:
                      "auto",
                  }}
                >
                  <table
                    style={table}
                  >
                    <thead>
                      <tr>
                        <th
                          style={th}
                        >
                          #
                        </th>

                        <th
                          style={th}
                        >
                          Game Name
                        </th>

                        <th
                          style={th}
                        >
                          UID
                        </th>

                        <th
                          style={th}
                        >
                          Level
                        </th>

                        <th
                          style={th}
                        >
                          Email
                        </th>

                        <th
                          style={th}
                        >
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {participants.map(
                        (
                          p,
                          i
                        ) => (
                          <tr
                            key={
                              p.id
                            }
                          >
                            <td
                              style={
                                td
                              }
                            >
                              {i +
                                1}
                            </td>

                            <td
                              style={
                                td
                              }
                            >
                              <b>
                                {
                                  p.game_name
                                }
                              </b>
                            </td>

                            <td
                              style={
                                td
                              }
                            >
                              {
                                p.free_fire_uid
                              }
                            </td>

                            <td
                              style={
                                td
                              }
                            >
                              {p.level ??
                                "-"}
                            </td>

                            <td
                              style={
                                td
                              }
                            >
                              {
                                p.email
                              }
                            </td>

                            <td
                              style={
                                td
                              }
                            >
                              <button
                                onClick={() =>
                                  removeParticipant(
                                    p.id,
                                    p.game_name
                                  )
                                }
                                style={
                                  dangerButton
                                }
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
    </>
  );
}

/* =========================
   STAT CARD
========================= */

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div
      style={
        statCard
      }
    >
      <div
        style={{
          ...statIcon,
          background: `rgba(var(--${tone}),.12)`,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          minWidth: 0,
        }}
      >
        <small
          style={{
            display:
              "block",
            color:
              "#68768b",
            fontSize: 9,
            marginBottom: 3,
          }}
        >
          {label}
        </small>

        <strong
          style={{
            display:
              "block",
            fontSize: 17,
            color:
              "#edf2fa",
          }}
        >
          {value}
        </strong>
      </div>
    </div>
  );
}

/* =========================
   TOURNAMENT CARD
========================= */

function TournamentCard({
  tournament: t,
  onEdit,
  onDelete,
  onParticipants,
  onStatusChange,
}: {
  tournament: Tournament;
  onEdit: () => void;
  onDelete: () => void;
  onParticipants: () => void;
  onStatusChange: (
    status: string
  ) => void;
}) {
  return (
    <article
      className="admin-tcard"
      style={tCard}
    >
      <div
        style={{
          minWidth: 0,
        }}
      >
        <div
          style={tMeta}
        >
          <span>
            {t.game}
          </span>

          <span>
            {t.mode}
          </span>

          <span
            style={pill(
              t.status
            )}
          >
            {t.status}
          </span>
        </div>

        <h3
          style={{
            margin:
              "5px 0",
            fontSize: 14,
            color:
              "#e9eef7",
          }}
        >
          {t.title}
        </h3>

        <div
          style={tStats}
        >
          <span>
            Entry{" "}
            <b>
              ₹
              {
                t.entry_fee
              }
            </b>
          </span>

          <span>
            Prize{" "}
            <b>
              ₹
              {
                t.prize_pool
              }
            </b>
          </span>

          <span>
            Players{" "}
            <b>
              {
                t.max_players
              }
            </b>
          </span>

          <span>
            Kills{" "}
            <b>
              ₹
              {
                t.kill_reward
              }
            </b>
          </span>
        </div>

        {t.start_time && (
          <small
            style={{
              color:
                "#8992a5",
              fontSize: 9,
            }}
          >
            Starts{" "}
            {new Date(
              t.start_time
            ).toLocaleString()}
          </small>
        )}
      </div>

      <div
        className="admin-tactions"
        style={
          tActions
        }
      >
        <button
          onClick={
            onParticipants
          }
          style={
            secondaryButton
          }
        >
          Players
        </button>

        <button
          onClick={
            onEdit
          }
          style={
            secondaryButton
          }
        >
          Edit
        </button>

        <select
          value={
            t.status
          }
          onChange={(e) =>
            onStatusChange(
              e.target.value
            )
          }
          style={
            smallSelect
          }
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

        <button
          onClick={
            onDelete
          }
          style={
            dangerButton
          }
        >
          Delete
        </button>
      </div>
    </article>
  );
}

/* =========================
   STYLES
========================= */

const loadingPage: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#070b12",
  color: "#e8edf7",
};

const loadingBox: React.CSSProperties = {
  display: "grid",
  gap: 8,
  textAlign: "center",
  padding: 30,
  background: "#0e1521",
  border: "1px solid #202b3b",
  borderRadius: 16,
};

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#070b12",
  color: "#e8edf7",
  fontFamily:
    "Inter, Arial, sans-serif",
  display: "flex",
};

const sidebar: React.CSSProperties = {
  width: 238,
  flexShrink: 0,
  minHeight: "100vh",
  background: "#0a1019",
  borderRight:
    "1px solid #1b2635",
  padding: "18px 12px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  position: "sticky",
  top: 0,
  height: "100vh",
  zIndex: 20,
};

const brand: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding:
    "5px 8px 20px",
  borderBottom:
    "1px solid #1b2635",
  marginBottom: 16,
};

const brandMark: React.CSSProperties = {
  width: 34,
  height: 34,
  display: "grid",
  placeItems: "center",
  borderRadius: 9,
  background: "#e81736",
  fontSize: 18,
};

const sectionLabel: React.CSSProperties = {
  color: "#596579",
  fontSize: 9,
  letterSpacing: 1.5,
  fontWeight: 800,
  padding:
    "8px 10px",
};

const navItem: React.CSSProperties = {
  width: "100%",
  border:
    "1px solid transparent",
  background:
    "transparent",
  color: "#9ca8bb",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding:
    "9px 10px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
  textAlign: "left",
  marginBottom: 3,
};

const navActive: React.CSSProperties = {
  background:
    "linear-gradient(90deg,#e81736,#a90e29)",
  color: "#fff",
  boxShadow:
    "0 7px 20px rgba(232,23,54,.18)",
};

const navIcon: React.CSSProperties = {
  width: 22,
  textAlign: "center",
  fontSize: 15,
};

const backdrop: React.CSSProperties = {
  display: "none",
  position: "fixed",
  inset: 0,
  zIndex: 15,
  border: 0,
  background:
    "rgba(0,0,0,.55)",
};

const adminBadge: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  margin:
    "14px 3px 2px",
  padding: 10,
  background: "#0f1723",
  border:
    "1px solid #1e2a3a",
  borderRadius: 9,
  fontSize: 11,
};

const content: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const topbar: React.CSSProperties = {
  height: 58,
  borderBottom:
    "1px solid #1b2635",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding:
    "0 22px",
  background:
    "rgba(7,11,18,.92)",
  position: "sticky",
  top: 0,
  zIndex: 10,
  boxSizing:
    "border-box",
};

const menuButton: React.CSSProperties = {
  display: "none",
  border:
    "1px solid #263346",
  background: "#101925",
  color: "#fff",
  borderRadius: 8,
  width: 36,
  height: 36,
  cursor: "pointer",
};

const searchBox: React.CSSProperties = {
  flex: 1,
  maxWidth: 520,
  height: 34,
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding:
    "0 11px",
  border:
    "1px solid #202d3e",
  background: "#0d1520",
  borderRadius: 8,
  color: "#738096",
  fontSize: 12,
};

const topRight: React.CSSProperties = {
  marginLeft: "auto",
  display: "flex",
  alignItems: "center",
  gap: 15,
};

const online: React.CSSProperties = {
  fontSize: 11,
  color: "#9aa6b9",
};

const iconButton: React.CSSProperties = {
  border:
    "1px solid #243044",
  background: "#101925",
  color: "#cbd3df",
  width: 34,
  height: 34,
  borderRadius: 8,
  cursor: "pointer",
};

const inner: React.CSSProperties = {
  maxWidth: 1450,
  margin: "0 auto",
  padding: 24,
  boxSizing:
    "border-box",
};

const pageHeader: React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: 15,
  marginBottom: 20,
};

const eyebrow: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: 1.4,
  color: "#657187",
  fontWeight: 800,
  marginBottom: 5,
};

const primaryButton: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  background:
    "linear-gradient(135deg,#f21c3e,#c90f2e)",
  color: "#fff",
  padding:
    "10px 14px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow:
    "0 7px 20px rgba(232,23,54,.16)",
};

const secondaryButton: React.CSSProperties = {
  border:
    "1px solid #263346",
  borderRadius: 7,
  background: "#101925",
  color: "#bfc8d6",
  padding:
    "8px 11px",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(6,minmax(0,1fr))",
  gap: 10,
  marginBottom: 12,
};

const statCard: React.CSSProperties = {
  background: "#0d1520",
  border:
    "1px solid #1d2a3b",
  borderRadius: 11,
  padding: 13,
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const statIcon: React.CSSProperties = {
  width: 31,
  height: 31,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  fontSize: 14,
  flexShrink: 0,
};

const quickBar: React.CSSProperties = {
  background: "#0d1520",
  border:
    "1px solid #1d2a3b",
  borderRadius: 11,
  padding: 12,
  marginBottom: 12,
  display: "flex",
  alignItems: "center",
  gap: 18,
};

const quickLinks: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const quickBtn: React.CSSProperties = {
  border:
    "1px solid #253247",
  background: "#111b29",
  color: "#aeb9c9",
  borderRadius: 7,
  padding:
    "7px 9px",
  fontSize: 10,
  cursor: "pointer",
};

const card: React.CSSProperties = {
  background: "#0d1520",
  border:
    "1px solid #1d2a3b",
  borderRadius: 12,
  padding: 16,
  marginBottom: 12,
  boxSizing:
    "border-box",
};

const cardHead: React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems:
    "flex-start",
  gap: 12,
  marginBottom: 14,
};

const statusPill: React.CSSProperties = {
  color: "#36e28b",
  background:
    "rgba(54,226,139,.08)",
  border:
    "1px solid rgba(54,226,139,.2)",
  padding:
    "5px 8px",
  borderRadius: 99,
  fontSize: 9,
  fontWeight: 800,
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3,minmax(0,1fr))",
  gap: 11,
  marginBottom: 14,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 5,
  color: "#8793a7",
  fontSize: 10,
  fontWeight: 700,
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing:
    "border-box",
  background: "#09111b",
  color: "#e8edf7",
  border:
    "1px solid #253247",
  borderRadius: 7,
  padding:
    "9px 10px",
  fontSize: 12,
  outline: "none",
};

const previewBox: React.CSSProperties = {
  display: "grid",
  alignContent:
    "center",
  gap: 2,
  padding:
    "9px 11px",
  background: "#101a27",
  border:
    "1px dashed #2a3a51",
  borderRadius: 7,
};

const closeBtn: React.CSSProperties = {
  border:
    "1px solid #28364a",
  background: "#111b29",
  color: "#aeb9c9",
  width: 30,
  height: 30,
  borderRadius: 7,
  cursor: "pointer",
  fontSize: 19,
};

const empty: React.CSSProperties = {
  padding: 32,
  textAlign: "center",
  color: "#667389",
  fontSize: 12,
};

const tCard: React.CSSProperties = {
  background: "#101925",
  border:
    "1px solid #202e40",
  borderRadius: 9,
  padding: 12,
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: 15,
};

const tMeta: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  color: "#68768b",
  fontSize: 9,
  textTransform:
    "uppercase",
};

const tStats: React.CSSProperties = {
  display: "flex",
  gap: 13,
  flexWrap: "wrap",
  color: "#68768b",
  fontSize: 10,
  margin:
    "7px 0",
};

const tActions: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent:
    "flex-end",
};

const smallSelect: React.CSSProperties = {
  ...input,
  width: "auto",
  padding:
    "7px 8px",
  fontSize: 10,
};

const dangerButton: React.CSSProperties = {
  border:
    "1px solid rgba(240,67,91,.3)",
  borderRadius: 7,
  background:
    "rgba(240,67,91,.08)",
  color: "#ff7185",
  padding:
    "7px 9px",
  fontSize: 10,
  fontWeight: 800,
  cursor: "pointer",
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background:
    "rgba(0,0,0,.72)",
  display: "grid",
  placeItems: "center",
  padding: 18,
  zIndex: 100,
};

const modal: React.CSSProperties = {
  width:
    "min(1000px,100%)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#0d1520",
  border:
    "1px solid #26364b",
  borderRadius: 14,
  padding: 17,
  boxSizing:
    "border-box",
};

const joinCount: React.CSSProperties = {
  padding:
    "10px 12px",
  background: "#101b29",
  border:
    "1px solid #202e40",
  borderRadius: 8,
  marginBottom: 12,
  fontSize: 11,
  color: "#8490a4",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse:
    "collapse",
  minWidth: 700,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: 9,
  color: "#65738a",
  fontSize: 9,
  borderBottom:
    "1px solid #233044",
};

const td: React.CSSProperties = {
  padding: 9,
  color: "#b8c2d1",
  fontSize: 10,
  borderBottom:
    "1px solid #172334",
};

function pill(
  status: string
): React.CSSProperties {
  return {
    padding:
      "3px 6px",
    borderRadius: 99,
    background:
      status === "live"
        ? "rgba(54,226,139,.1)"
        : status ===
          "cancelled"
        ? "rgba(240,67,91,.1)"
        : "rgba(88,160,255,.1)",
    color:
      status === "live"
        ? "#36e28b"
        : status ===
          "cancelled"
        ? "#ff7185"
        : "#76b7ff",
  };
}