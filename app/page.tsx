
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";

const banners = [
  {
    title: "BOOYAH QUIZ",
    subtitle: "FREE FIRE MAX QUESTIONS",
    emoji: "❓",
    gradient: "from-red-600 via-red-500 to-orange-400",
  },
  {
    title: "FREE FIRE MAX",
    subtitle: "PLAY HARD • WIN BIG",
    emoji: "🔥",
    gradient: "from-emerald-700 via-emerald-500 to-green-400",
  },
  {
    title: "CLASH SQUAD",
    subtitle: "ENTER THE BATTLE",
    emoji: "⚔️",
    gradient: "from-red-700 via-red-500 to-rose-400",
  },
  {
    title: "WIN REAL CASH",
    subtitle: "JOIN TOURNAMENTS & PLAY",
    emoji: "💰",
    gradient: "from-green-700 via-emerald-500 to-lime-400",
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
  const pathname = usePathname();

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

  const navItems = [
    { key: "Scratch", path: "/scratch-card" },
    { key: "Spin", path: "/spin" },
    { key: "Home", path: "/" },
    { key: "Leaderboard", path: "/leaderboard" },
    { key: "Support", path: "/support" },
  ];

  const activeNavIndex = Math.max(
    0,
    navItems.findIndex((item) => item.key === activeNav)
  );
  const [draggingNav, setDraggingNav] = useState(false);
  const [dragIndex, setDragIndex] = useState(activeNavIndex);
  const [dragPosition, setDragPosition] = useState(activeNavIndex);
  const [navStartX, setNavStartX] = useState<number | null>(null);

  useEffect(() => {
    if (!draggingNav) {
      setDragIndex(activeNavIndex);
      setDragPosition(activeNavIndex);
    }
  }, [activeNavIndex, draggingNav]);
  const [banner, setBanner] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    avatarUrl: "",
  });
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const router = useRouter();

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null) return;

    const endX = e.changedTouches[0].clientX;
    const distance = endX - touchStartX;

    // Swipe from the right edge toward the left to open the menu.
    if (!drawer && touchStartX > window.innerWidth - 40 && distance < -70) {
      setDrawer(true);
    }

    // Swipe right while the drawer is open to close it.
    if (drawer && distance > 70) {
      setDrawer(false);
    }

    setTouchStartX(null);
  }

  // Automatic banner slider. Manual dots below still work.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setBanner((current) => (current + 1) % banners.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, []);

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
    <main
      className="min-h-screen bg-white pb-24 text-slate-900"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* HEADER + BANNER — one red curved scrolling section */}
      <div className="relative z-50">
        <div className="rounded-b-[34px] bg-gradient-to-r from-[#ff174f] via-[#ed1749] to-[#ff2857] px-4 pb-5 pt-4 shadow-xl">
          <div className="mx-auto max-w-md">
            {/* HEADER BUTTONS — scroll together with the red header */}
            <header className="flex items-center justify-between">
              {/* MENU */}
              <button
                onClick={() => setDrawer(true)}
                aria-label="Open menu"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#641d3b]/80 text-2xl transition active:scale-90"
              >
                ☰
              </button>

              {/* WALLET */}
              <button
                onClick={() => router.push("/wallet")}
                className="flex min-w-[130px] items-center justify-center gap-2 rounded-full bg-[#641d3b]/80 px-5 py-3 font-bold transition active:scale-95"
              >
                💰 ₹0
              </button>

              {/* NOTIFICATION */}
              <button
                aria-label="Notifications"
                className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[#641d3b]/80 text-xl transition active:scale-90"
              >
                🔔
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-yellow-300" />
              </button>
            </header>

            {/* BANNER INSIDE RED CURVE */}
            <section className="mt-3 overflow-hidden rounded-[26px] border border-white/30 bg-white/10 p-1.5 shadow-[0_12px_30px_rgba(100,29,59,0.28)] backdrop-blur-sm">
              <div className="overflow-hidden rounded-[20px]">
                <div
                  className={`flex h-44 items-center justify-between bg-gradient-to-r ${banners[banner].gradient} p-5 transition-all duration-500`}
                >
                  <div>
                    <p className="text-xs font-bold">THINK FAST. WIN BIG.</p>
                    <h2 className="mt-1 text-4xl font-black italic">
                      {banners[banner].title}
                    </h2>
                    <p className="mt-2 text-xs font-bold">
                      {banners[banner].subtitle}
                    </p>
                    <button className="mt-4 rounded-xl bg-red-600 px-5 py-2 text-sm font-black shadow-lg transition active:scale-95">
                      PLAY NOW »
                    </button>
                  </div>

                  <div className="text-7xl">
                    {banners[banner].emoji}
                  </div>
                </div>
              </div>
            </section>

            {/* BANNER DOTS */}
            <div className="mt-3 flex justify-center gap-2">
              {banners.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Banner ${i + 1}`}
                  onClick={() => setBanner(i)}
                  className={`h-2 rounded-full transition-all ${
                    banner === i ? "w-7 bg-white" : "w-2 bg-white/50"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SCROLLABLE APP CONTENT */}
      <div className="mx-auto max-w-md bg-white px-4 pb-8">
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

        {/* CLASH SQUAD */}
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
            <h2 className="text-xl font-extrabold text-slate-900">
              🔥 Live Tournaments
            </h2>
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
            className={`pointer-events-none absolute bottom-1 top-1 w-[calc(20%_-_4px)] rounded-2xl bg-gradient-to-b from-red-50 via-pink-50 to-white shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_5px_16px_rgba(255,23,79,0.12)] ${
              draggingNav
                ? "scale-[1.03] transition-transform duration-75"
                : "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
            }`}
            style={{
              transform: `translate3d(calc(${dragPosition * 100}% + ${dragPosition * 4}px), 0, 0)`,
              willChange: "transform",
            }}
          />

          <PremiumNavButton icon="scratch" text="Scratch" active={dragIndex === 0} iconClass="text-[#ff174f]" />
          <PremiumNavButton icon="scratch" text="Spin" active={dragIndex === 1} iconClass="text-[#18a957]" />
          <PremiumNavButton icon="home" text="Home" active={dragIndex === 2} iconClass="text-white" />
          <PremiumNavButton icon="leaderboard" text="Leaderboard" active={dragIndex === 3} iconClass="text-[#ff174f]" />
          <PremiumNavButton icon="support" text="Support" active={dragIndex === 4} iconClass="text-[#18a957]" />
        </div>
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
                <DrawerItem
                  icon="👤"
                  text="My Profile"
                  onClick={() => router.push("/profile")}
                />
              </DrawerGroup>

              <DrawerGroup title="FINANCE">
                <DrawerItem
                  icon="💳"
                  text="My Wallet"
                  onClick={() => router.push("/wallet")}
                />
              </DrawerGroup>

              <DrawerGroup title="GAMING">
                <DrawerItem icon="leaderboard" text="Leaderboard" />
                <DrawerItem icon="📊" text="My Stats" />
              </DrawerGroup>

              <DrawerGroup title="SUPPORT & SETTINGS">
                <DrawerItem
                  icon="⚙️"
                  text="Settings"
                  onClick={() => router.push("/settings")}
                />
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
          <p className="text-[10px] text-slate-400">PRIZE</p>
          <p className="font-black text-green-400">{prize}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">ENTRY</p>
          <p className="font-black">{entry}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400">PLAYERS</p>
          <p className="font-black">{players}</p>
        </div>
      </div>
    </div>
  );
}

function AnimatedNavButton({
  icon,
  text,
  onClick,
}: {
  icon: string;
  text: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-slate-500 transition-all duration-300 active:scale-90"
    >
      {/* Sliding highlight */}
      <span className="pointer-events-none absolute inset-x-2 top-1 h-8 -translate-y-1 rounded-xl bg-red-50 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-active:translate-y-0 group-active:opacity-100" />

      {/* Animated icon */}
      <span className="relative z-10 flex h-7 w-7 items-center justify-center text-[20px] transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-110 group-active:scale-125">
        <span className="animate-[navFloat_2.8s_ease-in-out_infinite] group-hover:animate-[navBounce_0.55s_ease-in-out_1]">
          {icon}
        </span>
      </span>

      <span className="relative z-10 max-w-full truncate text-[9px] font-bold tracking-tight transition-all duration-300 group-hover:text-red-500">
        {text}
      </span>

      {/* Slider dot */}
      <span className="absolute bottom-0 h-1 w-1 rounded-full bg-red-500 opacity-0 transition-all duration-300 group-hover:w-5 group-hover:opacity-100 group-active:w-5 group-active:opacity-100" />
    </button>
  );
}

function NavIcon({
  type,
  active,
}: {
  type: "scratch" | "spin" | "home" | "leaderboard" | "support";
  active?: boolean;
}) {
  const colorClass =
    type === "home"
      ? "text-white"
      : active
      ? type === "spin" || type === "support"
        ? "text-[#18a957]"
        : "text-[#ff174f]"
      : "text-slate-500";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-[22px] w-[22px] ${colorClass}`}
      aria-hidden="true"
    >
      {type === "scratch" && (
        <>
          <rect x="3.5" y="5" width="17" height="14" rx="2.2" />
          <path d="M7 9h.01M10 9h.01M14 9h.01M17 9h.01" />
          <path d="M7 13h3M14 13h3M7 16h.01M10 16h.01M14 16h.01M17 16h.01" />
        </>
      )}

      {type === "spin" && (
        <>
          <circle cx="12" cy="12" r="8.2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M12 3.8v4.1M20.2 12h-4.1M12 20.2v-4.1M3.8 12h4.1" />
          <path d="M17.8 6.2l-2.9 2.9M17.8 17.8l-2.9-2.9M6.2 17.8l2.9-2.9M6.2 6.2l2.9 2.9" />
          <path d="M19.3 4.8v3.4h-3.4" />
        </>
      )}

      {type === "home" && (
        <>
          <path d="M3.5 10.8 12 3.8l8.5 7v8.4a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.5H9.2v5.5H5a1.5 1.5 0 0 1-1.5-1.5z" />
          <path d="M8.7 9.5h6.6" />
        </>
      )}

      {type === "leaderboard" && (
        <>
          <path d="M8 20h8" />
          <path d="M12 17v3" />
          <path d="M7.2 9.2V6.8h3.1v2.4" />
          <path d="M13.7 7.8h3.1v5.1" />
          <path d="M3.8 12.8h3.1v4.4H3.8zM10.45 9.2h3.1v8h-3.1zM17.1 7.8h3.1v9.4h-3.1z" />
          <path d="M9.1 4.2h5.8l1.2 2.2-1.2 2.1h-5.8L7.9 6.4z" />
        </>
      )}

      {type === "support" && (
        <>
          <path d="M4.2 13.2v-1.5a7.8 7.8 0 0 1 15.6 0v1.5" />
          <path d="M4.2 13.2H6a1.6 1.6 0 0 1 1.6 1.6v2A1.6 1.6 0 0 1 6 18.4H4.2z" />
          <path d="M19.8 13.2H18a1.6 1.6 0 0 0-1.6 1.6v2a1.6 1.6 0 0 0 1.6 1.6h1.8z" />
          <path d="M16.4 18.4c-.7 1.2-2 1.9-3.5 1.9h-1.5" />
        </>
      )}
    </svg>
  );
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

<style jsx global>{`
  @keyframes navFloat {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-3px); }
  }

  @keyframes navBounce {
    0% { transform: translateY(0) scale(1); }
    35% { transform: translateY(-5px) scale(1.18); }
    70% { transform: translateY(1px) scale(0.96); }
    100% { transform: translateY(0) scale(1); }
  }
`}</style>
