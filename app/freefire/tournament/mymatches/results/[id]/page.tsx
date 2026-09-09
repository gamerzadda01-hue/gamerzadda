"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

type Participant = {
  user_id: string;
  username: string | null;
  game_name: string | null;
  uid: string | null;
  level: number | null;
  bio: string | null;
  rank: number | null;
  kills: number;
  winning_amount: number;
};

type ResultsData = {
  tournament: {
    id: string;
    title: string;
    game: string;
    mode: string;
    map: string | null;
    start_time: string | null;
    prize_pool: number;
  };
  myResult: Participant | null;
  participants: Participant[];
};

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id || "");

  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Tournament ID is missing.");
      return;
    }

    async function loadResults() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/tournaments/my-matches/${encodeURIComponent(id)}/results`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const responseText = await response.text();

        let json: any = {};

        if (responseText.trim()) {
          const contentType =
            response.headers.get("content-type") || "";

          if (contentType.includes("application/json")) {
            try {
              json = JSON.parse(responseText);
            } catch {
              throw new Error("Server returned invalid JSON.");
            }
          } else {
            throw new Error(`Server returned ${response.status}.`);
          }
        }

        if (!response.ok) {
          throw new Error(
            json?.error ||
              json?.message ||
              `Failed to load results. (${response.status})`
          );
        }

        if (!json || typeof json !== "object") {
          throw new Error("Invalid results response from server.");
        }

        setData(json as ResultsData);
      } catch (err) {
        console.error("Results:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load results."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadResults();
  }, [id]);

  function formatDate(value: string | null) {
    if (!value) return "Time not set";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Time not set";
    }

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  /* =========================================================
     FULL PAGE SKELETON
  ========================================================= */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f5f5]">
        <div className="mx-auto min-h-screen w-full max-w-md">

          {/* HEADER SKELETON */}
          <header className="sticky top-0 z-40 bg-[#ff174f] px-3 py-1.5 shadow-sm">
            <div className="flex h-9 items-center gap-2">
              <div className="h-9 w-9 animate-pulse rounded-xl bg-white/20" />

              <div className="h-3 w-16 animate-pulse rounded bg-white/25" />
            </div>
          </header>

          <div className="space-y-2.5 p-3">

            {/* TOURNAMENT CARD SKELETON */}
            <section>
              <div className="overflow-hidden rounded-2xl bg-white shadow-[0_5px_20px_rgba(0,0,0,0.06)]">

                {/* RED TITLE BAR */}
                <div className="bg-[#ff174f] px-4 py-2.5">
                  <div className="h-4 w-36 animate-pulse rounded bg-white/25" />
                </div>

                {/* GAME / MODE / PRIZE */}
                <div className="grid grid-cols-3 divide-x border-b border-gray-100">

                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="px-2 py-3 text-center"
                    >
                      <div className="mx-auto h-2 w-8 animate-pulse rounded bg-gray-200" />

                      <div className="mx-auto mt-1.5 h-3 w-14 animate-pulse rounded bg-gray-100" />
                    </div>
                  ))}

                </div>

                {/* START / MAP / PLAYERS */}
                <div className="grid grid-cols-3 gap-1.5 p-2.5">

                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl bg-gray-50 px-2 py-2.5"
                    >
                      <div className="mx-auto h-2 w-8 animate-pulse rounded bg-gray-200" />

                      <div className="mx-auto mt-1.5 h-2.5 w-14 animate-pulse rounded bg-gray-200" />
                    </div>
                  ))}

                </div>

              </div>
            </section>

            {/* YOUR RESULT SKELETON */}
            <section>
              <div className="rounded-2xl bg-white p-3.5 shadow-[0_5px_20px_rgba(0,0,0,0.06)]">

                <div className="mb-3 flex items-center gap-2">
                  <div className="h-7 w-7 animate-pulse rounded-full bg-gray-200" />

                  <div>
                    <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                    <div className="mt-1.5 h-2 w-32 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>

                {/* STATS */}
                <div className="grid grid-cols-3 gap-1.5">

                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="rounded-xl bg-gray-50 px-2 py-3"
                    >
                      <div className="mx-auto h-2 w-8 animate-pulse rounded bg-gray-200" />

                      <div className="mx-auto mt-2 h-5 w-10 animate-pulse rounded bg-gray-200" />
                    </div>
                  ))}

                </div>

                {/* PROFILE */}
                <div className="mt-2.5 rounded-xl bg-gray-50 px-3 py-3">

                  <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />

                  <div className="mt-2 flex gap-2">
                    <div className="h-2.5 w-20 animate-pulse rounded bg-gray-200" />
                    <div className="h-2.5 w-24 animate-pulse rounded bg-gray-200" />
                  </div>

                  <div className="mt-1.5 h-2.5 w-32 animate-pulse rounded bg-gray-200" />

                </div>

              </div>
            </section>

            {/* ALL PARTICIPANTS SKELETON */}
            <section>
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_5px_20px_rgba(0,0,0,0.06)]">

                {/* TITLE */}
                <div className="border-b border-gray-100 px-3.5 py-3">

                  <div className="flex items-center justify-between">

                    <div>
                      <div className="h-3 w-28 animate-pulse rounded bg-gray-200" />

                      <div className="mt-1.5 h-2 w-36 animate-pulse rounded bg-gray-100" />
                    </div>

                    <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />

                  </div>

                </div>

                {/* PARTICIPANT ROWS */}
                <div className="divide-y divide-gray-100">

                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <div
                      key={item}
                      className="px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">

                        {/* RANK */}
                        <div className="w-[48px] shrink-0 pt-1">
                          <div className="h-3 w-7 animate-pulse rounded bg-gray-200" />
                        </div>

                        {/* PLAYER */}
                        <div className="min-w-0 flex-1">

                          <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />

                          <div className="mt-1.5 h-2 w-32 animate-pulse rounded bg-gray-100" />

                          <div className="mt-1.5 h-2 w-40 animate-pulse rounded bg-gray-100" />

                        </div>

                        {/* STATS */}
                        <div className="w-[62px] shrink-0">

                          <div className="ml-auto h-2 w-8 animate-pulse rounded bg-gray-100" />

                          <div className="ml-auto mt-1 h-3 w-10 animate-pulse rounded bg-gray-200" />

                          <div className="ml-auto mt-2 h-3 w-8 animate-pulse rounded bg-gray-200" />

                        </div>

                      </div>
                    </div>
                  ))}

                </div>

              </div>
            </section>

          </div>
        </div>
      </main>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[#f5f5f5] px-3 py-5">
        <div className="mx-auto max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">

          <div className="text-3xl">
            ⚠️
          </div>

          <h1 className="mt-2 text-lg font-black">
            Results Not Found
          </h1>

          <p className="mt-2 text-xs font-semibold text-gray-500">
            {error || "Results are not available yet."}
          </p>

          <button
            onClick={() => router.back()}
            className="mt-5 rounded-xl bg-[#ff174f] px-5 py-2.5 text-xs font-black text-white"
          >
            GO BACK
          </button>

        </div>
      </main>
    );
  }

  const mine = data.myResult;

  return (
    <main className="min-h-screen bg-[#f5f5f5] pb-6 text-gray-900">
      <div className="mx-auto min-h-screen w-full max-w-md">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <header className="sticky top-0 z-40 bg-[#ff174f] px-3 py-1.5 shadow-sm">

          <div className="flex h-9 items-center gap-2">

            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="group flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition active:scale-95"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 transition group-hover:bg-white/20">

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

            <h1 className="text-sm font-black tracking-wide text-white">
              RESULTS
            </h1>

          </div>

        </header>

        {/* =====================================================
            TOURNAMENT SUMMARY
        ===================================================== */}

        <section className="p-3 pb-1.5">

          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_5px_20px_rgba(0,0,0,0.06)] ring-1 ring-gray-100">

            {/* THIN RED TITLE HEADER */}
            <div className="bg-[#ff174f] px-4 py-2">

              <h2 className="break-words text-sm font-black leading-tight text-white">
                {data.tournament.title}
              </h2>

            </div>

            {/* GAME / MODE / PRIZE */}
            <div className="grid grid-cols-3 divide-x border-b border-gray-100">

              <div className="px-2 py-2.5 text-center">

                <p className="text-[7px] font-black text-gray-400">
                  GAME
                </p>

                <p className="mt-0.5 truncate text-[10px] font-black">
                  {data.tournament.game || "Free Fire"}
                </p>

              </div>

              <div className="px-2 py-2.5 text-center">

                <p className="text-[7px] font-black text-gray-400">
                  MODE
                </p>

                <p className="mt-0.5 truncate text-[10px] font-black">
                  {data.tournament.mode || "Solo"}
                </p>

              </div>

              <div className="px-2 py-2.5 text-center">

                <p className="text-[7px] font-black text-gray-400">
                  PRIZE
                </p>

                <p className="mt-0.5 text-[10px] font-black text-emerald-600">
                  ₹
                  {Number(
                    data.tournament.prize_pool || 0
                  ).toLocaleString("en-IN")}
                </p>

              </div>

            </div>

            {/* START / MAP / PLAYERS */}
            <div className="grid grid-cols-3 gap-1.5 p-2.5">

              <div className="rounded-xl bg-gray-50 px-2 py-2 text-center">

                <p className="text-[7px] font-bold text-gray-400">
                  START
                </p>

                <p className="mt-0.5 text-[8px] font-black">
                  {formatDate(data.tournament.start_time)}
                </p>

              </div>

              <div className="rounded-xl bg-gray-50 px-2 py-2 text-center">

                <p className="text-[7px] font-bold text-gray-400">
                  MAP
                </p>

                <p className="mt-0.5 truncate text-[8px] font-black">
                  {data.tournament.map || "—"}
                </p>

              </div>

              <div className="rounded-xl bg-gray-50 px-2 py-2 text-center">

                <p className="text-[7px] font-bold text-gray-400">
                  PLAYERS
                </p>

                <p className="mt-0.5 text-[8px] font-black">
                  {data.participants.length}
                </p>

              </div>

            </div>

          </div>

        </section>

        {/* =====================================================
            YOUR RESULT
        ===================================================== */}

        <section className="px-3 pt-1.5">

          <div className="rounded-2xl bg-white p-3.5 shadow-[0_5px_20px_rgba(0,0,0,0.06)] ring-1 ring-gray-100">

            <div className="mb-2.5 flex items-center gap-2">

              <span className="text-lg">
                🏆
              </span>

              <div>

                <h2 className="text-xs font-black">
                  YOUR RESULT
                </h2>

                <p className="text-[8px] font-semibold text-gray-400">
                  Your performance in this match
                </p>

              </div>

            </div>

            {mine ? (
              <>

                {/* STATS */}
                <div className="grid grid-cols-3 gap-1.5">

                  <div className="rounded-xl bg-yellow-50 px-2 py-2.5 text-center">

                    <p className="text-[7px] font-black text-gray-400">
                      RANK
                    </p>

                    <p className="mt-0.5 text-xl font-black">
                      {mine.rank ?? "—"}
                    </p>

                  </div>

                  <div className="rounded-xl bg-blue-50 px-2 py-2.5 text-center">

                    <p className="text-[7px] font-black text-gray-400">
                      KILLS
                    </p>

                    <p className="mt-0.5 text-xl font-black text-red-600">
                      {mine.kills}
                    </p>

                  </div>

                  <div className="rounded-xl bg-emerald-50 px-2 py-2.5 text-center">

                    <p className="text-[7px] font-black text-gray-400">
                      WINNING
                    </p>

                    <p className="mt-0.5 text-base font-black text-emerald-600">
                      ₹
                      {Number(
                        mine.winning_amount || 0
                      ).toLocaleString("en-IN")}
                    </p>

                  </div>

                </div>

                {/* PLAYER PROFILE */}
                <div className="mt-2.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">

                  <p className="text-[12px] font-black">
                    {mine.game_name ||
                      mine.username ||
                      "Player"}
                  </p>

                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] font-semibold text-gray-500">

                    <span>
                      Name:{" "}
                      <b className="text-gray-700">
                        {mine.username || "—"}
                      </b>
                    </span>

                    <span>
                      IGN:{" "}
                      <b className="text-gray-700">
                        {mine.game_name || "—"}
                      </b>
                    </span>

                    <span>
                      UID:{" "}
                      <b className="text-gray-700">
                        {mine.uid || "—"}
                      </b>
                    </span>

                    <span>
                      Level:{" "}
                      <b className="text-gray-700">
                        {mine.level ?? "—"}
                      </b>
                    </span>

                  </div>

                  {mine.bio ? (
                    <p className="mt-1.5 text-[8px] font-medium leading-3 text-gray-500">

                      <span className="font-black text-gray-600">
                        Bio:
                      </span>{" "}

                      {mine.bio}

                    </p>
                  ) : null}

                </div>

              </>
            ) : (

              <div className="rounded-xl bg-gray-50 p-4 text-center">

                <p className="text-xs font-bold text-gray-500">
                  Your result has not been published yet.
                </p>

              </div>

            )}

          </div>

        </section>

        {/* =====================================================
            ALL PARTICIPANTS
        ===================================================== */}

        <section className="px-3 pt-2">

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_5px_20px_rgba(0,0,0,0.06)]">

            {/* HEADER */}
            <div className="border-b border-gray-100 px-3.5 py-3">

              <div className="flex items-center justify-between">

                <div>

                  <h2 className="text-xs font-black tracking-tight">
                    ALL PARTICIPANTS
                  </h2>

                  <p className="mt-0.5 text-[8px] font-semibold text-gray-400">
                    Players who joined this match
                  </p>

                </div>

                <div className="rounded-full bg-gray-100 px-2 py-1 text-[8px] font-black text-gray-500">
                  {data.participants.length} PLAYERS
                </div>

              </div>

            </div>

            {data.participants.length === 0 ? (

              <div className="p-6 text-center text-xs font-bold text-gray-400">
                No participants found.
              </div>

            ) : (

              <div className="divide-y divide-gray-100">

                {data.participants.map((player, index) => {

                  const displayRank =
                    player.rank ?? index + 1;

                  const isFirst =
                    displayRank === 1;

                  return (

                    <div
                      key={player.user_id}
                      className={`relative px-3 ${
                        isFirst
                          ? "bg-gradient-to-r from-cyan-50 via-white to-white py-3"
                          : mine?.user_id === player.user_id
                            ? "bg-red-50/50 py-1.5"
                            : "bg-white py-1.5"
                      }`}
                    >

                      {isFirst ? (
                        <div className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-cyan-400" />
                      ) : null}

                      <div className="flex items-start gap-2">

                        {/* RANK */}
                        <div className="flex w-[48px] shrink-0 items-start pt-0.5">

                          <div className="flex items-center gap-1">

                            <span
                              className={`text-[11px] font-black ${
                                isFirst
                                  ? "text-cyan-600"
                                  : "text-gray-500"
                              }`}
                            >
                              #{displayRank}
                            </span>

                            {isFirst ? (
                              <span className="first-rank-trophy">
                                🏆
                              </span>
                            ) : null}

                          </div>

                        </div>

                        {/* PLAYER DETAILS */}
                        <div className="min-w-0 flex-1 pr-1">

                          <p
                            className={`truncate text-[12px] ${
                              isFirst
                                ? "font-black text-gray-900"
                                : "font-extrabold text-gray-800"
                            }`}
                          >
                            {player.username ||
                              player.game_name ||
                              "Player"}
                          </p>

                          <p className="mt-0.5 truncate text-[8px] font-semibold text-gray-500">

                            IGN:{" "}

                            <span className="font-black text-gray-700">
                              {player.game_name || "—"}
                            </span>

                          </p>

                          <p className="mt-0.5 truncate text-[8px] font-semibold text-gray-500">

                            UID:{" "}

                            <span className="font-black text-gray-700">
                              {player.uid || "—"}
                            </span>

                            <span className="mx-1.5 text-gray-300">
                              •
                            </span>

                            Level:{" "}

                            <span className="font-black text-gray-700">
                              {player.level ?? "—"}
                            </span>

                          </p>

                          {player.bio ? (
                            <p className="mt-0.5 break-words text-[8px] font-medium leading-3 text-gray-500">

                              <span className="font-black text-gray-600">
                                Bio:
                              </span>{" "}

                              {player.bio}

                            </p>
                          ) : null}

                        </div>

                        {/* RIGHT STATS */}
                        <div className="flex w-[62px] shrink-0 flex-col items-end">

                          <div className="text-right">

                            <p className="text-[6px] font-black uppercase tracking-wide text-gray-400">
                              Win
                            </p>

                            <p
                              className={`text-[11px] font-black ${
                                player.winning_amount > 0
                                  ? "text-emerald-600"
                                  : "text-gray-700"
                              }`}
                            >
                              ₹
                              {Number(
                                player.winning_amount || 0
                              ).toLocaleString("en-IN")}
                            </p>

                          </div>

                          <div className="mt-0.5 flex items-center gap-1">

                            <span className="text-[6px] font-black uppercase tracking-wide text-red-500">
                              Kills
                            </span>

                            <span className="text-[11px] font-black text-red-600">
                              {player.kills}
                            </span>

                          </div>

                        </div>

                      </div>

                    </div>
                  );
                })}

              </div>

            )}

          </div>

        </section>

      </div>

      {/* =====================================================
          #1 TROPHY ANIMATION
      ===================================================== */}

      <style jsx>{`
        .first-rank-trophy {
          display: inline-block;
          font-size: 16px;
          line-height: 1;
          transform-origin: center;
          animation: trophyWinner 1.4s ease-in-out infinite;
        }

        @keyframes trophyWinner {
          0%,
          100% {
            transform: translateY(0) scale(1) rotate(0deg);
            filter: drop-shadow(
              0 0 2px rgba(255, 193, 7, 0.3)
            );
          }

          50% {
            transform: translateY(-2px) scale(1.18) rotate(-7deg);
            filter: drop-shadow(
              0 0 8px rgba(255, 193, 7, 0.9)
            );
          }
        }
      `}</style>

    </main>
  );
}