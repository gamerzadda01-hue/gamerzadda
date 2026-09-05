"use client";

import { useEffect, useState } from "react";

const banners = [
  {
    title: "FREE FIRE TOURNAMENT",
    subtitle: "PLAY • COMPETE • WIN",
    emoji: "🔥",
  },
  {
    title: "BIG PRIZE POOLS",
    subtitle: "JOIN YOUR FAVOURITE MATCH",
    emoji: "🏆",
  },
  {
    title: "FAST FREE FIRE MATCHES",
    subtitle: "READY? LET'S BOOYAH!",
    emoji: "⚡",
  },
];

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
  const [activeTab, setActiveTab] = useState("ALL");
  const [banner, setBanner] = useState(0);

  // AUTO SLIDE
  useEffect(() => {
    const timer = setInterval(() => {
      setBanner((prev) => (prev + 1) % banners.length);
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#f4f4f4] pb-20 text-black">

      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#b90000] via-[#e00000] to-[#ff3030] px-4 py-3 text-white shadow-md">

        <div className="flex items-center justify-between">

          <button
            onClick={() => (window.location.href = "/")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-2xl"
          >
            ←
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

        <div className="relative h-36 overflow-hidden rounded-2xl">

          {banners.map((item, index) => (

            <div
              key={index}
              className={`absolute inset-0 transition-all duration-500 ${
                index === banner
                  ? "translate-x-0 opacity-100"
                  : index < banner
                  ? "-translate-x-full opacity-0"
                  : "translate-x-full opacity-0"
              }`}
            >

              <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#8b0000] via-[#e00000] to-[#ff4b2b] p-5 text-white">

                <div className="relative z-10">

                  <p className="text-[10px] font-bold tracking-[2px] opacity-90">
                    GAMERZADDA
                  </p>

                  <h2 className="mt-2 text-xl font-black leading-tight">
                    {item.title}
                  </h2>

                  <p className="mt-1 text-[10px] font-bold">
                    {item.subtitle}
                  </p>

                  <button className="mt-3 rounded-lg bg-white px-4 py-1.5 text-[10px] font-black text-red-600">
                    PLAY NOW →
                  </button>

                </div>

                <div className="absolute -right-2 -bottom-5 text-[100px]">
                  {item.emoji}
                </div>

              </div>

            </div>

          ))}

          {/* DOTS */}
          <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5">

            {banners.map((_, index) => (
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

        </div>

      </section>


     {/* GAME MODE SLIDER */}

<div className="bg-white px-3 py-3">

  <div className="relative flex rounded-xl bg-gray-100 p-1">

    {/* SLIDING ACTIVE BACKGROUND */}
    <div
      className={`absolute top-1 bottom-1 w-[calc(33.333%-2.67px)] rounded-lg bg-gradient-to-r from-red-600 to-red-500 shadow-md transition-all duration-300 ${
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
            onClick={() => (window.location.href = "/")}
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

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-orange-500 text-lg">
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
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-red-500"
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
        className="w-full bg-gradient-to-r from-[#b90000] to-[#ed0000] py-3 text-[13px] font-black tracking-wide text-white active:scale-[0.99]"
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