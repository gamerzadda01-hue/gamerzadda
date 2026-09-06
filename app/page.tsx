
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

const menuItems = [
  ["👤", "My Profile"],
  ["💳", "My Wallet"],
  ["🏆", "Leaderboard"],
  ["👥", "My Referrals"],
  ["📊", "My Stats"],
  ["🎧", "Help Centre"],
  ["⚙️", "Settings"],
  ["🛡️", "Responsible Gaming"],
  ["🎓", "Tutorial"],
];

export default function Home() {
  const [drawer, setDrawer] = useState(false);
  const [banner, setBanner] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    avatarUrl: "",
  });
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const result = await response.json();

        if (mounted && response.ok && result?.profile) {
          setProfile({
            name: result.profile.name || "",
            bio: result.profile.bio || "",
            avatarUrl: result.profile.avatarUrl || "",
          });
        }
      } catch (error) {
        console.error("Profile load error:", error);
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    if (loggingOut) return;
    if (!window.confirm("Are you sure you want to logout?")) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    try { localStorage.removeItem("gamerzadda_device_id"); } catch {}
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-[#070b18] text-white">
      {/* TOP HEADER */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#ff174f] via-[#ed1749] to-[#ff2857] px-4 pb-5 pt-4 shadow-xl">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button
            onClick={() => setDrawer(true)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#641d3b]/80 text-2xl"
          >
            ☰
          </button>

          <button className="flex min-w-[130px] items-center justify-center gap-2 rounded-full bg-[#641d3b]/80 px-5 py-3 font-bold">
            💰 ₹0
          </button>

          <button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#641d3b]/80 text-xl">
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
              <p className="text-xs font-bold">THINK FAST. WIN BIG.</p>
              <h2 className="mt-1 text-4xl font-black italic">
                {banners[banner].title}
              </h2>
              <p className="mt-2 text-xs font-bold">
                {banners[banner].subtitle}
              </p>
              <button className="mt-4 rounded-xl bg-red-600 px-5 py-2 text-sm font-black shadow-lg">
                PLAY NOW »
              </button>
            </div>

            <div className="text-7xl">{banners[banner].emoji}</div>
          </div>
        </section>

        {/* DOTS */}
        <div className="mt-3 flex justify-center gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setBanner(i)}
              className={`h-2 rounded-full transition-all ${
                banner === i ? "w-7 bg-red-500" : "w-2 bg-zinc-600"
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
          />
          <GameCard
            title="FREE FIRE MAX"
            subtitle="BATTLE ARENA"
            emoji="🎮"
          />
        </section>

        <section className="mt-3">
          <div className="flex h-44 items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-pink-600 via-red-500 to-orange-400 p-5">
            <div>
              <p className="text-4xl font-black italic">CLASH</p>
              <p className="text-4xl font-black text-yellow-300 italic">
                SQUAD
              </p>
              <button className="mt-3 rounded-xl bg-red-700 px-5 py-2 text-sm font-black">
                PLAY NOW »
              </button>
            </div>
            <div className="text-7xl">⚔️</div>
          </div>
        </section>

        {/* TOURNAMENTS */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-extrabold">🔥 Live Tournaments</h2>
            <button className="text-sm font-bold text-red-400">
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
        <NavButton icon="🏆" text="Games" />
        <NavButton icon="🌐" text="Tournaments" />
        <button className="flex h-14 w-14 -translate-y-5 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-pink-500 text-2xl shadow-xl shadow-red-500/30">
          🏠
        </button>
        <NavButton icon="🎧" text="Support" />
        <NavButton icon="👤" text="Profile" />
      </nav>

      {/* SIDE DRAWER */}
      {drawer && (
        <div
          className="fixed inset-0 z-[100] bg-black/60"
          onClick={() => setDrawer(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="h-full w-[min(88vw,360px)] max-w-[360px] overflow-y-auto bg-white text-slate-900 shadow-[12px_0_40px_rgba(15,23,42,0.22)] sm:w-[360px]"
          >
            {/* PROFILE HEADER */}
            <div className="relative overflow-hidden rounded-br-[42px] bg-gradient-to-br from-[#ff174f] via-[#f21b4f] to-[#ff5b72] px-6 pb-8 pt-9 text-center text-white shadow-lg">
              <div className="mx-auto h-[72px] w-[72px] overflow-hidden rounded-full border-[3px] border-white bg-white/20 shadow-xl ring-4 ring-white/10">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl">
                    👤
                  </div>
                )}
              </div>

              <h2 className="mt-3 text-lg font-black tracking-tight">
                {profile.name || "Player"}
              </h2>
              <p className="mx-auto mt-1 max-w-[250px] truncate text-[13px] font-medium text-white/90">
                {profile.bio || "Welcome back"}
              </p>
            </div>

            <div className="bg-white px-5 py-6">
              <DrawerGroup title="ACCOUNT">
                <DrawerItem icon="👤" text="My Profile" onClick={() => router.push("/profile")} />
              </DrawerGroup>

              <DrawerGroup title="FINANCE">
                <DrawerItem icon="💳" text="My Wallet" onClick={() => router.push("/wallet")} />
              </DrawerGroup>

              <DrawerGroup title="GAMING">
                <DrawerItem icon="🏆" text="Leaderboard" />
                <DrawerItem icon="📊" text="My Stats" />
              </DrawerGroup>

              <DrawerGroup title="SUPPORT & SETTINGS">
                <DrawerItem icon="⚙️" text="Settings" onClick={() => router.push("/settings")} />
                <DrawerItem icon="🛡️" text="Responsible Gaming" />
                <DrawerItem icon="🎓" text="Tutorial" />
              </DrawerGroup>

              <DrawerGroup title="COMMUNITY">
                <DrawerItem icon="➤" text="Telegram" />
                <DrawerItem icon="📷" text="Instagram" />
                <DrawerItem icon="💬" text="WhatsApp" />
                <DrawerItem icon="▶️" text="YouTube" />
              </DrawerGroup>

              <p className="mt-8 rounded-xl bg-emerald-50 py-3 text-center font-bold text-emerald-700">
                Gamerz<span className="text-red-500">Adda</span>
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
}: {
  title: string;
  subtitle: string;
  emoji: string;
}) {
  return (
    <button className="relative h-44 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-700 to-cyan-500 p-4 text-left">
      <div className="relative z-10">
        <h3 className="text-xl font-black">{title}</h3>
        <p className="mt-1 text-[9px] font-bold">{subtitle}</p>
        <span className="mt-12 inline-block rounded-lg bg-red-600 px-3 py-2 text-xs font-black">
          PLAY NOW »
        </span>
      </div>
      <div className="absolute -bottom-3 -right-2 text-7xl">{emoji}</div>
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
          <p className="text-[10px] font-bold text-red-400">{game}</p>
          <h3 className="mt-1 font-black">{title}</h3>
        </div>
        <button className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black">
          JOIN
        </button>
      </div>

      <div className="mt-4 grid grid-cols-3 text-center">
        <div>
          <p className="text-[10px] text-zinc-500">PRIZE</p>
          <p className="font-black text-green-400">{prize}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500">ENTRY</p>
          <p className="font-black">{entry}</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500">PLAYERS</p>
          <p className="font-black">{players}</p>
        </div>
      </div>
    </div>
  );
}

function NavButton({ icon, text }: { icon: string; text: string }) {
  return (
    <button className="flex flex-col items-center gap-1 text-[10px] font-bold text-zinc-300">
      <span className="text-xl">{icon}</span>
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
    <div className="mb-6">
      <p className="mb-2 px-1 text-[10px] font-black tracking-[0.16em] text-emerald-600">
        {title}
      </p>
      <div className="space-y-1 rounded-2xl border border-emerald-100/80 bg-slate-50/60 p-1">{children}</div>
    </div>
  );
}

function DrawerItem({ icon, text, onClick }: { icon: string; text: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="group flex min-h-[50px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition-all hover:bg-emerald-50 hover:text-red-500 active:scale-[0.98]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm ring-1 ring-emerald-100 transition group-hover:bg-red-50 group-hover:ring-red-100">{icon}</span>
      <span>{text}</span>
    </button>
  );
}