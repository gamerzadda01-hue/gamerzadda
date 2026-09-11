"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const WHEEL = ["₹0", "₹2", "₹5", "₹10", "₹20", "₹50", "₹100"];

const SPIN_FEE = 10;
const ALLOWED_WHEEL_INDEXES = [0, 1, 2] as const;

function MoneyIcon({ small = false }: { small?: boolean }) {
  return (
    <svg
      viewBox="0 0 72 72"
      className={small ? "h-6 w-6" : "h-11 w-11"}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cashBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bbf7d0" />
          <stop offset="0.35" stopColor="#4ade80" />
          <stop offset="0.72" stopColor="#16a34a" />
          <stop offset="1" stopColor="#166534" />
        </linearGradient>
        <linearGradient id="cashEdge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dcfce7" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
        <filter id="cashShadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#052e16" floodOpacity=".42" />
        </filter>
      </defs>

      <g filter="url(#cashShadow)" transform="rotate(-7 36 36)">
        <rect x="13" y="27" width="46" height="25" rx="5" fill="#166534" opacity=".9" />
        <rect x="11" y="23" width="46" height="25" rx="5" fill="url(#cashEdge)" stroke="#14532d" strokeWidth="2" />
        <rect x="14" y="20" width="46" height="25" rx="5" fill="url(#cashBody)" stroke="#14532d" strokeWidth="2" />
        <rect x="18" y="24" width="38" height="17" rx="3" fill="#22c55e" opacity=".34" stroke="#dcfce7" strokeWidth="1.2" />
        <circle cx="37" cy="32.5" r="7" fill="#bbf7d0" stroke="#166534" strokeWidth="2" />
        <path d="M37 27.5v10M40.5 29.5c-1.2-1.7-6.2-1.7-6.2 1.1 0 2.8 6.2 1.7 6.2 4.4 0 2.7-5.1 3-6.4 1" fill="none" stroke="#166534" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M20 27h6M48 38h6" stroke="#dcfce7" strokeWidth="2" strokeLinecap="round" opacity=".9" />
        <path d="M15 22h35" stroke="#f0fdf4" strokeWidth="2" strokeLinecap="round" opacity=".8" />
      </g>
    </svg>
  );
}

export default function SpinPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [draggingNav, setDraggingNav] = useState(false);
  const [dragIndex, setDragIndex] = useState(1);
  const [dragPosition, setDragPosition] = useState(1);
  const [navStartX, setNavStartX] = useState<number | null>(null);

  const navItems = [
    { key: "Scratch", path: "/scratch-card" },
    { key: "Spin", path: "/spin" },
    { key: "Home", path: "/" },
    { key: "Leaderboard", path: "/leaderboard" },
    { key: "Support", path: "/support" },
  ];

  const activeNav =
    pathname === "/scratch-card"
      ? "Scratch"
      : pathname === "/spin"
        ? "Spin"
        : pathname === "/leaderboard"
          ? "Leaderboard"
          : pathname === "/support"
            ? "Support"
            : "Home";

  const activeNavIndex = Math.max(
    0,
    navItems.findIndex((item) => item.key === activeNav)
  );

  async function spin() {
    if (spinning) return;

    const wheel = wheelRef.current;
    if (!wheel) return;

    // Cancel any stale frame before starting a new spin.
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setSpinning(true);
    setMessage("");
    setResult(null);

    const slice = 360 / WHEEL.length;
    const startRotation = rotation;
    let currentAngle = startRotation;
    let apiDone = false;
    let apiReward: 0 | 2 | 5 = 0;
    let apiWheelIndex = 0;
    let apiFailed = false;
    let finalStarted = false;
    let finalStart = 0;
    let finalFrom = startRotation;
    let finalTo = startRotation;

    const applyAngle = (angle: number) => {
      currentAngle = angle;
      wheel.style.transform = `rotate(${angle}deg)`;
    };

    // Start immediately so there is never a delay caused by the API.
    applyAngle(startRotation);

    const finish = (reward: 0 | 2 | 5) => {
      applyAngle(finalTo);
      setRotation(finalTo);
      setResult(reward);
      setShowResultPopup(true);
      setMessage(
        reward > 0
          ? `Congratulations! You won ₹${reward}.`
          : "Better luck next time!"
      );
      animationFrameRef.current = null;
      setSpinning(false);
    };

    const stopWithError = (text: string) => {
      animationFrameRef.current = null;
      setSpinning(false);
      setMessage(text);
    };

    const animate = (now: number) => {
      const elapsed = now - spinStart;

      // Keep spinning FAST until the API returns the authoritative result.
      if (!apiDone) {
        const FAST_SPEED = 0.52; // deg/ms
        applyAngle(startRotation + elapsed * FAST_SPEED);
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      if (apiFailed) {
        stopWithError("Unable to spin right now. Please try again.");
        return;
      }

      // API result is now known. Stop ONLY on the exact wheel section
      // returned by the API (wheelIndex), not by guessing from the reward.
      if (!finalStarted) {
        finalStarted = true;
        finalStart = now;
        finalFrom = currentAngle;

        const targetIndex = Math.max(
          0,
          Math.min(WHEEL.length - 1, apiWheelIndex)
        );

        const slice = 360 / WHEEL.length;
        const targetCenter = targetIndex * slice + slice / 2;

        // Pointer is fixed at 12 o'clock. In CSS conic-gradient space this is 0deg.
        const targetRotation = -targetCenter;

        const normalizedCurrent =
          ((finalFrom % 360) + 360) % 360;
        const normalizedTarget =
          ((targetRotation % 360) + 360) % 360;

        // Clockwise distance from current wheel position to API section.
        const delta =
          (normalizedTarget - normalizedCurrent + 360) % 360;

        // Continue several full clockwise turns, then enter the API section.
        finalTo = finalFrom + 360 * 5 + delta;
      }

      // Gradual braking: fast -> medium -> slow -> very slow -> stop.
      const DECEL_DURATION = 6800;
      const progress = Math.min(
        1,
        (now - finalStart) / DECEL_DURATION
      );

      const eased = 1 - Math.pow(1 - progress, 5);

      applyAngle(
        finalFrom +
          (finalTo - finalFrom) * eased
      );

      if (progress >= 1) {
        // Final position is exactly the API-selected section.
        applyAngle(finalTo);
        finish(apiReward);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // One shared animation clock.
    const spinStart = performance.now();
    animationFrameRef.current = requestAnimationFrame(animate);

    // Server decides the reward independently of the visual animation.
    try {
      const response = await fetch("/api/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({}),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        apiFailed = true;
        apiDone = true;
        setMessage(data?.message || data?.error || "Unable to spin right now.");
        return;
      }

      const rawReward =
        data?.reward ??
        data?.result?.reward ??
        data?.data?.reward ??
        0;

      const reward = Number(String(rawReward).replace(/[₹,\s]/g, ""));

      if (reward === 2) {
        apiReward = 2;
      } else if (reward === 5) {
        apiReward = 5;
      } else if (reward === 0) {
        apiReward = 0;
      } else {
        console.error("Unexpected spin reward:", rawReward, data);
        apiFailed = true;
        apiDone = true;
        setMessage("Invalid spin reward received. Please try again.");
        return;
      }

      // Prefer the authoritative wheel index from the API.
      // Fallback keeps compatibility with older API responses.
      const serverIndex = Number(data?.wheelIndex);
      apiWheelIndex = Number.isInteger(serverIndex)
        ? serverIndex
        : apiReward === 0
          ? 0
          : apiReward === 2
            ? 1
            : 2;

      apiDone = true;
    } catch (error) {
      console.error("Spin:", error);
      apiFailed = true;
      apiDone = true;
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-white pb-28 text-slate-900">
      <div className="pointer-events-none fixed inset-0 opacity-25">
        <div className="absolute left-1/2 top-[-180px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-red-500/8 blur-[110px]" />
        <div className="absolute bottom-[-160px] left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-emerald-500/6 blur-[100px]" />
      </div>

      <button
        type="button"
        onClick={() => router.push("/")}
        aria-label="Go to homepage"
        className="fixed left-4 top-4 z-[100] flex h-11 w-11 items-center justify-center rounded-2xl border border-white/40 bg-white text-slate-900 shadow-[0_8px_30px_rgba(0,0,0,.35)] active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <header className="relative border-b border-red-100 bg-gradient-to-r from-white via-white to-red-50/80 px-4 pb-1.5 pt-1.5 shadow-[0_5px_16px_rgba(217,4,41,.08)]">
        <div className="mx-auto max-w-2xl pl-12 text-center sm:pl-0">
                    <div className="mt-0.5 flex items-center justify-center gap-1.5">
            <span className="text-xs">♛</span>
            <h1 className="text-xl font-black italic tracking-tight sm:text-2xl">DAILY <span className="text-[#d90429]">SPIN</span></h1>
            <span className="text-xs">♛</span>
          </div>
          <p className="mt-0.5 text-[6px] font-bold uppercase tracking-[0.16em] text-slate-400">Spin today • Win rewards</p>
        </div>
      </header>

      <section className="relative mx-auto max-w-2xl px-3 pt-7 sm:px-5">
        <div className="relative overflow-hidden rounded-[34px] border border-slate-200 bg-white p-3 shadow-[0_18px_55px_rgba(15,23,42,.09)] backdrop-blur-2xl sm:p-5">
          <div className="absolute left-1/2 top-0 h-32 w-72 -translate-x-1/2 rounded-full bg-red-500/6 blur-3xl" />

          <div className="relative mx-auto aspect-square w-full max-w-[320px] sm:max-w-[350px]">
            {/* Neon aura */}
            <div className="absolute inset-[-15px] rounded-full bg-[radial-gradient(circle,rgba(255,23,79,.22)_0%,rgba(0,255,128,.12)_42%,transparent_72%)] blur-2xl" />
            <div className="absolute inset-[-8px] rounded-full border border-red-400/30 shadow-[0_0_18px_rgba(255,23,79,.65),0_0_55px_rgba(0,255,128,.28)]" />
            <div className="absolute inset-[-5px] rounded-full border-2 border-white/20 shadow-[inset_0_0_18px_rgba(255,255,255,.25),0_0_25px_rgba(255,23,79,.45)]" />

            {/* Premium pointer */}
            <div className="absolute left-1/2 top-[-14px] z-40 -translate-x-1/2">
              <div className="relative flex h-[58px] w-[48px] items-start justify-center drop-shadow-[0_8px_14px_rgba(0,0,0,.65)]">
                <div className="absolute top-0 h-0 w-0 border-l-[24px] border-r-[24px] border-t-[42px] border-l-transparent border-r-transparent border-t-white" />
                <div className="absolute top-[5px] h-0 w-0 border-l-[18px] border-r-[18px] border-t-[32px] border-l-transparent border-r-transparent border-t-red-500" />
                <div className="absolute top-[10px] h-0 w-0 border-l-[10px] border-r-[10px] border-t-[19px] border-l-transparent border-r-transparent border-t-red-200" />
                <div className="absolute left-1/2 top-[-7px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-red-500 shadow-[0_0_15px_rgba(255,23,79,1)]" />
              </div>
            </div>

            {/* Wheel */}
            <div
              ref={wheelRef}
              className="relative h-full w-full rounded-full border-[11px] border-white/90 p-[8px] shadow-[inset_0_0_0_2px_rgba(255,255,255,.95),inset_0_-25px_45px_rgba(15,23,42,.25),0_25px_55px_rgba(0,0,0,.62),0_0_30px_rgba(255,23,79,.52),0_0_75px_rgba(0,255,128,.18)]"
              style={{
                willChange: "transform",
                background:
                  "linear-gradient(145deg,#ffffff,#d9dee7 45%,#ffffff 70%,#aeb7c4)",
              }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-white/80 bg-white shadow-[inset_0_0_55px_rgba(255,255,255,.95),inset_0_-18px_30px_rgba(15,23,42,.18)]">
                {/* 7 premium segments */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "conic-gradient(from 0deg, rgba(255,23,79,.62) 0deg 51.428deg, rgba(255,255,255,.96) 51.428deg 102.856deg, rgba(0,255,128,.48) 102.856deg 154.284deg, rgba(255,255,255,.96) 154.284deg 205.712deg, rgba(255,23,79,.58) 205.712deg 257.14deg, rgba(255,255,255,.96) 257.14deg 308.568deg, rgba(0,255,128,.48) 308.568deg 360deg)",
                  }}
                />

                {/* Glass highlight */}
                <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,.95),rgba(255,255,255,.18)_30%,transparent_55%)]" />
                <div className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-white/90" />
                <div className="pointer-events-none absolute inset-[4%] rounded-full border border-slate-300/70 shadow-[0_0_20px_rgba(255,23,79,.28),inset_0_0_20px_rgba(0,255,128,.16)]" />

                {/* Segment dividers */}
                {WHEEL.map((_, i) => {
                  const slice = 360 / WHEEL.length;
                  return (
                    <div
                      key={`divider-${i}`}
                      className="absolute left-1/2 top-1/2 z-[2] h-1/2 w-[2px] origin-bottom bg-white/80 shadow-[0_0_5px_rgba(255,255,255,.8)]"
                      style={{ transform: `rotate(${i * slice}deg)` }}
                    />
                  );
                })}

                {/* Rewards */}
                {WHEEL.map((label, i) => {
                  const slice = 360 / WHEEL.length;
                  const angle = i * slice + slice / 2;
                  return (
                    <div
                      key={`${label}-${i}`}
                      className="absolute left-1/2 top-1/2 z-[5] flex w-[70px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center sm:w-[82px]"
                      style={{
                        transform: `rotate(${angle}deg) translateY(clamp(-86px, -24vw, -112px)) rotate(${-angle}deg)`,
                      }}
                    >
                      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl border border-white/90 bg-white/80 shadow-[0_7px_18px_rgba(15,23,42,.24),0_0_18px_rgba(0,255,128,.22)] backdrop-blur-md sm:h-13 sm:w-13">
                        <MoneyIcon />
                      </div>
                      <span className="text-[10px] font-black tracking-tight text-slate-950 drop-shadow-[0_1px_0_white] sm:text-[16px]">
                        {label}
                      </span>
                    </div>
                  );
                })}

                {/* Smaller premium center hub */}
                <div className="absolute left-1/2 top-1/2 z-20 flex h-[48px] w-[48px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-gradient-to-br from-[#ff496b] via-[#d90429] to-[#07833f] shadow-[inset_0_2px_6px_rgba(255,255,255,.65),0_5px_16px_rgba(0,0,0,.28),0_0_18px_rgba(255,23,79,.7),0_0_26px_rgba(0,255,128,.35)] sm:h-[54px] sm:w-[54px]">
                  <div className="h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,.95)]" />
                </div>
              </div>
            </div>

            {/* Bottom pedestal shadow */}
            <div className="absolute -bottom-5 left-1/2 h-7 w-[72%] -translate-x-1/2 rounded-full bg-red-500/25 blur-xl" />
          </div>

          <div className="mt-7 flex flex-col items-center">
            <div className="mb-2 text-xs font-bold text-slate-500">
              Use Bonus Money Only
            </div>
            <button
              type="button"
              onClick={spin}
              disabled={spinning}
              className="relative z-10 w-[210px] overflow-hidden rounded-xl border border-red-300/40 bg-gradient-to-r from-[#ff174f] via-[#d90429] to-[#97001d] px-5 py-3 text-sm font-black tracking-wide text-white shadow-[0_9px_28px_rgba(217,4,41,.36),0_0_18px_rgba(255,23,79,.18)] transition hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              {spinning ? "SPINNING..." : "SPIN ₹10 →"}
            </button>
          </div>

          {message && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white p-4 text-center text-slate-900 shadow-xl">
              <p className="text-sm font-black">{message}</p>
              {result !== null && result > 0 && (
                <p className="mt-1 text-xs font-bold text-emerald-600">
                  🎉 ₹{result} added to your winning wallet.
                </p>
              )}
              {result === 0 && (
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Better luck next time!
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* WIN / LOSE RESULT POPUP */}
      {showResultPopup && result !== null && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/45 px-5 backdrop-blur-sm"
          onClick={() => setShowResultPopup(false)}
        >
          <div
            className="w-full max-w-[330px] overflow-hidden rounded-[30px] border border-white/80 bg-white p-6 text-center shadow-[0_25px_80px_rgba(15,23,42,.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-4xl shadow-lg ${
                result > 0
                  ? "bg-emerald-50"
                  : "bg-red-50"
              }`}
            >
              {result > 0 ? "🎉" : "😔"}
            </div>

            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              Daily Spin Result
            </p>

            {result > 0 ? (
              <>
                <h2 className="mt-1 text-3xl font-black text-emerald-600">
                  ₹{result} Won!
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Amount has been added to your Winning Wallet.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-2xl font-black text-red-500">
                  Better Luck Next Time!
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-500">
                  You didn't win a reward this time.
                </p>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowResultPopup(false)}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-[#ff174f] to-[#d90429] px-5 py-3 text-sm font-black text-white shadow-[0_10px_25px_rgba(217,4,41,.25)] active:scale-[.98]"
            >
              {result > 0 ? "Awesome!" : "Try Again Later"}
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM NAV — ULTRA SMOOTH DRAG SLIDER */}
      <nav className="fixed bottom-3 left-1/2 z-40 w-[calc(100%-20px)] max-w-md -translate-x-1/2 rounded-[28px] border border-white/80 bg-white/80 px-2 py-2 shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-2xl backdrop-saturate-150">
        <div
          className="relative grid grid-cols-5 items-center gap-1 touch-pan-y select-none"
          onTouchStart={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const slot = rect.width / 5;
            const position = Math.max(0, Math.min(4, x / slot - 0.5));

            setDraggingNav(true);
            setNavStartX(e.touches[0].clientX);
            setDragPosition(position);
            setDragIndex(Math.round(position));
          }}
          onTouchMove={(e) => {
            if (navStartX === null) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const slot = rect.width / 5;
            const position = Math.max(0, Math.min(4, x / slot - 0.5));

            setDragPosition(position);
            setDragIndex(Math.round(position));
          }}
          onTouchEnd={() => {
            const next = navItems[dragIndex];
            setDraggingNav(false);
            setNavStartX(null);
            setDragPosition(dragIndex);

            if (next) router.push(next.path);
          }}
          onMouseDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const slot = rect.width / 5;
            const position = Math.max(0, Math.min(4, x / slot - 0.5));

            setDraggingNav(true);
            setNavStartX(e.clientX);
            setDragPosition(position);
            setDragIndex(Math.round(position));
          }}
          onMouseMove={(e) => {
            if (!draggingNav || navStartX === null) return;

            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const slot = rect.width / 5;
            const position = Math.max(0, Math.min(4, x / slot - 0.5));

            setDragPosition(position);
            setDragIndex(Math.round(position));
          }}
          onMouseUp={() => {
            if (!draggingNav) return;

            const next = navItems[dragIndex];
            setDraggingNav(false);
            setNavStartX(null);
            setDragPosition(dragIndex);

            if (next) router.push(next.path);
          }}
          onMouseLeave={() => {
            if (!draggingNav) return;

            setDraggingNav(false);
            setNavStartX(null);
            setDragPosition(activeNavIndex);
            setDragIndex(activeNavIndex);
          }}
        >
          {/* SMOOTH SLIDING PILL */}
          <span
            className={`pointer-events-none absolute bottom-1 top-1 w-[calc(20%_-_4px)] rounded-[16px] flex items-center justify-center bg-gradient-to-b from-red-50 via-pink-50 to-white shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_5px_16px_rgba(255,23,79,0.12)] ${
              draggingNav
                ? "scale-[1.03] transition-transform duration-75"
                : "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            }`}
            style={{
              transform: `translate3d(calc(${dragPosition * 100}% + ${dragPosition * 4}px), 0, 0)`,
              willChange: "transform",
            }}
          />

          <PremiumNavButton icon="scratch" text="Scratch" active={dragIndex === 0} />
          <PremiumNavButton icon="spin" text="Spin" active={dragIndex === 1} />
          <PremiumNavButton icon="home" text="Home" active={dragIndex === 2} />
          <PremiumNavButton icon="leaderboard" text="Leaderboard" active={dragIndex === 3} />
          <PremiumNavButton icon="support" text="Support" active={dragIndex === 4} />
        </div>
      </nav>
    </main>
  );

function NavIcon({ type, active }: { type: "scratch" | "spin" | "home" | "leaderboard" | "support"; active: boolean }) {
  const emoji = {
    scratch: "🎟️",
    home: "🏠",
    spin: "🎡",
    leaderboard: "🏆",
    support: "🎧",
  }[type]

  return (
    <span
      className={`text-[25px] leading-none select-none transition-transform duration-200 ${
        active ? "scale-110" : "scale-100"
      }`}
      role="img"
      aria-label={type}
    >
      {emoji}
    </span>
  )
}

function PremiumNavButton({
  icon,
  text,
  active,
}: {
  icon: "scratch" | "spin" | "home" | "leaderboard" | "support";
  text: string;
  active: boolean;
  iconClass?: string;
}) {
  return (
    <div
      className={`relative z-10 flex h-full w-full flex-col items-center justify-center gap-0.5 select-none ${
        active ? "font-semibold" : "font-medium"
      }`}
    >
      <div
        className={`flex h-8 w-9 items-center justify-center rounded-xl ${
          icon === "home" && active
            ? "bg-gradient-to-br from-[#ff174f] to-[#18a957] shadow-[0_4px_12px_rgba(255,23,79,0.22)]"
            : ""
        }`}
      >
        <NavIcon type={icon} active={active} />
      </div>
      <span
        className={`text-[10px] leading-none ${
          active
            ? icon === "spin" || icon === "support"
              ? "text-[#18a957]"
              : "text-[#ff174f]"
            : "text-slate-500"
        }`}
      >
        {text}
      </span>
    </div>
  );
}
}
