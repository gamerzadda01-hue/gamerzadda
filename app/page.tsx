
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type DbBanner = {
  id: string;
  image_url: string;
  click_url: string | null;
  title: string | null;
  is_active: boolean;
  sort_order: number;
};

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
  const [dbBanners, setDbBanners] = useState<DbBanner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const bannerCount = dbBanners.length;
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

  // Load active banners created by the admin.
  useEffect(() => {
    let mounted = true;

    async function loadBanners() {
      try {
        const { data, error } = await supabase
          .from("banners")
          .select("id,image_url,click_url,title,is_active,sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });

        if (!error && mounted) {
          setDbBanners((data || []) as DbBanner[]);
          setBanner(0);
        }

        if (mounted) {
          setBannersLoading(false);
        }
      } catch (error) {
        console.error("Banner load error:", error);
        if (mounted) {
          setBannersLoading(false);
        }
      }
    }

    loadBanners();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (dbBanners.length === 0) {
      setBanner(0);
      return;
    }
    setBanner((current) => Math.min(current, dbBanners.length - 1));
  }, [dbBanners.length]);

  // Automatic banner slider. Manual dots below still work.
  useEffect(() => {
    if (bannerCount <= 1) return;

    const timer = window.setInterval(() => {
      setBanner((current) => (current + 1) % bannerCount);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [bannerCount]);

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
                className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#641d3b]/80 text-2xl transition active:scale-90"
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
                className="relative flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#641d3b]/80 text-xl transition active:scale-90"
              >
                🔔
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-yellow-300" />
              </button>
            </header>

            {/* BANNER INSIDE RED CURVE */}
            <section className="mt-3 -mx-1 overflow-hidden rounded-[26px] border border-white/30 bg-white/10 p-1.5 shadow-[0_12px_30px_rgba(100,29,59,0.28)] backdrop-blur-sm">
              <div className="overflow-hidden rounded-[20px]">
                {bannersLoading ? (
                  <div className="h-40 w-full animate-pulse bg-slate-200">
                    <div className="h-full w-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" />
                  </div>
                ) : dbBanners.length > 0 ? (
                  <button
                    type="button"
                    aria-label={`Open banner ${banner + 1}`}
                    onClick={() => {
                      const url = dbBanners[banner]?.click_url;
                      if (url) window.location.href = url;
                    }}
                    className={`block h-40 w-full ${
                      dbBanners[banner]?.click_url
                        ? "cursor-pointer"
                        : "cursor-default"
                    }`}
                  >
                    <img
                      key={dbBanners[banner].id}
                      src={dbBanners[banner].image_url}
                      alt={dbBanners[banner].title || "Gamerzadda banner"}
                      className="block h-full w-full object-cover"
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      referrerPolicy="no-referrer"
                      onLoad={(e) => {
                        e.currentTarget.style.opacity = "1";
                      }}
                      onError={(e) => {
                        console.error(
                          "Banner image failed:",
                          dbBanners[banner].image_url
                        );
                        e.currentTarget.style.opacity = "0.35";
                      }}
                    />
                  </button>
                ) : (
                  <div className="flex h-40 items-center justify-center bg-slate-100 text-sm font-bold text-slate-500">
                    No banners available
                  </div>
                )}
              </div>
            </section>

            {/* BANNER DOTS */}
            <div className="mt-1 flex justify-center gap-2">
              {Array.from({ length: bannerCount }).map((_, i) => (
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
        <section className="mt-1 grid grid-cols-2 gap-3">
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
          <div className="flex h-40 items-center justify-between overflow-hidden rounded-[16px] flex items-center justify-center bg-gradient-to-r from-pink-600 via-red-500 to-orange-400 p-5">
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
        <section className="mt-2">
          <div className="mb-2 flex items-center justify-between">
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

              <p className="mt-2 rounded-xl bg-emerald-50 py-3 text-center font-bold text-emerald-700">
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
    <button className="relative h-40 overflow-hidden rounded-[16px] flex items-center justify-center border border-white/10 bg-gradient-to-br from-blue-700 to-cyan-500 p-4 text-left">
      <div className="relative z-10">
        <h3 className="text-xl font-black">{title}</h3>
        <p className="mt-1 text-[9px] font-bold">{subtitle}</p>
        <span className="mt-2 inline-block rounded-lg bg-red-600 px-3 py-2 text-xs font-black">
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
    <div className="mb-3 rounded-[16px] flex items-center justify-center border border-white/10 bg-[#11182b] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-red-400">{game}</p>
          <h3 className="mt-1 font-black">{title}</h3>
        </div>
        <button className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black">
          JOIN
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 text-center">
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
      className="group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[16px] flex items-center justify-center px-1 py-2 text-slate-500 transition-all duration-300 active:scale-90"
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

function DrawerGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <p className="mb-2 px-1 text-[10px] font-black tracking-[0.16em] text-emerald-600">
        {title}
      </p>
      <div className="space-y-1 rounded-[16px] border border-emerald-100/80 bg-slate-50/60 p-1">{children}</div>
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
