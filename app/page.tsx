"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const banners = [
  {
    title: "BOOYAH QUIZ",
    subtitle: "FREE FIRE MAX QUESTIONS",
    emoji: "❓",
  },
  {
    title: "FREE FIRE MAX",
    subtitle: "PLAY HARD • WIN BIG",
    emoji: "🔥",
  },
  {
    title: "CLASH SQUAD",
    subtitle: "ENTER THE BATTLE",
    emoji: "⚔️",
  },
];

export default function Home() {
  const [drawer, setDrawer] = useState(false);
  const [banner, setBanner] = useState(0);

  const [profile, setProfile] = useState<{
    name: string;
    bio: string;
    avatarUrl: string;
  } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = await response.json();

        if (data.profile) {
          setProfile({
            name: data.profile.name || "Player",
            bio: data.profile.bio || "",
            avatarUrl: data.profile.avatarUrl || "",
          });
        }
      } catch {
        // Profile unavailable
      }
    }

    loadProfile();
  }, []);

  return (
    <main className="min-h-screen bg-[#070b18] text-white">
      {/* TOP HEADER */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#ff174f] via-[#ed1749] to-[#ff2857] px-4 pb-5 pt-4 shadow-xl">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#641d3b]/80 text-2xl"
          >
            ☰
          </button>

          <button
            type="button"
            className="flex min-w-[130px] items-center justify-center gap-2 rounded-full bg-[#641d3b]/80 px-5 py-3 font-bold"
          >
            💰 ₹0
          </button>

          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#641d3b]/80 text-xl"
          >
            🔔
          </button>
        </div>
      </header>

      {/* APP CONTENT */}
      <div className="mx-auto max-w-md px-4 pb-28">
        <h1 className="mb-4 mt-6 text-center text-2xl font-extrabold">
          Discover upcoming matches
        </h1>

        {/* BANNER */}
        <section className="relative overflow-hidden rounded-2xl border border-white/10">
          <div className="flex h-44 items-center justify-between bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-400 p-5">
            <div>
              <p className="text-xs font-bold">
                THINK FAST. WIN BIG.
              </p>

              <h2 className="mt-1 text-4xl font-black italic">
                {banners[banner].title}
              </h2>

              <p className="mt-2 text-xs font-bold">
                {banners[banner].subtitle}
              </p>

              <button
                type="button"
                className="mt-4 rounded-xl bg-red-600 px-5 py-2 text-sm font-black shadow-lg"
              >
                PLAY NOW »
              </button>
            </div>

            <div className="text-7xl">
              {banners[banner].emoji}
            </div>
          </div>
        </section>

        {/* DOTS */}
        <div className="mt-3 flex justify-center gap-2">
          {banners.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setBanner(i)}
              className={`h-2 rounded-full transition-all ${
                banner === i
                  ? "w-7 bg-red-500"
                  : "w-2 bg-zinc-600"
              }`}
            />
          ))}
        </div>

        {/* GAME CARDS */}
        <section className="mt-5 grid grid-cols-2 gap-3">
          <GameCard
            title="FREE FIRE"
            subtitle="PLAY HARD • WIN BIG"
            emoji="🔥"
            onClick={() =>
              (window.location.href = "/freefire")
            }
          />

          <GameCard
            title="FREE FIRE MAX"
            subtitle="BATTLE ARENA"
            emoji="🎮"
            onClick={() =>
              (window.location.href = "/freefiremax")
            }
          />
        </section>

        {/* TOURNAMENTS */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">
              🔥 Live Tournaments
            </h2>

            <button
              type="button"
              className="text-sm font-bold text-red-400"
            >
              View All
            </button>
          </div>

          <Tournament
            game="FREE FIRE MAX"
            title="Booyah Battle"
            prize="₹5,000"
            entry="₹10"
            players="42/50"
          />

          <Tournament
            game="FREE FIRE MAX"
            title="Clash Squad"
            prize="₹10,000"
            entry="₹20"
            players="86/100"
          />

          <Tournament
            game="LUDO"
            title="Ludo Cash Battle"
            prize="₹1,000"
            entry="₹5"
            players="24/50"
          />
        </section>
      </div>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-32px)] max-w-md -translate-x-1/2 items-center justify-around rounded-3xl border border-white/10 bg-[#18233b]/95 px-3 py-3 shadow-2xl backdrop-blur-xl">
        <NavButton
          icon="🏆"
          text="Games"
        />

        <NavButton
          icon="🌐"
          text="Tournaments"
        />

        <Link
          href="/"
          className="flex h-14 w-14 -translate-y-5 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-pink-500 text-2xl shadow-xl shadow-red-500/30"
        >
          🏠
        </Link>

        <NavButton
          icon="🎧"
          text="Support"
        />

        <Link
          href="/profile"
          className="flex flex-col items-center gap-1 text-[10px] font-bold text-zinc-300 transition hover:text-red-400"
        >
          <span className="text-xl">👤</span>
          Profile
        </Link>
      </nav>

      {/* SIDE DRAWER */}
      {drawer && (
        <div
          className="fixed inset-0 z-[100] bg-black/60"
          onClick={() => setDrawer(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="h-full w-[82%] max-w-sm overflow-y-auto bg-[#151a32] shadow-2xl"
          >
            {/* PROFILE HEADER */}
            <div className="rounded-br-[45px] bg-gradient-to-br from-[#ff174f] to-[#ed1749] px-7 py-10 text-center">

              {/* PROFILE PICTURE */}
              <Link
                href="/profile"
                onClick={() => setDrawer(false)}
                className="block"
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="Profile"
                    className="mx-auto h-20 w-20 rounded-full border-2 border-white/60 object-cover shadow-lg"
                  />
                ) : (
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/50 bg-white/20 text-4xl">
                    👤
                  </div>
                )}
              </Link>

              {/* NAME */}
              <h2 className="mt-3 truncate text-xl font-black">
                {profile?.name || "Player"}
              </h2>

              {/* BIO */}
              <p className="mx-auto mt-1 max-w-[230px] truncate text-sm text-white/80">
                {profile?.bio || "Welcome back"}
              </p>
            </div>

            <div className="px-6 py-7">

              {/* ACCOUNT */}
              <DrawerGroup title="ACCOUNT">
                <DrawerItem
                  icon="👤"
                  text="My Profile"
                  href="/profile"
                  onClick={() => setDrawer(false)}
                />
              </DrawerGroup>

              {/* FINANCE */}
              <DrawerGroup title="FINANCE">
                <DrawerItem
                  icon="💳"
                  text="My Wallet"
                />
              </DrawerGroup>

              {/* GAMING */}
              <DrawerGroup title="GAMING">
                <DrawerItem
                  icon="🏆"
                  text="Leaderboard"
                />

                <DrawerItem
                  icon="👥"
                  text="My Referrals"
                />

                <DrawerItem
                  icon="📊"
                  text="My Stats"
                />
              </DrawerGroup>

              {/* SUPPORT & SETTINGS */}
              <DrawerGroup title="SUPPORT & SETTINGS">
                <DrawerItem
                  icon="🎧"
                  text="Help Centre"
                />

                <DrawerItem
                  icon="⚙️"
                  text="Settings"
                />

                <DrawerItem
                  icon="🛡️"
                  text="Responsible Gaming"
                />

                <DrawerItem
                  icon="🎓"
                  text="Tutorial"
                />
              </DrawerGroup>

              {/* COMMUNITY */}
              <DrawerGroup title="COMMUNITY">
                <DrawerItem
                  icon="➤"
                  text="Telegram"
                />

                <DrawerItem
                  icon="📷"
                  text="Instagram"
                />

                <DrawerItem
                  icon="💬"
                  text="WhatsApp"
                />

                <DrawerItem
                  icon="▶️"
                  text="YouTube"
                />
              </DrawerGroup>

              <p className="mt-8 text-center font-bold">
                Gamerz
                <span className="text-red-500">
                  Adda
                </span>
              </p>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

function GameCard({
  title,
  subtitle,
  emoji,
  onClick,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-44 w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-700 to-cyan-500 p-4 text-left"
    >
      <div className="relative z-10">
        <h3 className="text-xl font-black">
          {title}
        </h3>

        <p className="mt-1 text-[9px] font-bold">
          {subtitle}
        </p>

        <span className="mt-12 inline-block rounded-lg bg-red-600 px-3 py-2 text-xs font-black">
          PLAY NOW »
        </span>
      </div>

      <div className="absolute -bottom-3 -right-2 text-7xl">
        {emoji}
      </div>
    </button>
  );
}

function Tournament({
  game,
  title,
  prize,
  entry,
  players,
}: {
  game: string;
  title: string;
  prize: string;
  entry: string;
  players: string;
}) {
  return (
    <div className="mb-3 rounded-2xl border border-white/10 bg-[#11182b] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-red-400">
            {game}
          </p>

          <h3 className="mt-1 font-black">
            {title}
          </h3>
        </div>

        <button
          type="button"
          className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black"
        >
          JOIN
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 text-center">
        <div>
          <p className="text-[10px] text-zinc-500">
            PRIZE
          </p>

          <p className="font-black text-green-400">
            {prize}
          </p>
        </div>

        <div>
          <p className="text-[10px] text-zinc-500">
            ENTRY
          </p>

          <p className="font-black">
            {entry}
          </p>
        </div>

        <div>
          <p className="text-[10px] text-zinc-500">
            PLAYERS
          </p>

          <p className="font-black">
            {players}
          </p>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  icon,
  text,
}: {
  icon: string;
  text: string;
}) {
  return (
    <button
      type="button"
      className="flex flex-col items-center gap-1 text-[10px] font-bold text-zinc-300"
    >
      <span className="text-xl">
        {icon}
      </span>

      {text}
    </button>
  );
}

function DrawerGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <p className="mb-2 text-xs font-black tracking-wide text-zinc-400">
        {title}
      </p>

      <div className="divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

function DrawerItem({
  icon,
  text,
  href,
  onClick,
}: {
  icon: string;
  text: string;
  href?: string;
  onClick?: () => void;
}) {
  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className="flex w-full items-center gap-5 py-4 text-left font-bold transition hover:text-red-400 active:scale-[0.98]"
      >
        <span className="w-6 text-xl">
          {icon}
        </span>

        <span>
          {text}
        </span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-5 py-4 text-left font-bold transition hover:text-red-400"
    >
      <span className="w-6 text-xl">
        {icon}
      </span>

      <span>
        {text}
      </span>
    </button>
  );
}