"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Match = {
  id: string;
  title: string;
  game: string;
  mode: string;
  entry_fee: number;
  prize_pool: number;
  kill_reward: number;
  max_players: number;
  start_time: string | null;
  map: string | null;
  status: string | null;
  joined_at: string | null;
  joined_count: number;
  room_ready: boolean;
  room_id: string | null;
  room_password: string | null;
  match_start_time: string | null;
  match_status: string | null;
};

type Tab = "upcoming" | "live" | "past";

function formatDate(value: string | null) {
  if (!value) return "Time not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not set";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getCategory(match: Match): Tab {
  const tournamentStatus = String(match.status || "")
    .trim()
    .toLowerCase();

  const matchStatus = String(match.match_status || "")
    .trim()
    .toLowerCase();

  // Admin controls the actual match status from the match/room section.
  if (
    matchStatus === "completed" ||
    matchStatus === "complete" ||
    matchStatus === "finished" ||
    matchStatus === "ended" ||
    matchStatus === "closed" ||
    matchStatus === "cancelled" ||
    matchStatus === "canceled"
  ) {
    return "past";
  }

  if (
    tournamentStatus === "completed" ||
    tournamentStatus === "complete" ||
    tournamentStatus === "finished" ||
    tournamentStatus === "ended" ||
    tournamentStatus === "closed" ||
    tournamentStatus === "cancelled" ||
    tournamentStatus === "canceled"
  ) {
    return "past";
  }

  if (
    matchStatus === "live" ||
    matchStatus === "ongoing" ||
    matchStatus === "started"
  ) {
    return "live";
  }

  if (
    tournamentStatus === "live" ||
    tournamentStatus === "ongoing" ||
    tournamentStatus === "started"
  ) {
    return "live";
  }

  if (match.room_ready) {
    return "live";
  }

  const matchTime = match.match_start_time
    ? new Date(match.match_start_time).getTime()
    : NaN;

  if (
    Number.isFinite(matchTime) &&
    Date.now() >= matchTime
  ) {
    return "live";
  }

  return "upcoming";
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TournamentCard({
  tournament,
  onOpenRoom,
}: {
  tournament: Match;
  onOpenRoom: () => void;
}) {
  const joined = Number(tournament.joined_count || 0);
  const participants = Number(tournament.max_players || 0);

  const percentage =
    participants > 0
      ? Math.min(100, (joined / participants) * 100)
      : 0;

  const category = getCategory(tournament);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* HEADER */}
      <div className="flex gap-1 px-2 pt-2 pb-1">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center">
          <img
            src="/freefire-icon.png"
            alt="Free Fire"
            className="h-12 w-12 object-contain"
          />
        </div>

        <div className="min-w-0">
          <h2 className="text-[13px] font-bold leading-tight">
            {tournament.title}
          </h2>

          <p className="mt-0 text-[8px] leading-[10px] text-gray-600">
            {tournament.game || "Free Fire"} •{" "}
            {tournament.mode || "Solo"}
          </p>
        </div>
      </div>

      {/* ENTRY / PRIZE / KILL */}
      <div className="grid grid-cols-3 border-y border-gray-100">
        <InfoBox
          icon="👑"
          title="Entry"
          value={`₹${Number(
            tournament.entry_fee || 0
          ).toLocaleString("en-IN")}`}
        />

        <InfoBox
          icon="🏆"
          title="Prize"
          value={`₹${Number(
            tournament.prize_pool || 0
          ).toLocaleString("en-IN")}`}
        />

        <InfoBox
          icon="🪙"
          title="Kill Point"
          value={`₹${Number(
            tournament.kill_reward || 0
          ).toLocaleString("en-IN")}`}
        />
      </div>

      {/* FILLING */}
      <div className="px-2 pt-1">
        <div className="mb-0 flex justify-between">
          <span className="text-[8px] font-medium text-gray-500">
            Filling Fast
          </span>

          <span className="text-[8px] font-bold">
            {joined}/{participants}
          </span>
        </div>

        <div className="h-1 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-[#ff174f]"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* DETAILS */}
      <div className="grid grid-cols-3 gap-0.5 p-2">
        <DetailBox
          icon="◷"
          title="Start Date"
          value={formatDate(tournament.start_time)}
        />

        <DetailBox
          icon="👥"
          title="Participants"
          value={String(participants)}
        />

        <DetailBox
          icon="🗺️"
          title="Map"
          value={tournament.map || "Bermuda Classic"}
        />
      </div>

      {/* ACTION */}
      {category === "live" ? (
        <button
          type="button"
          onClick={onOpenRoom}
          className="flex w-full items-center justify-center bg-[#ff174f] px-2 py-2.5 text-[11px] font-bold tracking-wide text-white transition active:scale-[0.99]"
        >
          🔑 CLICK TO VIEW CUSTOM ROOM ID PASS
        </button>
      ) : category === "past" ? (
        <Link
          href={`/freefire/tournament/mymatches/results/${tournament.id}`}
          className="flex h-7 w-full items-center justify-center gap-2 bg-[#ff174f] px-2 text-[9px] font-black tracking-wide text-white transition active:scale-[0.99]"
        >
          🏆 MATCH COMPLETED
          <span className="font-bold text-white/90">
            Tap to view results →
          </span>
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          <Link
            href={`/freefire/tournament/${tournament.id}`}
            className="flex items-center justify-center bg-[#ff174f] py-2 text-[11px] font-bold tracking-wide text-white active:scale-[0.99]"
          >
            VIEW →
          </Link>

          <div className="flex items-center justify-center bg-emerald-500 py-2 text-[11px] font-bold tracking-wide text-white">
            ✓ JOINED
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBox({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <div className="px-1 py-1.5 text-center">
      <div className="text-[8px] font-medium text-gray-500">
        {icon} {title}
      </div>

      <div className="mt-0 text-[11px] font-bold text-green-600">
        {value}
      </div>
    </div>
  );
}

function DetailBox({
  icon,
  title,
  value,
}: {
  icon: string;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-0.5 py-1 text-center">
      <div className="text-[8px] font-medium text-gray-500">
        {icon} {title}
      </div>

      <div className="mt-0.5 text-[8px] font-bold text-gray-700">
        {value}
      </div>
    </div>
  );
}

function MatchCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex gap-1 px-2 pt-2 pb-1">
        <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-200" />

        <div className="min-w-0 flex-1 space-y-1.5 py-1">
          <div className="h-3 w-3/4 rounded bg-gray-200" />
          <div className="h-2 w-1/2 rounded bg-gray-100" />
        </div>
      </div>

      <div className="grid grid-cols-3 border-y border-gray-100">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="space-y-1 px-1 py-2"
          >
            <div className="mx-auto h-2 w-10 rounded bg-gray-100" />
            <div className="mx-auto h-3 w-12 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      <div className="px-2 pt-1.5">
        <div className="mb-1 flex justify-between">
          <div className="h-2 w-16 rounded bg-gray-100" />
          <div className="h-2 w-10 rounded bg-gray-100" />
        </div>

        <div className="h-1 rounded-full bg-gray-100">
          <div className="h-full w-1/3 rounded-full bg-gray-200" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0.5 p-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-9 rounded-lg bg-gray-100"
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1">
        <div className="h-8 bg-gray-200" />
        <div className="h-8 bg-gray-100" />
      </div>
    </div>
  );
}

function MatchListSkeleton() {
  return (
    <div className="space-y-2">
      <MatchCardSkeleton />
      <MatchCardSkeleton />
    </div>
  );
}

export default function MyMatchesPage() {
  const router = useRouter();

  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] =
    useState<Tab>("upcoming");
  const [loading, setLoading] = useState(true);

  const [roomPopupMatch, setRoomPopupMatch] =
    useState<Match | null>(null);

  const [copiedField, setCopiedField] = useState<
    "room" | "password" | null
  >(null);

  const [navActive, setNavActive] = useState<
    "matches" | "home" | "support"
  >("matches");

  const [navDragPosition, setNavDragPosition] =
    useState(0);

  const navDragging = useRef(false);
  const navStartX = useRef(0);

  const [error, setError] = useState("");

  const tabRefreshLock = useRef(false);

  async function loadMatches() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/tournaments/my-matches",
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to load your matches."
        );
      }

      setMatches(
        Array.isArray(data.matches)
          ? data.matches
          : []
      );
    } catch (err) {
      console.error("My Matches:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load matches."
      );

      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMatches();
  }, []);

  // ==========================================
  // REALTIME LISTENER
  // Admin LIVE KEYS -> My Matches updates instantly
  // No polling / no 10-second refresh
  // ==========================================
  useEffect(() => {
    const channel = supabase
      .channel("my-matches-live-status")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournaments",
        },
        () => {
          void loadMatches();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        () => {
          void loadMatches();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function refreshOnTabChange(nextTab: Tab) {
    if (
      activeTab === nextTab ||
      tabRefreshLock.current
    ) {
      return;
    }

    tabRefreshLock.current = true;
    setActiveTab(nextTab);

    try {
      await loadMatches();
    } finally {
      window.setTimeout(() => {
        tabRefreshLock.current = false;
      }, 500);
    }
  }

  async function copyToClipboard(
    value: string | null,
    field: "room" | "password"
  ) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);

      setCopiedField(field);

      window.setTimeout(() => {
        setCopiedField(null);
      }, 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  const categorized = useMemo(() => {
    return {
      upcoming: matches.filter(
        (match) =>
          getCategory(match) === "upcoming"
      ),

      live: matches.filter(
        (match) =>
          getCategory(match) === "live"
      ),

      past: matches.filter(
        (match) =>
          getCategory(match) === "past"
      ),
    };
  }, [matches]);

  const visibleMatches =
    categorized[activeTab];

  const tabItems: {
    key: Tab;
    label: string;
  }[] = [
    {
      key: "upcoming",
      label: "UPCOMING",
    },
    {
      key: "live",
      label: "LIVE",
    },
    {
      key: "past",
      label: "PAST",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f5f5f5] pb-24 text-gray-900">
      <div className="mx-auto min-h-screen w-full max-w-md bg-[#f5f5f5]">

        {/* HEADER */}
        <header className="sticky top-0 z-40 border-b border-red-600 bg-[#ff174f] px-4 py-2 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="group flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-white text-slate-700 shadow-sm transition active:scale-95"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 transition group-hover:bg-emerald-100">
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

            <div className="min-w-0">
              <h1 className="text-lg font-black tracking-tight text-white">
                MY MATCHES
              </h1>

              <p className="text-[10px] font-bold text-white/80">
                Your joined tournaments
              </p>
            </div>
          </div>
        </header>

        {/* PREMIUM TABS */}
        <div className="sticky top-[73px] z-30 bg-[#f5f5f5] px-3 py-2.5">
          <div className="relative grid grid-cols-3 rounded-2xl border border-gray-200/80 bg-white p-1 shadow-[0_6px_20px_rgba(0,0,0,0.06)]">
            {tabItems.map((tab) => {
              const active =
                activeTab === tab.key;

              const count =
                categorized[tab.key].length;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() =>
                    refreshOnTabChange(tab.key)
                  }
                  className={`relative rounded-xl py-2.5 text-[10px] font-black tracking-[0.08em] transition-all duration-200 ${
                    active
                      ? "bg-[#ff174f] text-white shadow-[0_5px_14px_rgba(255,23,79,0.22)]"
                      : "text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  {tab.label}

                  <span
                    className={`ml-1 text-[9px] ${
                      active
                        ? "text-white/80"
                        : "text-gray-300"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTENT */}
        <section className="space-y-3 p-3">
          {loading ? (
            <MatchListSkeleton />
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-white px-4 py-8 text-center shadow-sm">
              <div className="text-sm font-black text-red-600">
                Unable to load matches
              </div>

              <p className="mt-1 break-words text-[10px] font-semibold text-gray-500">
                {error}
              </p>

              <button
                type="button"
                onClick={loadMatches}
                className="mt-4 rounded-xl bg-[#ff174f] px-5 py-2.5 text-[10px] font-black text-white"
              >
                RETRY
              </button>
            </div>
          ) : visibleMatches.length === 0 ? (
            <div className="rounded-2xl border border-gray-200/80 bg-white px-4 py-12 text-center shadow-[0_8px_25px_rgba(0,0,0,0.05)]">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-black text-gray-400">
                —
              </div>

              <h2 className="mt-3 text-sm font-black">
                {activeTab === "upcoming"
                  ? "No Upcoming Matches"
                  : activeTab === "live"
                  ? "No Live Matches"
                  : "No Past Matches"}
              </h2>

              <p className="mt-1 text-[10px] font-semibold text-gray-500">
                {activeTab === "upcoming"
                  ? "Join a tournament and it will appear here."
                  : activeTab === "live"
                  ? "Your live matches will appear here."
                  : "Your completed matches will appear here."}
              </p>

              {activeTab === "upcoming" && (
                <Link
                  href="/"
                  className="mt-4 inline-flex rounded-xl bg-[#ff174f] px-5 py-2.5 text-[10px] font-black text-white"
                >
                  JOIN TOURNAMENT
                </Link>
              )}
            </div>
          ) : (
            visibleMatches.map((match) => (
              <TournamentCard
                key={match.id}
                tournament={match}
                onOpenRoom={() => {
                  setCopiedField(null);
                  setRoomPopupMatch(match);
                }}
              />
            ))
          )}
        </section>

        {/* ROOM ID / PASSWORD POPUP */}
        {roomPopupMatch && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]"
            onClick={() => {
              setRoomPopupMatch(null);
              setCopiedField(null);
            }}
          >
            <div
              className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              {/* CLOSE - TOP RIGHT */}
              <button
                type="button"
                onClick={() => {
                  setRoomPopupMatch(null);
                  setCopiedField(null);
                }}
                aria-label="Close"
                title="Close"
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition active:scale-90"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </svg>
              </button>

              {/* POPUP HEADER */}
              <div className="border-b border-gray-100 px-4 py-3 pr-14">
                <p className="text-sm font-black text-gray-900">
                  ROOM DETAILS
                </p>

                <p className="mt-0.5 break-words text-[9px] font-semibold text-gray-400">
                  {roomPopupMatch.title}
                </p>
              </div>

              {/* ROOM ID + PASSWORD */}
              <div className="grid grid-cols-2 gap-2 p-3">

                {/* ROOM ID */}
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-2 py-3">
                  <p className="text-center text-[8px] font-black tracking-wider text-gray-400">
                    ROOM ID
                  </p>

                  <div className="mt-1 flex items-center justify-center gap-2">
                    <p className="min-w-0 break-all text-center text-[13px] font-black text-gray-900">
                      {roomPopupMatch.room_id || "—"}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          roomPopupMatch.room_id,
                          "room"
                        )
                      }
                      aria-label="Copy Room ID"
                      title="Copy Room ID"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 transition active:scale-90"
                    >
                      {copiedField === "room" ? (
                        <span className="text-sm font-black text-emerald-500">
                          ✓
                        </span>
                      ) : (
                        <CopyIcon />
                      )}
                    </button>
                  </div>
                </div>

                {/* PASSWORD */}
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-2 py-3">
                  <p className="text-center text-[8px] font-black tracking-wider text-gray-400">
                    PASSWORD
                  </p>

                  <div className="mt-1 flex items-center justify-center gap-2">
                    <p className="min-w-0 break-all text-center text-[13px] font-black text-gray-900">
                      {roomPopupMatch.room_password || "—"}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          roomPopupMatch.room_password,
                          "password"
                        )
                      }
                      aria-label="Copy Password"
                      title="Copy Password"
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 transition active:scale-90"
                    >
                      {copiedField === "password" ? (
                        <span className="text-sm font-black text-emerald-500">
                          ✓
                        </span>
                      ) : (
                        <CopyIcon />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* RED INSTRUCTION */}
              <p className="px-3 pb-4 text-center text-[10px] font-bold text-[#ff174f]">
                Copy the ID &amp; Password and join the custom room.
              </p>
            </div>
          </div>
        )}

        {/* PREMIUM GLASS BOTTOM NAV */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3">
          <div className="mx-auto max-w-md">
            <div
              className="relative flex h-[68px] touch-none select-none items-center rounded-[22px] border border-white/60 bg-white/35 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-2xl backdrop-saturate-150"
              onPointerDown={(e) => {
                if (
                  e.pointerType === "mouse" &&
                  e.button !== 0
                ) {
                  return;
                }

                navStartX.current = e.clientX;
                navDragging.current = false;
              }}
              onPointerMove={(e) => {
                const distance = Math.abs(
                  e.clientX - navStartX.current
                );

                if (
                  !navDragging.current &&
                  distance <= 6
                ) {
                  return;
                }

                if (!navDragging.current) {
                  navDragging.current = true;

                  e.currentTarget.setPointerCapture(
                    e.pointerId
                  );
                }

                if (
                  !e.currentTarget.hasPointerCapture(
                    e.pointerId
                  )
                ) {
                  return;
                }

                const rect =
                  e.currentTarget.getBoundingClientRect();

                const x = Math.max(
                  0,
                  Math.min(
                    rect.width,
                    e.clientX - rect.left
                  )
                );

                const cell = rect.width / 3;

                const position = Math.max(
                  0,
                  Math.min(2, x / cell - 0.5)
                );

                setNavDragPosition(position);

                const index = Math.max(
                  0,
                  Math.min(
                    2,
                    Math.round(position)
                  )
                );

                setNavActive(
                  index === 0
                    ? "matches"
                    : index === 1
                    ? "home"
                    : "support"
                );
              }}
              onPointerUp={(e) => {
                if (!navDragging.current) return;

                const rect =
                  e.currentTarget.getBoundingClientRect();

                const x = Math.max(
                  0,
                  Math.min(
                    rect.width,
                    e.clientX - rect.left
                  )
                );

                const index = Math.max(
                  0,
                  Math.min(
                    2,
                    Math.round(
                      x /
                        (rect.width / 3) -
                        0.5
                    )
                  )
                );

                const next =
                  index === 0
                    ? "matches"
                    : index === 1
                    ? "home"
                    : "support";

                setNavActive(next);
                setNavDragPosition(index);

                if (
                  e.currentTarget.hasPointerCapture(
                    e.pointerId
                  )
                ) {
                  e.currentTarget.releasePointerCapture(
                    e.pointerId
                  );
                }

                navDragging.current = false;

                if (next === "home") {
                  window.location.assign("/");
                } else if (
                  next === "support"
                ) {
                  window.location.assign(
                    "/support"
                  );
                }
              }}
              onPointerCancel={(e) => {
                if (
                  e.currentTarget.hasPointerCapture(
                    e.pointerId
                  )
                ) {
                  e.currentTarget.releasePointerCapture(
                    e.pointerId
                  );
                }

                navDragging.current = false;

                setNavDragPosition(
                  navActive === "matches"
                    ? 0
                    : navActive === "home"
                    ? 1
                    : 2
                );
              }}
            >
              {/* ACTIVE PILL */}
              <span
                className={`pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 w-[calc(33.333%_-_4px)] rounded-[18px] bg-gradient-to-b from-red-50 via-pink-50 to-white shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_5px_16px_rgba(255,23,79,0.12)] ${
                  navDragging.current
                    ? "scale-[1.03] transition-none"
                    : "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                }`}
                style={{
                  transform: `translate3d(${
                    navDragPosition * 100
                  }%, 0, 0)`,
                  willChange: "transform",
                }}
              />

              {/* MY MATCHES */}
              <button
                type="button"
                onClick={() => {
                  setNavActive("matches");
                  setNavDragPosition(0);
                }}
                className="relative z-10 flex h-full flex-1 flex-col items-center justify-center rounded-[18px] transition-transform active:scale-95"
              >
                <span className="text-[21px] leading-none">
                  👤
                </span>

                <span
                  className={`mt-1 text-[9px] font-black tracking-wide ${
                    navActive === "matches"
                      ? "text-red-600"
                      : "text-gray-700"
                  }`}
                >
                  MY MATCHES
                </span>
              </button>

              {/* HOME */}
              <button
                type="button"
                onClick={() => {
                  setNavActive("home");
                  setNavDragPosition(1);
                  window.location.assign("/");
                }}
                className="relative z-10 flex h-full flex-1 flex-col items-center justify-center rounded-[18px] transition-transform active:scale-95"
              >
                <span className="text-[21px] leading-none">
                  🏠
                </span>

                <span
                  className={`mt-1 text-[9px] font-black tracking-wide ${
                    navActive === "home"
                      ? "text-red-600"
                      : "text-gray-700"
                  }`}
                >
                  HOME
                </span>
              </button>

              {/* SUPPORT */}
              <button
                type="button"
                onClick={() => {
                  setNavActive("support");
                  setNavDragPosition(2);
                  window.location.assign(
                    "/support"
                  );
                }}
                className="relative z-10 flex h-full flex-1 flex-col items-center justify-center rounded-[18px] transition-transform active:scale-95"
              >
                <span className="text-[21px] leading-none">
                  🎧
                </span>

                <span
                  className={`mt-1 text-[9px] font-black tracking-wide ${
                    navActive === "support"
                      ? "text-red-600"
                      : "text-gray-700"
                  }`}
                >
                  SUPPORT
                </span>
              </button>
            </div>
          </div>
        </nav>
      </div>
    </main>
  );
}