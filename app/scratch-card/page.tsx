"use client";

import React, { useEffect, useRef, useState } from "react";

type Progress = {
  gameType: string;
  completedGames: number;
  cardsEarned: number;
  gamesToNextCard: number;
};

type Card = {
  id: string;
  gameType: string;
  sequenceNo: number;
  issuedAt: string;
  expiresAt: string;
  status: "available" | "scratched" | "expired";
  reward: number | null;
  scratchedAt: string | null;
};

const GAME_META: Record<string, { name: string; icon: string }> = {
  free_fire: { name: "Free Fire", icon: "🔥" },
  free_fire_max: { name: "Free Fire MAX", icon: "⚡" },
  clash_squad: { name: "Clash Squad", icon: "⚔️" },
  lone_wolf: { name: "Lone Wolf", icon: "🐺" },
};

export default function ScratchCardPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchingRef = useRef(false);

  const [progress, setProgress] = useState<Progress[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [popup, setPopup] = useState(false);
  const [error, setError] = useState("");

  const [tab, setTab] = useState<
    "available" | "scratched" | "expired"
  >("available");

  const availableCard =
    cards.find((card) => card.status === "available") || null;

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/scratch-card", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(
          data?.error || "Unable to load Scratch Card."
        );
      }

      setProgress(
        Array.isArray(data.progress) ? data.progress : []
      );

      setCards(
        Array.isArray(data.cards) ? data.cards : []
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load Scratch Card."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  // Draw scratch layer
  useEffect(() => {
    if (!availableCard || tab !== "available" || revealed) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();

      if (!rect.width || !rect.height) return;

      const dpr = Math.max(
        1,
        window.devicePixelRatio || 1
      );

      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const gradient = ctx.createLinearGradient(
        0,
        0,
        rect.width,
        rect.height
      );

      gradient.addColorStop(0, "#cbd0d7");
      gradient.addColorStop(0.5, "#f4f5f6");
      gradient.addColorStop(1, "#c2c8d0");

      ctx.fillStyle = gradient;

      ctx.fillRect(
        0,
        0,
        rect.width,
        rect.height
      );

      ctx.globalAlpha = 0.18;

      for (
        let x = -rect.height;
        x < rect.width + rect.height;
        x += 18
      ) {
        ctx.save();
        ctx.translate(x, 0);
        ctx.rotate(-0.35);
        ctx.fillStyle = "#fff";

        ctx.fillRect(
          0,
          0,
          7,
          rect.height * 2
        );

        ctx.restore();
      }

      ctx.globalAlpha = 1;

      ctx.fillStyle = "#1f2937";
      ctx.font = "900 15px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillText(
        "SCRATCH TO REVEAL",
        rect.width / 2,
        rect.height / 2
      );
    };

    const timer = window.setTimeout(draw, 20);

    window.addEventListener("resize", draw);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", draw);
    };
  }, [availableCard?.id, tab, revealed]);

  async function claimCard() {
    if (!availableCard || claiming || revealed) return;

    setClaiming(true);
    setError("");

    try {
      const res = await fetch("/api/scratch-card", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cardId: availableCard.id,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(
          data?.error || "Unable to scratch this card."
        );
      }

      const amount = Number(data.reward || 0);

      setReward(amount);
      setRevealed(true);
      setPopup(true);

      setCards((current) =>
        current.map((card) =>
          card.id === availableCard.id
            ? {
                ...card,
                status: "scratched",
                reward: amount,
                scratchedAt:
                  new Date().toISOString(),
              }
            : card
        )
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to scratch this card."
      );
    } finally {
      setClaiming(false);
    }
  }

  const scratchAt = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    if (!availableCard || claiming || revealed) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.globalCompositeOperation = "destination-out";

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      28,
      0,
      Math.PI * 2
    );

    ctx.fill();

    scratchingRef.current = true;

    try {
      const data = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data;

      let transparent = 0;
      let samples = 0;

      for (
        let i = 3;
        i < data.length;
        i += 64
      ) {
        samples++;

        if (data[i] < 35) {
          transparent++;
        }
      }

      if (
        samples &&
        transparent / samples >= 0.5
      ) {
        claimCard();
      }
    } catch {}
  };

  const filteredCards = cards.filter(
    (card) => card.status === tab
  );

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <div className="mx-auto min-h-screen w-full max-w-md overflow-hidden bg-white shadow-[0_0_80px_rgba(15,23,42,0.08)]">

        {/* HEADER */}
        <header className="flex items-center border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={() => window.history.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-2xl"
            >
              ←
            </button>

            <div>
              <div className="text-[21px] font-black">
                GAMER
                <span className="text-red-500">
                  ZADDA
                </span>
              </div>

              <div className="-mt-0.5 text-[8px] font-bold tracking-[0.28em] text-slate-400">
                PLAY • COMPETE • EARN
              </div>
            </div>

          </div>
        </header>

        <div className="px-4 pb-32 pt-3">

          {/* HERO */}
          <section className="relative overflow-hidden rounded-[24px] border border-red-100 bg-gradient-to-br from-red-50 via-white to-orange-50 px-5 py-5">

            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-200/30 blur-3xl" />

            <div className="relative flex items-center gap-4">

              <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white text-5xl shadow-md sm:flex">
                🎁
              </div>

              <div>

                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Scratch & Win
                </p>

                <h1 className="mt-1 text-[24px] font-black leading-tight">
                  Complete 5 Games
                  <br />
                  Get{" "}
                  <span className="text-red-500">
                    1 Scratch Card
                  </span>
                </h1>

                <p className="mt-2 text-[13px] text-slate-600">
                  Win{" "}
                  <span className="font-black text-slate-900">
                    upto ₹100
                  </span>{" "}
                  in your Deposit Wallet
                </p>

              </div>

            </div>
          </section>

          {/* ERROR */}
          {error && (
            <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
              {error}

              <button
                type="button"
                onClick={loadDashboard}
                className="ml-2 underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* GAME PROGRESS */}
          <section className="mt-6">

            <div className="flex items-end justify-between">

              <h2 className="text-[21px] font-black">
                Game Progress
              </h2>

              <span className="text-[11px] font-medium text-slate-500">
                5 games = 1 card
              </span>

            </div>

            {loading ? (
              <div className="mt-3 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">
                Loading progress...
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3">

                {progress.map((item) => {

                  const meta =
                    GAME_META[item.gameType] || {
                      name: item.gameType,
                      icon: "🎮",
                    };

                  const completed = Number(
                    item.completedGames || 0
                  );

                  const done = completed >= 5;

                  return (
                    <div
                      key={item.gameType}
                      className="rounded-[19px] border border-slate-200 bg-white p-3.5 shadow-[0_5px_20px_rgba(15,23,42,0.05)]"
                    >

                      <div className="flex justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-2xl">
                          {meta.icon}
                        </div>
                      </div>

                      <p className="mt-2 text-center text-[13px] font-black">
                        {meta.name}
                      </p>

                      <p className="mt-1 text-center text-sm font-bold">
                        {completed} / 5
                      </p>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">

                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400"
                          style={{
                            width: `${Math.min(
                              100,
                              completed * 20
                            )}%`,
                          }}
                        />

                      </div>

                      <p
                        className={`mt-2 text-center text-[10px] font-black ${
                          done
                            ? "text-emerald-600"
                            : "text-slate-500"
                        }`}
                      >
                        {done
                          ? `✓ ${item.cardsEarned} CARD${
                              item.cardsEarned > 1
                                ? "S"
                                : ""
                            } EARNED`
                          : `${item.gamesToNextCard} more game${
                              item.gamesToNextCard !== 1
                                ? "s"
                                : ""
                            }`}
                      </p>

                    </div>
                  );
                })}

              </div>
            )}

          </section>

          {/* CARD TABS */}
          <section className="mt-6">

            <div className="grid grid-cols-3 rounded-2xl bg-slate-100 p-1">

              {(
                [
                  "available",
                  "scratched",
                  "expired",
                ] as const
              ).map((key) => {

                const count = cards.filter(
                  (c) => c.status === key
                ).length;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`rounded-xl py-3 text-[12px] font-black ${
                      tab === key
                        ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md"
                        : "text-slate-600"
                    }`}
                  >
                    {key === "available"
                      ? `Available (${count})`
                      : key === "scratched"
                      ? `Used (${count})`
                      : `Expired (${count})`}
                  </button>
                );

              })}

            </div>

          </section>

          {/* AVAILABLE CARD */}
          {tab === "available" && (
            <section className="mt-3">

              {loading ? (
                <div className="rounded-[24px] bg-slate-50 p-8 text-center text-sm text-slate-400">
                  Loading card...
                </div>
              ) : availableCard ? (
                <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">

                  <div className="relative overflow-hidden rounded-[19px] bg-gradient-to-br from-[#4c1d95] via-[#6d28d9] to-[#ef4444] p-4 text-white">

                    <div className="flex items-center justify-between">

                      <span className="text-[11px] font-black tracking-[0.18em]">
                        GAMERZADDA
                      </span>

                      <span className="rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold">
                        NEW
                      </span>

                    </div>

                    <div className="flex flex-col items-center py-5">

                      <div className="text-5xl">
                        🎁
                      </div>

                      <div className="mt-3 w-full rounded-xl bg-white/90 px-4 py-3 text-center text-lg font-black text-slate-900">
                        {revealed &&
                        reward !== null
                          ? `₹${reward.toFixed(2)}`
                          : "SCRATCH ME"}
                      </div>

                    </div>

                    <div className="text-center text-[12px] font-bold">
                      WIN ₹0.50 – ₹1.50
                    </div>

                  </div>

                  {!revealed && (
                    <div className="mt-3 overflow-hidden rounded-[19px] border border-slate-200">

                      <div className="relative h-32 bg-slate-100">

                        <div className="absolute inset-0 flex flex-col items-center justify-center">

                          <span className="text-3xl">
                            ✋
                          </span>

                          <p className="mt-1 text-xs font-black text-slate-700">
                            {claiming
                              ? "REVEALING..."
                              : "SCRATCH TO REVEAL"}
                          </p>

                        </div>

                        <canvas
                          ref={canvasRef}
                          className="absolute inset-0 h-full w-full touch-none"
                          onPointerDown={(e) => {
                            e.currentTarget.setPointerCapture(
                              e.pointerId
                            );

                            scratchAt(e);
                          }}
                          onPointerMove={(e) => {
                            if (e.buttons === 1) {
                              scratchAt(e);
                            }
                          }}
                        />

                      </div>

                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">

                    <div>

                      <p className="text-[15px] font-black">
                        Scratch Card #
                        {availableCard.sequenceNo}
                      </p>

                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Valid until{" "}
                        {new Date(
                          availableCard.expiresAt
                        ).toLocaleDateString(
                          "en-IN",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </p>

                    </div>

                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-600">
                      {revealed
                        ? "USED"
                        : "NEW"}
                    </span>

                  </div>

                </div>
              ) : (
                <div className="rounded-[24px] border border-slate-200 bg-white p-7 text-center shadow-sm">

                  <div className="text-5xl">
                    🎟️
                  </div>

                  <h3 className="mt-3 text-lg font-black">
                    No Scratch Card Yet
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Complete 5 valid games in any
                    one game section to unlock
                    your next card.
                  </p>

                </div>
              )}

            </section>
          )}

          {/* HISTORY */}
          {tab !== "available" && (
            <section className="mt-3 space-y-2">

              {filteredCards.length === 0 ? (
                <div className="rounded-[24px] border border-slate-200 bg-white p-7 text-center">

                  <div className="text-4xl">
                    {tab === "expired"
                      ? "⏰"
                      : "🎟️"}
                  </div>

                  <p className="mt-2 text-sm font-black">
                    No{" "}
                    {tab === "scratched"
                      ? "used"
                      : "expired"}{" "}
                    cards
                  </p>

                </div>
              ) : (
                filteredCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >

                    <div>

                      <p className="text-sm font-black">
                        {GAME_META[
                          card.gameType
                        ]?.name ||
                          card.gameType}{" "}
                        • Card #{card.sequenceNo}
                      </p>

                      <p className="mt-1 text-[11px] text-slate-500">
                        {card.status ===
                        "scratched"
                          ? `Won ₹${Number(
                              card.reward || 0
                            ).toFixed(2)}`
                          : `Expired ${new Date(
                              card.expiresAt
                            ).toLocaleDateString(
                              "en-IN"
                            )}`}
                      </p>

                    </div>

                    <span
                      className={`rounded-full px-3 py-1.5 text-[10px] font-black ${
                        card.status ===
                        "scratched"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-red-50 text-red-500"
                      }`}
                    >
                      {card.status ===
                      "scratched"
                        ? "USED"
                        : "EXPIRED"}
                    </span>

                  </div>
                ))
              )}

            </section>
          )}

          {/* HOW IT WORKS */}
          <section className="mt-6 rounded-[23px] border border-red-100 bg-gradient-to-br from-red-50 via-white to-orange-50 p-4">

            <div className="text-center">

              <h3 className="text-[18px] font-black text-slate-900">
                ❓ How It Works?
              </h3>

              <p className="mt-1 text-[10px] font-semibold text-slate-400">
                Play • Unlock • Scratch • Win
              </p>

            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">

              {/* STEP 1 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_5px_18px_rgba(15,23,42,0.05)]">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-xl">
                    🎮
                  </div>

                  <div>

                    <span className="text-[9px] font-black text-red-500">
                      STEP 01
                    </span>

                    <p className="mt-0.5 text-[13px] font-black text-slate-900">
                      Play
                    </p>

                  </div>

                </div>

                <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-500">
                  Complete 5 valid games
                </p>

              </div>

              {/* STEP 2 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_5px_18px_rgba(15,23,42,0.05)]">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl">
                    🎟️
                  </div>

                  <div>

                    <span className="text-[9px] font-black text-amber-500">
                      STEP 02
                    </span>

                    <p className="mt-0.5 text-[13px] font-black text-slate-900">
                      Unlock
                    </p>

                  </div>

                </div>

                <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-500">
                  Get your Scratch Card
                </p>

              </div>

              {/* STEP 3 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_5px_18px_rgba(15,23,42,0.05)]">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl">
                    ✋
                  </div>

                  <div>

                    <span className="text-[9px] font-black text-blue-500">
                      STEP 03
                    </span>

                    <p className="mt-0.5 text-[13px] font-black text-slate-900">
                      Scratch
                    </p>

                  </div>

                </div>

                <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-500">
                  Reveal your hidden reward
                </p>

              </div>

              {/* STEP 4 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_5px_18px_rgba(15,23,42,0.05)]">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">
                    🎁
                  </div>

                  <div>

                    <span className="text-[9px] font-black text-emerald-500">
                      STEP 04
                    </span>

                    <p className="mt-0.5 text-[13px] font-black text-slate-900">
                      Win
                    </p>

                  </div>

                </div>

                <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-500">
                  Get rewarded instantly
                </p>

              </div>

            </div>
          </section>

          {/* NOTES */}
          <section className="mt-4 rounded-[23px] border border-blue-100 bg-blue-50/70 p-4">

            <h3 className="text-[17px] font-black text-blue-700">
              ⓘ Important Notes
            </h3>

            <ul className="mt-3 space-y-2 pl-5 text-[12px] leading-5 text-slate-700">

              <li>
                Only completed and valid games
                are counted.
              </li>

              <li>
                Cancelled or disqualified
                matches are not counted.
              </li>

              <li>
                The same completed match can
                never count twice.
              </li>

              <li>
                Scratch Cards expire 7 days
                after issue.
              </li>

              <li>
                Reward is credited directly to
                Deposit Wallet.
              </li>

            </ul>

          </section>

        </div>

        {/* HOME PAGE STYLE BOTTOM NAV */}
        <nav className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-20px)] max-w-md -translate-x-1/2 rounded-[28px] border border-white/80 bg-white/90 px-2 py-2 shadow-[0_12px_40px_rgba(15,23,42,.18)] backdrop-blur-2xl">

          <div className="grid grid-cols-5">

            {/* SCRATCH */}
            <button
              type="button"
              onClick={() => {
                if (
                  window.location.pathname !==
                  "/scratch-card"
                ) {
                  window.location.href =
                    "/scratch-card";
                }
              }}
              className="relative flex flex-col items-center justify-center gap-1 py-1"
            >

              <span className="absolute inset-x-1 top-0 bottom-0 rounded-[18px] bg-red-50" />

              <span className="relative z-10 text-xl transition-all duration-200">
                🎟️
              </span>

              <span className="relative z-10 text-[9px] font-black text-[#d90429]">
                Scratch
              </span>

            </button>

            {/* SPIN */}
            <button
              type="button"
              onClick={() => {
                window.location.href = "/spin";
              }}
              className="relative flex flex-col items-center justify-center gap-1 py-1"
            >

              <span className="relative z-10 text-xl transition-all duration-200 hover:scale-110">
                🎡
              </span>

              <span className="relative z-10 text-[9px] font-black text-slate-500">
                Spin
              </span>

            </button>

            {/* HOME */}
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              className="relative flex flex-col items-center justify-center gap-1 py-1"
            >

              <span className="relative z-10 text-xl transition-all duration-200 hover:scale-110">
                🏠
              </span>

              <span className="relative z-10 text-[9px] font-black text-slate-500">
                Home
              </span>

            </button>

            {/* LEADERBOARD */}
            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "/leaderboard";
              }}
              className="relative flex flex-col items-center justify-center gap-1 py-1"
            >

              <span className="relative z-10 text-xl transition-all duration-200 hover:scale-110">
                🏆
              </span>

              <span className="relative z-10 text-[9px] font-black text-slate-500">
                Leaderboard
              </span>

            </button>

            {/* SUPPORT */}
            <button
              type="button"
              onClick={() => {
                window.location.href = "/support";
              }}
              className="relative flex flex-col items-center justify-center gap-1 py-1"
            >

              <span className="relative z-10 text-xl transition-all duration-200 hover:scale-110">
                🎧
              </span>

              <span className="relative z-10 text-[9px] font-black text-slate-500">
                Support
              </span>

            </button>

          </div>
        </nav>

        {/* SUCCESS POPUP */}
        {popup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-5 backdrop-blur-sm">

            <div className="w-full max-w-sm rounded-[30px] bg-white p-6 text-center shadow-[0_25px_80px_rgba(0,0,0,0.25)]">

              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-5xl">
                🎉
              </div>

              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Scratch Reward
              </p>

              <h3 className="mt-1 text-4xl font-black text-slate-900">
                ₹
                {Number(
                  reward || 0
                ).toFixed(2)}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Reward added to your Deposit
                Wallet.
              </p>

              <button
                type="button"
                onClick={() => setPopup(false)}
                className="mt-6 w-full rounded-2xl bg-slate-900 py-4 text-sm font-black text-white"
              >
                Continue
              </button>

            </div>

          </div>
        )}

      </div>
    </main>
  );
}