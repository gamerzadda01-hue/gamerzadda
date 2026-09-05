"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function TournamentPage({
  params,
}: {
  params: { id: string };
}) {
  const [popup, setPopup] = useState<"how" | "rules" | "join" | null>(null);
  const [gameName, setGameName] = useState("");
  const [uid, setUid] = useState("");
  const [level, setLevel] = useState("");
  const [walletOpen, setWalletOpen] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joined, setJoined] = useState(false);

  // Supabase tournament
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load tournament from Supabase
  useEffect(() => {
    async function loadTournament() {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) {
        console.error("Tournament fetch error:", error);
        setTournament(null);
      } else {
        setTournament(data);
      }

      setLoading(false);
    }

    loadTournament();
  }, [params.id]);

  // Loading screen
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8]">
        <div className="text-center">
          <div className="text-5xl">🔥</div>
          <p className="mt-3 text-sm font-bold text-gray-500">
            Loading tournament...
          </p>
        </div>
      </main>
    );
  }

  // Tournament not found
  if (!tournament) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8]">
        <div className="px-5 text-center">
          <div className="text-5xl">😕</div>

          <p className="mt-4 text-xl font-black text-gray-900">
            Tournament not found
          </p>

          <p className="mt-2 text-sm font-medium text-gray-500">
            This tournament may have been removed or does not exist.
          </p>

          <button
            onClick={() => window.history.back()}
            className="mt-5 rounded-xl bg-red-600 px-6 py-3 text-sm font-black text-white"
          >
            Go Back
          </button>
        </div>
      </main>
    );
  }

  // Dynamic tournament values
  const availableBalance = 500;

  const entryFee = Number(tournament.entry_fee ?? 0);

  const balanceAfterJoin = availableBalance - entryFee;

  const maxPlayers = Number(tournament.max_players ?? 0);

  const startDate = tournament.start_time
    ? new Date(tournament.start_time)
    : null;

  const formattedDate = startDate
    ? startDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not set";

  const formattedTime = startDate
    ? startDate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "Not set";

  const joinedPlayers = 0;

  const slotsLeft = Math.max(maxPlayers - joinedPlayers, 0);

  const progress =
    maxPlayers > 0
      ? Math.min((joinedPlayers / maxPlayers) * 100, 100)
      : 0;

  const rules =
    Array.isArray(tournament.rules) && tournament.rules.length > 0
      ? tournament.rules
      : [
          "Vehicle is not allowed.",
          "Air Drop is not allowed.",
          "Double Vector is not allowed.",
          "Teaming with other players is prohibited.",
          "Cheating or unfair play may result in disqualification.",
        ];

  const openJoinPopup = () => {
    setPopup("join");
    setWalletOpen(false);
    setJoinError("");
    setJoined(false);
  };

  const closePopup = () => {
    setPopup(null);
    setWalletOpen(false);
    setJoinError("");
  };

  const handleGameNameChange = (value: string) => {
    setGameName(
      value
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .toUpperCase()
        .slice(0, 20)
    );

    setJoinError("");
  };

  const handleUidChange = (value: string) => {
    setUid(value.replace(/\D/g, "").slice(0, 15));
    setJoinError("");
  };

  const handleLevelChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 3);

    if (!digits) {
      setLevel("");
    } else {
      setLevel(String(Math.min(100, Math.max(1, Number(digits)))));
    }

    setJoinError("");
  };

  const handleJoin = () => {
    if (!gameName.trim()) {
      setJoinError("Please enter your In-Game Name.");
      return;
    }

    if (!uid) {
      setJoinError("Please enter your UID.");
      return;
    }

    if (!level || Number(level) < 1 || Number(level) > 100) {
      setJoinError("Level must be between 1 and 100.");
      return;
    }

    if (availableBalance < entryFee) {
      setJoinError("Insufficient wallet balance.");
      return;
    }

    setJoined(true);
    setJoinError("");
  };

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-24 text-gray-900">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-red-700 via-red-600 to-red-500 px-4 py-4 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl"
          >
            ←
          </button>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-100">
              GamerzAdda
            </p>

            <h1 className="text-lg font-black">
              Tournament Details
            </h1>
          </div>
        </div>
      </header>

      {/* TOURNAMENT HERO */}
      <section className="px-3 pt-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-700 via-red-600 to-orange-500 p-5 text-white shadow-xl">
          <div className="absolute -right-8 -top-8 text-8xl opacity-20">
            🔥
          </div>

          <div className="relative">
            <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase">
              {tournament.game || "Free Fire"} •{" "}
              {tournament.mode || "Solo"}
            </span>

            <h2 className="mt-4 text-2xl font-black leading-tight">
              {tournament.title}
            </h2>

            <p className="mt-1 text-xs font-semibold text-red-100">
              Play smart. Survive longer. Win bigger.
            </p>

            <div className="mt-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-red-100">
                  PRIZE POOL
                </p>

                <p className="text-2xl font-black">
                  ₹{Number(tournament.prize_pool ?? 0)}
                </p>
              </div>

              <div className="h-10 w-px bg-white/20" />

              <div>
                <p className="text-[10px] font-bold text-red-100">
                  ENTRY
                </p>

                <p className="text-2xl font-black">
                  ₹{entryFee}
                </p>
              </div>

              <div className="h-10 w-px bg-white/20" />

              <div>
                <p className="text-[10px] font-bold text-red-100">
                  PLAYERS
                </p>

                <p className="text-2xl font-black">
                  {maxPlayers}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section className="px-3 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPopup("how")}
            className="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm active:scale-[0.98]"
          >
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-xl">
              🎮
            </div>

            <p className="text-sm font-black">
              How To Play
            </p>

            <p className="mt-1 text-[10px] font-medium text-gray-400">
              Learn how to join & play
            </p>
          </button>

          <button
            onClick={() => setPopup("rules")}
            className="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm active:scale-[0.98]"
          >
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-xl">
              📜
            </div>

            <p className="text-sm font-black">
              Match Rules
            </p>

            <p className="mt-1 text-[10px] font-medium text-gray-400">
              Check all tournament rules
            </p>
          </button>
        </div>
      </section>

      {/* MATCH INFO */}
      <section className="px-3 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-black">
            Match Information
          </h3>

          <span className="rounded-full bg-green-50 px-3 py-1 text-[9px] font-black text-green-600">
            ● {String(tournament.status || "UPCOMING").toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoCard
            icon="💰"
            label="Entry Fee"
            value={`₹${entryFee}`}
          />

          <InfoCard
            icon="🏆"
            label="Prize Pool"
            value={`₹${Number(tournament.prize_pool ?? 0)}`}
          />

          <InfoCard
            icon="🎯"
            label="Kill Point"
            value={`₹${Number(tournament.kill_reward ?? 0)} / Kill`}
          />

          <InfoCard
            icon="🎁"
            label="Bonus Usable"
            value="30%"
          />

          <InfoCard
            icon="📅"
            label="Start Date"
            value={formattedDate}
          />

          <InfoCard
            icon="⏰"
            label="Start Time"
            value={formattedTime}
          />

          <InfoCard
            icon="👥"
            label="Participants"
            value={`${maxPlayers} Players`}
          />

          <InfoCard
            icon="🗺️"
            label="Map"
            value={tournament.map || "Not set"}
          />
        </div>
      </section>

      {/* PLAYERS PROGRESS */}
      <section className="px-3 pt-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black">
                Tournament Slots
              </p>

              <p className="mt-1 text-[10px] font-medium text-gray-400">
                {joinedPlayers} players joined out of {maxPlayers}
              </p>
            </div>

            <p className="text-sm font-black text-red-600">
              {Math.round(progress)}%
            </p>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-600 to-orange-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-2 flex justify-between text-[9px] font-bold text-gray-400">
            <span>
              {joinedPlayers} Joined
            </span>

            <span>
              {slotsLeft} Slots Left
            </span>
          </div>
        </div>
      </section>

      {/* RULE HIGHLIGHT */}
      <section className="px-3 pt-5">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-xl">
              ⚠️
            </div>

            <div>
              <p className="text-sm font-black text-red-700">
                Important Rules
              </p>

              <p className="text-[10px] font-medium text-red-500">
                Read before joining the match
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-xs font-bold text-gray-700">
            {rules.map((rule: string, index: number) => (
              <p key={index}>
                • {rule.replace(/^•\s*/, "")}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* PRIZE DISTRIBUTION */}
      <section className="px-3 pt-5">
        <h3 className="mb-3 text-base font-black">
          Prize Distribution
        </h3>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <PrizeRow
            rank="1st"
            prize="₹600"
            icon="🥇"
          />

          <PrizeRow
            rank="2nd"
            prize="₹350"
            icon="🥈"
          />

          <PrizeRow
            rank="3rd"
            prize="₹275"
            icon="🥉"
          />
        </div>
      </section>

      {/* BOTTOM ACTIONS */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 p-3 backdrop-blur-md">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          <button className="rounded-xl border border-gray-200 bg-white py-3 text-[10px] font-black text-gray-700 shadow-sm">
            👤
            <br />
            MY MATCHES
          </button>

          <button className="rounded-xl border border-gray-200 bg-white py-3 text-[10px] font-black text-gray-700 shadow-sm">
            👥
            <br />
            PARTICIPANTS
          </button>

          <button
            onClick={openJoinPopup}
            className="rounded-xl bg-gradient-to-r from-red-600 to-red-500 py-3 text-[10px] font-black text-white shadow-lg shadow-red-200"
          >
            🔥
            <br />
            JOIN NOW
          </button>
        </div>
      </div>

      {/* POPUP */}
      {popup && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 px-2 pb-2 backdrop-blur-sm sm:items-center sm:px-3 sm:pb-3">
          <div className="max-h-[92vh] w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[85vh]">

            <div className="flex items-center justify-between bg-gradient-to-r from-red-700 to-red-500 px-5 py-4 text-white">
              <h3 className="text-base font-black">
                {popup === "how"
                  ? "How To Play"
                  : popup === "rules"
                  ? "Match Rules"
                  : "Join Tournament"}
              </h3>

              <button
                onClick={() => setPopup(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg"
              >
                ×
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4 sm:max-h-[65vh] sm:p-5">

              {/* HOW TO PLAY */}
              {popup === "how" && (
                <div className="space-y-4">
                  <Step
                    number="1"
                    text="Join the tournament using the Join Now button."
                  />

                  <Step
                    number="2"
                    text="Wait for the room details to be provided."
                  />

                  <Step
                    number="3"
                    text="Enter the room before the match starts."
                  />

                  <Step
                    number="4"
                    text="Play according to all tournament rules."
                  />

                  <Step
                    number="5"
                    text="Results will be checked after the match."
                  />

                  <Step
                    number="6"
                    text="Winning amount will be added to your wallet."
                  />
                </div>
              )}

              {/* RULES */}
              {popup === "rules" && (
                <div className="space-y-3 text-sm font-semibold text-gray-700">
                  {rules.map((rule: string, index: number) => (
                    <Rule
                      key={index}
                      text={rule.replace(/^•\s*/, "")}
                    />
                  ))}
                </div>
              )}

              {/* JOIN TOURNAMENT */}
              {popup === "join" && (
                <div className="space-y-4">

                  {joined ? (
                    <div className="py-4 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
                        ✓
                      </div>

                      <h4 className="mt-4 text-xl font-black text-gray-900">
                        Tournament Joined! 🎉
                      </h4>

                      <p className="mt-1 text-xs font-medium text-gray-500">
                        Your entry has been confirmed successfully.
                      </p>

                      <div className="mt-5 space-y-2 rounded-2xl bg-gray-50 p-4 text-left">
                        <WalletRow
                          label="In-Game Name"
                          value={gameName}
                          strong
                        />

                        <WalletRow
                          label="UID"
                          value={uid}
                        />

                        <WalletRow
                          label="Level"
                          value={level}
                        />

                        <WalletRow
                          label="Entry Fee"
                          value={`- ₹${entryFee}`}
                        />

                        <div className="my-2 border-t border-gray-200" />

                        <WalletRow
                          label="Balance After Join"
                          value={`₹${balanceAfterJoin}`}
                          strong
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* IN-GAME NAME */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-black text-gray-700">
                            🎮 IN-GAME NAME
                          </p>

                          <span className="text-[10px] font-bold text-gray-400">
                            {gameName.length}/20
                          </span>
                        </div>

                        <input
                          type="text"
                          value={gameName}
                          maxLength={20}
                          autoComplete="off"
                          placeholder="Enter your in-game name"
                          onChange={(e) =>
                            handleGameNameChange(e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold uppercase outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />

                        <p className="mt-1 text-[10px] font-medium text-gray-400">
                          Maximum 20 characters • Automatically uppercase
                        </p>
                      </div>

                      {/* UID */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-black text-gray-700">
                            🆔 UID
                          </p>

                          <span className="text-[10px] font-bold text-gray-400">
                            {uid.length}/15
                          </span>
                        </div>

                        <input
                          type="text"
                          inputMode="numeric"
                          value={uid}
                          maxLength={15}
                          autoComplete="off"
                          placeholder="Enter Free Fire UID"
                          onChange={(e) =>
                            handleUidChange(e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />

                        <p className="mt-1 text-[10px] font-medium text-gray-400">
                          Numbers only • Maximum 15 digits
                        </p>
                      </div>

                      {/* LEVEL */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-black text-gray-700">
                            ⭐ LEVEL
                          </p>

                          <span className="text-[10px] font-bold text-gray-400">
                            1–100
                          </span>
                        </div>

                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={100}
                          value={level}
                          placeholder="Enter your level (1-100)"
                          onChange={(e) =>
                            handleLevelChange(e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />

                        <p className="mt-1 text-[10px] font-medium text-gray-400">
                          Level must be between 1 and 100
                        </p>
                      </div>

                      {/* ENTRY FEE SUMMARY */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
                          <p className="text-[9px] font-black uppercase text-red-400">
                            Entry Fee
                          </p>

                          <p className="mt-1 text-xl font-black text-red-600">
                            ₹{entryFee}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                          <p className="text-[9px] font-black uppercase text-green-500">
                            After Join
                          </p>

                          <p className="mt-1 text-xl font-black text-green-600">
                            ₹{balanceAfterJoin}
                          </p>
                        </div>
                      </div>

                      {/* COLLAPSED WALLET BREAKDOWN */}
                      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                        <button
                          type="button"
                          onClick={() =>
                            setWalletOpen((open) => !open)
                          }
                          aria-expanded={walletOpen}
                          className="flex w-full items-center justify-between px-4 py-4 text-left"
                        >
                          <div>
                            <p className="text-sm font-black text-gray-900">
                              💰 Wallet Breakdown
                            </p>

                            <p className="mt-0.5 text-[10px] font-medium text-gray-400">
                              {walletOpen
                                ? "Hide balance details"
                                : "Tap to view balance details"}
                            </p>
                          </div>

                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black text-gray-500 shadow-sm">
                            {walletOpen ? "⌃" : "⌄"}
                          </span>
                        </button>

                        {walletOpen && (
                          <div className="border-t border-gray-200 px-4 pb-4 pt-2">
                            <div className="space-y-2.5 text-xs">
                              <WalletRow
                                label="Available Balance"
                                value="₹500"
                                strong
                              />

                              <WalletRow
                                label="Winning Balance"
                                value="₹200"
                              />

                              <WalletRow
                                label="Deposit Balance"
                                value="₹250"
                              />

                              <WalletRow
                                label="Bonus Balance"
                                value="₹50"
                              />
                            </div>

                            <div className="my-3 border-t border-gray-200" />

                            <WalletRow
                              label="Tournament Entry Fee"
                              value={`- ₹${entryFee}`}
                            />

                            <div className="mt-3 rounded-xl bg-white p-3">
                              <WalletRow
                                label="Balance After Join"
                                value={`₹${balanceAfterJoin}`}
                                strong
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl bg-red-50 p-3 text-center text-[10px] font-bold text-red-600">
                        ₹{entryFee} will be deducted from your wallet after confirmation.
                      </div>

                      {joinError && (
                        <div
                          role="alert"
                          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-600"
                        >
                          ⚠️ {joinError}
                        </div>
                      )}
                    </>
                  )}

                </div>
              )}

            </div>

            <div className="border-t border-gray-100 p-4">

              {popup === "join" ? (
                joined ? (
                  <button
                    onClick={closePopup}
                    className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-500 py-3.5 text-sm font-black text-white shadow-lg shadow-green-200"
                  >
                    ✓ DONE
                  </button>
                ) : (
                  <button
                    onClick={handleJoin}
                    disabled={joined}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-lg font-black transition-all ${
                      joined
                        ? "cursor-default bg-green-600 text-white"
                        : "bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]"
                    }`}
                  >
                    {joined
                      ? "✓ JOINED SUCCESSFULLY"
                      : `🔥 CONFIRM & JOIN • ₹${entryFee}`}
                  </button>
                )
              ) : (
                <button
                  onClick={closePopup}
                  className="w-full rounded-xl bg-red-600 py-3 text-sm font-black text-white"
                >
                  GOT IT
                </button>
              )}

            </div>
          </div>
        </div>
      )}
    </main>
  );
}


/* INFO CARD */

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-lg">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
            {label}
          </p>

          <p className="mt-1 truncate text-sm font-black">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}


/* PRIZE ROW */

function PrizeRow({
  rank,
  prize,
  icon,
}: {
  rank: string;
  prize: string;
  icon: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-xl">
          {icon}
        </div>

        <p className="text-sm font-black">
          {rank} Place
        </p>
      </div>

      <p className="text-base font-black text-red-600">
        {prize}
      </p>
    </div>
  );
}


/* STEP */

function Step({
  number,
  text,
}: {
  number: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white">
        {number}
      </div>

      <p className="pt-1 text-sm font-semibold leading-5 text-gray-700">
        {text}
      </p>
    </div>
  );
}


/* RULE */

function Rule({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p>• {text}</p>
    </div>
  );
}


/* WALLET ROW */

function WalletRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={
          strong
            ? "font-black text-gray-800"
            : "font-semibold text-gray-500"
        }
      >
        {label}
      </span>

      <span
        className={
          strong
            ? "font-black text-gray-900"
            : "font-bold text-gray-700"
        }
      >
        {value}
      </span>
    </div>
  );
}