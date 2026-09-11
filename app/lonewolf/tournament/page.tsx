"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tournament = {
  id: string;
  title: string;
  entry: string;
  prize: string;
  kill: string;
  participants: string;
  joined: string;
  date: string;
  map: string;
  rules: string;
  mode: string;
  status: string;
};

function formatStartTime(value: string | null) {
  if (!value) return "Time TBA";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time TBA";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function LoneWolfPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("SOLO");
  const [navActive, setNavActive] = useState<"matches" | "home" | "support">("home");
  const navRef = useRef<HTMLDivElement | null>(null);
  const [navDragPosition, setNavDragPosition] = useState(1);
  const navDragging = useRef(false);
  const navStartX = useRef(0);
  const navDraggedClick = useRef(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentRefreshKey, setTournamentRefreshKey] = useState(0);
  const [tournamentsLoading, setTournamentsLoading] = useState(true);
  const [tournamentError, setTournamentError] = useState("");
  const [banner, setBanner] = useState(0);
  const [dbBanners, setDbBanners] = useState<
    { id: string; image_url: string; click_url: string | null; title: string | null }[]
  >([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwiping = useRef(false);

  // Lone Wolf page must NEVER show Clash Squad or any other game.
  // The tabs only filter the mode inside Lone Wolf.
  const filteredTournaments = tournaments.filter((tournament) => {
    const mode = String(tournament.mode ?? "").trim().toLowerCase();
    return mode === activeTab.toLowerCase();
  });

  // LOAD LONE WOLF BANNERS
  useEffect(() => {
    async function loadBanners() {
      setBannersLoading(true);
      const { data, error } = await supabase
        .from("banners")
        .select("id,image_url,click_url,title")
        .eq("is_active", true)
        .eq("game_type", "lonewolf")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Lone Wolf banners:", error);
        setDbBanners([]);
      } else {
        setDbBanners(data || []);
      }
      setBanner(0);
      setBannersLoading(false);
    }

    loadBanners();
  }, []);

  // LOAD TOURNAMENTS FROM DATABASE
  useEffect(() => {
    let cancelled = false;

    async function loadTournaments() {
      setTournamentsLoading(true);
      setTournamentError("");

      try {
        const { data, error } = await supabase
          .from("tournaments")
          .select(
            "id,title,game,mode,entry_fee,prize_pool,kill_reward,max_players,start_time,map,rules,status,created_at"
          )
          .order("created_at", { ascending: false });

        if (error) {
          console.error("TOURNAMENT DB ERROR:", error);
          if (!cancelled) {
            setTournamentError(error.message || "Unable to load tournaments");
            setTournaments([]);
          }
          return;
        }

        console.log("TOURNAMENT DB DATA:", data);

        const tournamentRows = (data || []).filter((item) => {
          const game = String(item.game ?? "")
            .trim()
            .toLowerCase()
            .replace(/[_-]/g, " ")
            .replace(/\s+/g, " ");

          const status = String(item.status ?? "")
            .trim()
            .toLowerCase();

          // THIS PAGE IS ONLY FOR LONE WOLF.
          // Clash Squad, Free Fire and Free Fire MAX must never appear here.
          const isLoneWolf =
            game === "lonewolf" ||
            game === "lone wolf";

          return isLoneWolf && status === "upcoming";
        });

        const tournamentIds = tournamentRows.map((item) => item.id);

        // A tournament must also disappear from this page when its match is LIVE.
        const liveTournamentIds = new Set<string>();
        if (tournamentIds.length > 0) {
          const { data: matchRows, error: matchError } = await supabase
            .from("matches")
            .select("tournament_id,status")
            .in("tournament_id", tournamentIds);

          if (matchError) {
            console.error("Tournament matches:", matchError);
          } else {
            (matchRows || []).forEach((match) => {
              const matchStatus = String(match.status ?? "").trim().toLowerCase();
              if (["live", "ongoing", "started", "room_ready"].includes(matchStatus)) {
                liveTournamentIds.add(match.tournament_id);
              }
            });
          }
        }

        const visibleTournamentRows = tournamentRows.filter(
          (item) => !liveTournamentIds.has(item.id)
        );

        const visibleTournamentIds = visibleTournamentRows.map((item) => item.id);
        let joinedCounts: Record<string, number> = {};

        if (visibleTournamentIds.length > 0) {
          const { data: entries, error: entriesError } = await supabase
            .from("tournament_entries")
            .select("tournament_id")
            .in("tournament_id", visibleTournamentIds);

          if (entriesError) {
            console.error("Tournament entries:", entriesError);
          } else {
            joinedCounts = (entries || []).reduce(
              (counts, entry) => {
                counts[entry.tournament_id] =
                  (counts[entry.tournament_id] || 0) + 1;
                return counts;
              },
              {} as Record<string, number>
            );
          }
        }

        const mapped: Tournament[] = visibleTournamentRows.map((item) => ({
          id: item.id,
          title: item.title || "Tournament",
          entry: `₹${Number(item.entry_fee || 0).toLocaleString("en-IN")}`,
          prize: `₹${Number(item.prize_pool || 0).toLocaleString("en-IN")}`,
          kill: `₹${Number(item.kill_reward || 0).toLocaleString("en-IN")}/Kill`,
          participants: String(item.max_players || 0),
          joined: String(joinedCounts[item.id] || 0),
          date: formatStartTime(item.start_time),
          map: item.map || "Bermuda Classic",
          rules:
            Array.isArray(item.rules) && item.rules.length > 0
              ? item.rules.slice(0, 2).join(" • ")
              : "Read all tournament rules before joining",
          mode: item.mode || "Solo",
          status: item.status || "upcoming",
        }));

        console.log("LONE WOLF TOURNAMENTS AFTER FILTER:", mapped);

        if (!cancelled) {
          setTournaments(mapped);
        }
      } catch (error) {
        console.error("Lone Wolf tournaments:", error);

        if (!cancelled) {
          setTournamentError(
            error instanceof Error
              ? error.message
              : "Unable to load tournaments"
          );
          setTournaments([]);
        }
      } finally {
        if (!cancelled) {
          setTournamentsLoading(false);
        }
      }
    }

    loadTournaments();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function loadTournaments() {
      setTournamentsLoading(true);

      try {
        // Fetch tournaments without client-side database filters first.
        // This avoids hidden data when the database contains small
        // differences in game/status text.
        const { data, error } = await supabase
          .from("tournaments")
          .select(
            "id,title,game,mode,entry_fee,prize_pool,kill_reward,max_players,start_time,map,rules,status"
          )
          .order("created_at", { ascending: false });

        if (error) {
          console.error("TOURNAMENT DB ERROR:", error);
          throw error;
        }

        console.log("TOURNAMENT DB DATA:", data);

        const tournamentRows = (data || []).filter((item) => {
          const game = String(item.game || "").trim().toLowerCase();
          const status = String(item.status || "").trim().toLowerCase();

          return (
            game === "lonewolf" &&
            status === "upcoming"
          );
        });
        const tournamentIds = tournamentRows.map((item) => item.id);

        // A tournament must also disappear from this page when its match is LIVE.
        const liveTournamentIds = new Set<string>();
        if (tournamentIds.length > 0) {
          const { data: matchRows, error: matchError } = await supabase
            .from("matches")
            .select("tournament_id,status")
            .in("tournament_id", tournamentIds);

          if (matchError) {
            console.error("Tournament matches:", matchError);
          } else {
            (matchRows || []).forEach((match) => {
              const matchStatus = String(match.status ?? "").trim().toLowerCase();
              if (["live", "ongoing", "started", "room_ready"].includes(matchStatus)) {
                liveTournamentIds.add(match.tournament_id);
              }
            });
          }
        }

        const visibleTournamentRows = tournamentRows.filter(
          (item) => !liveTournamentIds.has(item.id)
        );

        const visibleTournamentIds = visibleTournamentRows.map((item) => item.id);

        let joinedCounts: Record<string, number> = {};

        if (visibleTournamentIds.length > 0) {
          const { data: entries, error: entriesError } = await supabase
            .from("tournament_entries")
            .select("tournament_id")
            .in("tournament_id", visibleTournamentIds);

          if (entriesError) {
            // Player-count failure must NOT hide tournaments.
            console.error("Tournament entries:", entriesError);
          } else {
            joinedCounts = (entries || []).reduce(
              (counts, entry) => {
                counts[entry.tournament_id] =
                  (counts[entry.tournament_id] || 0) + 1;
                return counts;
              },
              {} as Record<string, number>
            );
          }
        }

        const mapped: Tournament[] = visibleTournamentRows.map((item) => ({
          id: item.id,
          title: item.title || "Tournament",
          entry: `₹${Number(item.entry_fee || 0).toLocaleString("en-IN")}`,
          prize: `₹${Number(item.prize_pool || 0).toLocaleString("en-IN")}`,
          kill: `₹${Number(item.kill_reward || 0).toLocaleString("en-IN")}/Kill`,
          participants: String(item.max_players || 0),
          joined: String(joinedCounts[item.id] || 0),
          date: formatStartTime(item.start_time),
          map: item.map || "Bermuda Classic",
          rules:
            Array.isArray(item.rules) && item.rules.length > 0
              ? item.rules.slice(0, 2).join(" • ")
              : "Read all tournament rules before joining",
          mode: item.mode || "Solo",
          status: item.status || "upcoming",
        }));

        console.log("LONE WOLF TOURNAMENTS AFTER FILTER:", mapped);
        setTournaments(mapped);
      } catch (error) {
        console.error("Lone Wolf tournaments:", error);
        setTournaments([]);
      } finally {
        setTournamentsLoading(false);
      }
    }

    loadTournaments();
  }, [tournamentRefreshKey]);

  // Keep this page in sync when tournaments/matches change.
  useEffect(() => {
    const channel = supabase
      .channel("freefire-tournament-page-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => setTournamentRefreshKey((prev) => prev + 1)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => setTournamentRefreshKey((prev) => prev + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (dbBanners.length <= 1) return;
    const timer = setInterval(() => {
      setBanner((prev) => (prev + 1) % dbBanners.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [dbBanners.length]);

  return (
    <main className="min-h-screen bg-[#f4f4f4] pb-20 text-black">

      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#ff174f] px-4 py-1 text-white shadow-md">
        <div className="relative flex h-8 items-center justify-center">

          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="absolute left-0 group flex h-9 w-9 items-center justify-center rounded-xl border border-red-500 bg-white text-slate-700 shadow-sm transition active:scale-95"
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

          <h1 className="text-lg font-black tracking-wide">
            LONE WOLF
          </h1>

        </div>
      </header>


      {/* =========================
          SLIDEABLE BANNER
      ========================= */}

      <section className="px-2.5 pt-2.5">

        <div
          className="relative h-36 overflow-hidden rounded-2xl touch-pan-y select-none"
          onTouchStart={(e) => {
            if (dbBanners.length <= 1) return;
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
            isSwiping.current = false;
          }}
          onTouchMove={(e) => {
            if (touchStartX.current === null || touchStartY.current === null) return;
            const deltaX = e.touches[0].clientX - touchStartX.current;
            const deltaY = e.touches[0].clientY - touchStartY.current;
            if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
              isSwiping.current = true;
            }
          }}
          onTouchEnd={(e) => {
            if (
              dbBanners.length <= 1 ||
              touchStartX.current === null ||
              touchStartY.current === null
            ) return;

            const deltaX = e.changedTouches[0].clientX - touchStartX.current;
            const deltaY = e.changedTouches[0].clientY - touchStartY.current;
            const swipeThreshold = 45;

            if (Math.abs(deltaX) >= swipeThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
              if (deltaX < 0) {
                setBanner((prev) => (prev + 1) % dbBanners.length);
              } else {
                setBanner((prev) => (prev - 1 + dbBanners.length) % dbBanners.length);
              }
            }

            touchStartX.current = null;
            touchStartY.current = null;
            isSwiping.current = false;
          }}
        >

          {bannersLoading ? (
            <div className="h-full w-full animate-pulse rounded-2xl bg-gray-200" />
          ) : dbBanners.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gray-200 text-xs font-bold text-gray-500">
              No Lone Wolf banners available
            </div>
          ) : (
            <>
              {dbBanners.map((item, index) => (
                <div
                  key={item.id}
                  className={`absolute inset-0 transition-all duration-500 ${
                    index === banner
                      ? "translate-x-0 opacity-100"
                      : index < banner
                      ? "-translate-x-full opacity-0"
                      : "translate-x-full opacity-0"
                  }`}
                >
                  <a
                    href={item.click_url || "#"}
                    onClick={(e) => {
                      if (!item.click_url) e.preventDefault();
                    }}
                    className="block h-full w-full"
                  >
                    <img
                      src={item.image_url}
                      alt={item.title || "Lone Wolf banner"}
                      className="h-full w-full rounded-2xl object-cover"
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  </a>
                </div>
              ))}
            </>
          )}

          {/* DOTS */}
          {dbBanners.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5">

            {dbBanners.map((_, index) => (
              <button
                key={index}
                onClick={() => setBanner(index)}
                className={`h-1.5 rounded-full transition-all ${
                  index === banner
                    ? "w-5 bg-white"
                    : "w-1.5 bg-white/50"
                }`}
              />
            ))}

          </div>
          )}

        </div>

      </section>


     {/* GAME MODE SLIDER */}

<div className="bg-white px-3 py-3">

  <div className="relative flex rounded-xl bg-gray-100 p-1">

    {/* SLIDING ACTIVE BACKGROUND */}
    <div
      className={`absolute top-1 bottom-1 w-[calc(33.333%-2.67px)] rounded-lg bg-[#ff174f] shadow-md transition-all duration-300 ${
        activeTab === "SOLO"
          ? "left-1"
          : activeTab === "DUO"
          ? "left-[33.333%]"
          : "left-[66.666%]"
      }`}
    />

    {["SOLO", "DUO", "SQUAD"].map((item) => (

      <button
        key={item}
        onClick={() => {
          setActiveTab(item);
          setTournamentRefreshKey((prev) => prev + 1);
        }}
        className={`relative z-10 flex-1 py-2.5 text-xs font-black transition-colors duration-300 ${
          activeTab === item
            ? "text-white"
            : "text-gray-500"
        }`}
      >
        {item}
      </button>

    ))}

  </div>

</div>


      {/* TOURNAMENTS */}

      <section className="space-y-3 p-2.5">

        <div className="flex items-center justify-between px-1">

          <h2 className="text-sm font-black">
            🔥 Upcoming Tournaments
          </h2>

          <span className="text-[8px] font-medium text-gray-500">
            {filteredTournaments.length} Matches
          </span>

        </div>

        {tournamentsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="animate-pulse">
                  <div className="flex gap-2 px-2 pt-2 pb-2">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-gray-200" />
                    <div className="min-w-0 flex-1 space-y-2 pt-1">
                      <div className="h-3 w-3/5 rounded bg-gray-200" />
                      <div className="h-2 w-full rounded bg-gray-100" />
                      <div className="h-2 w-4/5 rounded bg-gray-100" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-y border-gray-100">
                    <div className="space-y-2 px-2 py-2">
                      <div className="mx-auto h-2 w-12 rounded bg-gray-100" />
                      <div className="mx-auto h-3 w-14 rounded bg-gray-200" />
                    </div>
                    <div className="space-y-2 px-2 py-2">
                      <div className="mx-auto h-2 w-12 rounded bg-gray-100" />
                      <div className="mx-auto h-3 w-14 rounded bg-gray-200" />
                    </div>
                    <div className="space-y-2 px-2 py-2">
                      <div className="mx-auto h-2 w-12 rounded bg-gray-100" />
                      <div className="mx-auto h-3 w-14 rounded bg-gray-200" />
                    </div>
                  </div>

                  <div className="px-2 pt-2">
                    <div className="mb-1 flex justify-between">
                      <div className="h-2 w-16 rounded bg-gray-100" />
                      <div className="h-2 w-10 rounded bg-gray-100" />
                    </div>
                    <div className="h-1 rounded-full bg-gray-100" />
                  </div>

                  <div className="grid grid-cols-3 gap-1 p-2">
                    <div className="h-8 rounded-lg bg-gray-100" />
                    <div className="h-8 rounded-lg bg-gray-100" />
                    <div className="h-8 rounded-lg bg-gray-100" />
                  </div>

                  <div className="h-9 bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : tournamentError ? (
          <div className="rounded-xl border border-red-200 bg-white px-4 py-6 text-center">
            <div className="text-sm font-black text-red-600">
              Tournament load failed
            </div>
            <div className="mt-1 break-words text-[10px] font-semibold text-gray-500">
              {tournamentError}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg bg-[#ff174f] px-4 py-2 text-[10px] font-black text-white"
            >
              RETRY
            </button>
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="rounded-xl bg-white px-4 py-8 text-center text-xs font-bold text-gray-500">
            No upcoming tournaments available
          </div>
        ) : (
          filteredTournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
            />
          ))
        )}

      </section>


      {/* =========================
          PREMIUM BOTTOM NAV
      ========================= */}

      <nav className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3">
        <div className="mx-auto max-w-md">
          <div
            ref={navRef}
            className="relative flex h-[68px] items-center rounded-[22px] border border-white/60 bg-white/35 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-2xl backdrop-saturate-150 touch-none select-none"
            onPointerDown={(e) => {
              if (e.pointerType === "mouse" && e.button !== 0) return;
              navStartX.current = e.clientX;
              navDragging.current = false;
              navDraggedClick.current = false;
              e.currentTarget.setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;

              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
              const cell = rect.width / 3;
              const position = Math.max(
                0,
                Math.min(2, x / cell - 0.5)
              );

              if (Math.abs(e.clientX - navStartX.current) > 4) {
                navDragging.current = true;
                navDraggedClick.current = true;
              }

              setNavDragPosition(position);

              const index = Math.max(
                0,
                Math.min(2, Math.round(position))
              );

              const next =
                index === 0
                  ? "matches"
                  : index === 1
                  ? "home"
                  : "support";

              setNavActive(next);
            }}
            onPointerUp={(e) => {
              if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;

              const rect = e.currentTarget.getBoundingClientRect();
              const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
              const index = Math.max(
                0,
                Math.min(2, Math.round(x / (rect.width / 3) - 0.5))
              );

              const next =
                index === 0
                  ? "matches"
                  : index === 1
                  ? "home"
                  : "support";

              setNavActive(next);
              setNavDragPosition(index);
              e.currentTarget.releasePointerCapture?.(e.pointerId);

              if (navDragging.current) {
                navDragging.current = false;

                if (next === "matches") {
                  window.location.href = "/freefire/tournament/mymatches";
                } else if (next === "home") {
                  window.location.href = "/";
                } else {
                  alert("Help & Support");
                }
              }
            }}
            onPointerCancel={(e) => {
              navDragging.current = false;
              e.currentTarget.releasePointerCapture?.(e.pointerId);
              setNavDragPosition(
                navActive === "matches"
                  ? 0
                  : navActive === "home"
                  ? 1
                  : 2
              );
            }}
          >

            {/* SLIDING ACTIVE PILL */}
            <span
              className={`pointer-events-none absolute bottom-1.5 top-1.5 left-1.5 w-[calc(33.333%_-_4px)] rounded-[18px] bg-gradient-to-b from-red-50 via-pink-50 to-white shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_5px_16px_rgba(255,23,79,0.12)] ${
                navDragging.current
                  ? "transition-none scale-[1.03]"
                  : "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              }`}
              style={{
                transform: `translate3d(${navDragPosition * 100}%, 0, 0)`,
                willChange: "transform",
              }}
            />

            {/* MY MATCHES */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (navDraggedClick.current) {
                  e.preventDefault();
                  navDraggedClick.current = false;
                  return;
                }
                setNavActive("matches");
                setNavDragPosition(0);
                window.location.href = "/freefire/tournament/mymatches";
              }}
              className="relative z-10 flex h-full flex-1 flex-col items-center justify-center rounded-[18px] transition-transform active:scale-95"
            >
              <span className="text-[21px] leading-none">👤</span>
              <span
                className={`mt-1 text-[9px] font-black tracking-wide ${
                  navActive === "matches" ? "text-red-600" : "text-gray-700"
                }`}
              >
                MY MATCHES
              </span>
            </button>

            {/* HOME */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (navDraggedClick.current) {
                  e.preventDefault();
                  navDraggedClick.current = false;
                  return;
                }
                setNavActive("home");
                setNavDragPosition(1);
                window.location.href = "/";
              }}
              className="relative z-10 flex h-full flex-1 flex-col items-center justify-center rounded-[18px] transition-transform active:scale-95"
            >
              <span className="text-[21px] leading-none">🏠</span>
              <span
                className={`mt-1 text-[9px] font-black tracking-wide ${
                  navActive === "home" ? "text-red-600" : "text-gray-700"
                }`}
              >
                HOME
              </span>
            </button>

            {/* SUPPORT */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (navDraggedClick.current) {
                  e.preventDefault();
                  navDraggedClick.current = false;
                  return;
                }
                setNavActive("support");
                setNavDragPosition(2);
              }}
              className="relative z-10 flex h-full flex-1 flex-col items-center justify-center rounded-[18px] transition-transform active:scale-95"
            >
              <span className="text-[21px] leading-none">🎧</span>
              <span
                className={`mt-1 text-[9px] font-black tracking-wide ${
                  navActive === "support" ? "text-red-600" : "text-gray-700"
                }`}
              >
                SUPPORT
              </span>
            </button>

          </div>
        </div>
      </nav>

    </main>
  );
}


/* =========================
   TOURNAMENT CARD
========================= */

function TournamentCard({
  tournament,
}: {
  tournament: Tournament;
}) {
  const isDuo = String(tournament.mode ?? "").trim().toLowerCase() === "duo";

  const maxPlayers = Number(tournament.participants) || 0;
  const joinedPlayers = Number(tournament.joined) || 0;

  // Duo tournaments have 24 team slots and 48 player slots.
  // Solo/Squad keep their existing participant calculation untouched.
  const maxTeams = 24;
  const joinedTeams = isDuo
    ? Math.min(maxTeams, Math.ceil(joinedPlayers / 2))
    : 0;

  const percentage = isDuo
    ? maxTeams > 0
      ? (joinedTeams / maxTeams) * 100
      : 0
    : maxPlayers > 0
      ? (joinedPlayers / maxPlayers) * 100
      : 0;

  return (
    <div
      className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition-all active:scale-[0.995] ${
        isDuo
          ? "border-red-200 shadow-[0_6px_20px_rgba(255,23,79,0.10)]"
          : "border-gray-200"
      }`}
    >
      {/* HEADER */}
      <div className="relative px-2.5 pt-2.5 pb-2">
        {isDuo && (
          <div className="absolute right-2.5 top-2.5 rounded-full bg-[#ff174f] px-2 py-0.5 text-[8px] font-black tracking-wide text-white shadow-sm">
            🔥 DUO
          </div>
        )}

        <div className="flex items-center gap-2">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              isDuo ? "bg-red-50" : "bg-gray-50"
            }`}
          >
            <img
              src="/freefire-icon.png"
              alt="Lone Wolf"
              className="h-10 w-10 object-contain"
            />
          </div>

          <div className="min-w-0 flex-1 pr-14">
            <div className="mb-0.5 flex items-center gap-1.5">
              {!isDuo && (
                <>
                  <span className="text-[8px] font-black uppercase tracking-wide text-[#ff174f]">
                    LONE WOLF
                  </span>

                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[7px] font-black uppercase text-gray-500">
                    {tournament.mode}
                  </span>
                </>
              )}
            </div>

            <h2 className="truncate text-[14px] font-black leading-tight text-gray-900">
              {tournament.title}
            </h2>

            <p className="mt-0.5 truncate text-[8px] leading-[11px] text-gray-500">
              {tournament.rules}
            </p>
          </div>
        </div>
      </div>

      {/* ENTRY / PRIZE / KILL */}
      <div className="grid grid-cols-3 border-y border-gray-100 bg-gray-50/50">
        <InfoBox
          icon="👑"
          title="Entry"
          value={tournament.entry}
        />

        <InfoBox
          icon="🏆"
          title="Prize Pool"
          value={tournament.prize}
        />

        <InfoBox
          icon="🪙"
          title="Kill Point"
          value={tournament.kill}
        />
      </div>

      {/* DUO TEAM / PLAYER STATUS */}
      {isDuo ? (
        <>
          <div className="px-2.5 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[8px] font-bold text-gray-500">
                DUO TEAMS
              </span>

              <span className="text-[8px] font-black text-gray-800">
                {joinedTeams}/{maxTeams} Teams
              </span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#ff174f] transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, percentage))}%`,
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 px-2.5 pt-2">
            <div className="rounded-xl border border-red-100 bg-red-50/60 px-2 py-1.5 text-center">
              <div className="text-[8px] font-bold text-gray-500">
                👥 TEAMS
              </div>
              <div className="mt-0.5 text-[11px] font-black text-gray-900">
                {joinedTeams}/{maxTeams}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 px-2 py-1.5 text-center">
              <div className="text-[8px] font-bold text-gray-500">
                🎮 PLAYERS
              </div>
              <div className="mt-0.5 text-[11px] font-black text-gray-900">
                {joinedPlayers}/{maxPlayers || 48}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ORIGINAL SOLO/SQUAD PROGRESS */}
          <div className="px-2 pt-1">
            <div className="mb-0 flex justify-between">
              <span className="text-[8px] font-medium text-gray-500">
                Filling Fast
              </span>

              <span className="text-[8px] font-bold">
                {tournament.joined}/{tournament.participants}
              </span>
            </div>

            <div className="h-1 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#ff174f]"
                style={{
                  width: `${percentage}%`,
                }}
              />
            </div>
          </div>

          {/* ORIGINAL SOLO/SQUAD DETAILS */}
          <div className="grid grid-cols-3 gap-0.5 p-2">
            <DetailBox
              icon="◷"
              title="Start Date"
              value={tournament.date}
            />

            <DetailBox
              icon="👥"
              title="Participants"
              value={tournament.participants}
            />

            <DetailBox
              icon="🗺️"
              title="Map"
              value={tournament.map}
            />
          </div>
        </>
      )}

      {/* DUO DETAILS */}
      {isDuo && (
        <div className="grid grid-cols-3 gap-0.5 p-2.5">
          <DetailBox
            icon="◷"
            title="Start Date"
            value={tournament.date}
          />

          <DetailBox
            icon="👥"
            title="Players"
            value={`${joinedPlayers}/${maxPlayers || 48}`}
          />

          <DetailBox
            icon="🗺️"
            title="Map"
            value={tournament.map}
          />
        </div>
      )}

      {/* VIEW */}
      <button
        type="button"
        onClick={() => {
          window.location.href = `/lonewolf/tournament/${tournament.id}`;
        }}
        className={`w-full py-2.5 text-[11px] font-black tracking-wide text-white transition-all active:scale-[0.99] ${
          isDuo
            ? "bg-[#ff174f] shadow-[0_-3px_12px_rgba(255,23,79,0.10)]"
            : "bg-[#ff174f]"
        }`}
      >
        {isDuo ? "JOIN DUO NOW  →" : "VIEW →"}
      </button>
    </div>
  );
}

/* =========================
   INFO BOX
========================= */

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


/* =========================
   DETAIL BOX
========================= */

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


/* =========================
   BOTTOM NAV BUTTON
========================= */

function BottomButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center py-2 ${
        active ? "text-red-600" : "text-gray-700"
      }`}
    >

      <span className="text-[21px] leading-5">
        {icon}
      </span>

      <span className="mt-1 text-[10px] font-bold">
        {label}
      </span>

    </button>
  );
}