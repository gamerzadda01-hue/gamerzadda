"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const tournaments = [
  {
    title: "Venom Survival Battle 🔥",
    entry: "₹34",
    prize: "₹1225",
    kill: "₹0/Kill",
    participants: "48",
    joined: "12",
    date: "30 Jun • 05:30 PM",
    map: "Bermuda Classic",
    rules: "Vehicle + Air Drop NOT ALLOWED • Double Vector NOT ALLOWED",
  },
  {
    title: "Lele Panga Battle 💪",
    entry: "₹20",
    prize: "₹750",
    kill: "₹5/Kill",
    participants: "48",
    joined: "24",
    date: "30 Jun • 06:00 PM",
    map: "Bermuda Classic",
    rules: "Double Vector NOT ALLOWED • 30% Bonus Usable",
  },
  {
    title: "Free Fire Pro Battle ⚡",
    entry: "₹10",
    prize: "₹400",
    kill: "₹3/Kill",
    participants: "48",
    joined: "36",
    date: "30 Jun • 06:30 PM",
    map: "Bermuda Classic",
    rules: "No Vehicle • No Air Drop • Fair Play Rules",
  },
];

export default function FreeFirePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("SOLO");
  const [banner, setBanner] = useState(0);
  const [dbBanners, setDbBanners] = useState<
    { id: string; image_url: string; click_url: string | null; title: string | null }[]
  >([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isSwiping = useRef(false);

  // LOAD FREE FIRE BANNERS
  useEffect(() => {
    async function loadBanners() {
      setBannersLoading(true);
      const { data, error } = await supabase
        .from("banners")
        .select("id,image_url,click_url,title")
        .eq("is_active", true)
        .eq("game_type", "freefire")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Free Fire banners:", error);
        setDbBanners([]);
      } else {
        setDbBanners(data || []);
      }
      setBanner(0);
      setBannersLoading(false);
    }

    loadBanners();
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
      <header className="sticky top-0 z-50 bg-[#ff174f] px-4 py-3 text-white shadow-md">

        <div className="flex items-center justify-between">

          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-red-500 bg-white text-slate-700 shadow-[0_8px_25px_rgba(16,185,129,0.10)] transition active:scale-95"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 transition group-hover:bg-emerald-100">
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

          <div className="text-center">
            <h1 className="text-lg font-black tracking-wide">
              FREE FIRE
            </h1>

            <p className="text-[9px] font-bold tracking-widest">
              TOURNAMENTS
            </p>
          </div>

          <div className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-black">
            ₹0
          </div>

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
              No Free Fire banners available
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
                      alt={item.title || "Free Fire banner"}
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
        onClick={() => setActiveTab(item)}
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

          <span className="text-[9px] font-bold text-gray-500">
            {tournaments.length} Matches
          </span>

        </div>

        {tournaments.map((tournament, index) => (

          <TournamentCard
            key={index}
            tournament={tournament}
            tournamentId={index + 1}
          />

        ))}

      </section>


      {/* BOTTOM NAV */}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-[0_-3px_15px_rgba(0,0,0,0.12)]">

        <div className="mx-auto flex max-w-md">

          <BottomButton
            icon="🎮"
            label="My Matches"
            onClick={() => alert("My Matches")}
          />

          <BottomButton
            icon="⌂"
            label="Home"
            active
            onClick={() => { window.location.href = "/"; }}
          />

          <BottomButton
            icon="🎧"
            label="Help"
            onClick={() => alert("Help & Support")}
          />

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
  tournamentId,
}: {
  tournamentId: number;
  tournament: {
    title: string;
    entry: string;
    prize: string;
    kill: string;
    participants: string;
    joined: string;
    date: string;
    map: string;
    rules: string;
  };
}) {

  const percentage =
    (Number(tournament.joined) /
      Number(tournament.participants)) * 100;

  return (

    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

      {/* TITLE */}

      <div className="flex gap-2 px-3 pt-3 pb-2">

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ff174f] text-lg">
          🔥
        </div>

        <div className="min-w-0">

          <h2 className="text-[14px] font-black leading-tight">
            {tournament.title}
          </h2>

          <p className="mt-1 text-[10px] leading-[14px] text-gray-600">
            {tournament.rules}
          </p>

        </div>

      </div>


      {/* ENTRY / PRIZE / KILL */}

      <div className="grid grid-cols-3 border-y border-gray-100">

        <InfoBox
          icon="👑"
          title="Entry"
          value={tournament.entry}
        />

        <InfoBox
          icon="🏆"
          title="Prize"
          value={tournament.prize}
        />

        <InfoBox
          icon="🪙"
          title="Kill Point"
          value={tournament.kill}
        />

      </div>


      {/* PROGRESS */}

      <div className="px-3 pt-2">

        <div className="mb-1 flex justify-between">

          <span className="text-[9px] font-bold text-gray-500">
            Filling Fast
          </span>

          <span className="text-[9px] font-black">
            {tournament.joined}/{tournament.participants}
          </span>

        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">

          <div
            className="h-full rounded-full bg-[#ff174f]"
            style={{
              width: `${percentage}%`,
            }}
          />

        </div>

      </div>


      {/* DETAILS */}

      <div className="grid grid-cols-3 gap-1.5 p-3">

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


      {/* VIEW */}

      <button
        type="button"
        onClick={() => {
          window.location.href = `/freefire/tournament/${tournamentId}`;
        }}
        className="w-full bg-[#ff174f] py-3 text-[13px] font-black tracking-wide text-white active:scale-[0.99]"
      >
        VIEW →
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
    <div className="px-2 py-2.5 text-center">

      <div className="text-[9px] font-bold text-gray-500">
        {icon} {title}
      </div>

      <div className="mt-1 text-[14px] font-black text-green-600">
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
    <div className="rounded-lg bg-gray-50 px-1.5 py-2 text-center">

      <div className="text-[9px] font-bold text-gray-500">
        {icon} {title}
      </div>

      <div className="mt-1 text-[9px] font-black text-gray-700">
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