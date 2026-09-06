 "use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const banners = [
  { title: "FREE FIRE TOURNAMENTS", subtitle: "PLAY • COMPETE • WIN REAL CASH", gradient: "from-red-600 via-red-500 to-orange-400" },
  { title: "DAILY CASH MATCHES", subtitle: "JOIN WITH LOW ENTRY • WIN BIG", gradient: "from-emerald-600 via-green-500 to-lime-400" },
  { title: "GAMERZADDA", subtitle: "YOUR GAMING. YOUR SKILL. YOUR REWARD.", gradient: "from-red-700 via-rose-600 to-red-400" },
];

const games = [
  { name: "Free Fire", icon: "🔥", players: "12K+", gradient: "from-red-600 to-orange-500" },
  { name: "Free Fire MAX", icon: "⚡", players: "8K+", gradient: "from-green-600 to-emerald-400" },
  { name: "Ludo", icon: "🎲", players: "5K+", gradient: "from-blue-600 to-cyan-400" },
  { name: "Quiz", icon: "🧠", players: "3K+", gradient: "from-purple-600 to-pink-500" },
];

const tournaments = [
  { title: "Solo Kill Challenge", game: "Free Fire MAX", entry: "₹10", prize: "₹1,000", joined: 62, max: 100, time: "Today • 08:30 PM", status: "UPCOMING" },
  { title: "Duo Cash Battle", game: "Free Fire", entry: "₹25", prize: "₹2,500", joined: 78, max: 100, time: "Today • 09:30 PM", status: "UPCOMING" },
  { title: "Night Pro Room", game: "Free Fire MAX", entry: "₹50", prize: "₹5,000", joined: 94, max: 100, time: "LIVE NOW", status: "LIVE" },
];

export default function HomePage() {
  const router = useRouter();
  const [splash, setSplash] = useState(true);
  const [banner, setBanner] = useState(0);
  const [menu, setMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 1800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setBanner((v) => (v + 1) % banners.length), 4000);
    return () => clearInterval(timer);
  }, []);

  async function logout() {
    if (loggingOut) return;
    const confirmed = window.confirm("Are you sure you want to logout?");
    if (!confirmed) return;

    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      try {
        localStorage.removeItem("gamerzadda_device_id");
      } catch {}
      router.replace("/login");
    }
  }

  if (splash) {
    return (
      <main className="fixed inset-0 z-[999] flex items-center justify-center overflow-hidden bg-white">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-red-100 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-green-100 blur-3xl" />
        <div className="relative flex flex-col items-center">
          <div className="mb-5 flex h-24 w-24 animate-pulse items-center justify-center rounded-[28px] bg-gradient-to-br from-red-600 to-red-500 text-5xl shadow-2xl shadow-red-200">🎮</div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">GAMER<span className="text-red-600">Z</span>ADDA</h1>
          <p className="mt-2 text-sm font-semibold tracking-[0.2em] text-green-600">PLAY • WIN • REPEAT</p>
          <div className="mt-8 h-1.5 w-32 overflow-hidden rounded-full bg-gray-100"><div className="h-full w-1/2 animate-[splashbar_1.8s_ease-in-out_infinite] rounded-full bg-red-600" /></div>
        </div>
        <style jsx global>{`@keyframes splashbar{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}} @keyframes drawer{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      </main>
    );
  }

  const current = banners[banner];

  return (
    <main className="min-h-screen bg-[#f7faf8] pb-24 text-gray-900">
      <style jsx global>{`@keyframes fadeup{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} @keyframes drawer{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button onClick={() => setMenu(true)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-xl transition hover:bg-gray-200 active:scale-95">☰</button>
          <div className="text-center">
            <div className="text-lg font-black tracking-tight">GAMER<span className="text-red-600">Z</span>ADDA</div>
            <div className="text-[9px] font-bold tracking-[0.22em] text-green-600">GAMING PLATFORM</div>
          </div>
          <button className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-xl transition hover:bg-red-100 active:scale-95">🔔<span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white" /></button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4">
        <section className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-gray-950 via-gray-900 to-red-950 p-5 text-white shadow-xl">
          <div className="flex items-start justify-between"><div><p className="text-xs font-medium text-gray-300">Available Balance</p><h2 className="mt-1 text-3xl font-black">₹500.00</h2></div><div className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-bold backdrop-blur">💰 WALLET</div></div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button onClick={() => router.push("/wallet")} className="rounded-2xl bg-white px-4 py-3 font-bold text-gray-900 transition hover:scale-[1.02] active:scale-95">+ Add Money</button>
            <button onClick={() => router.push("/wallet/withdrawal")} className="rounded-2xl bg-green-500 px-4 py-3 font-bold text-white transition hover:bg-green-600 hover:scale-[1.02] active:scale-95">Withdraw</button>
          </div>
        </section>

        <section key={banner} className={`mt-5 min-h-[190px] animate-[fadeup_0.45s_ease-out] overflow-hidden rounded-3xl bg-gradient-to-br ${current.gradient} p-6 text-white shadow-xl`}>
          <div className="flex h-full min-h-[178px] flex-col justify-between"><div><span className="rounded-full bg-white/20 px-3 py-1 text-[10px] font-black tracking-wider backdrop-blur">GAMERZADDA</span><h2 className="mt-4 max-w-sm text-3xl font-black leading-tight">{current.title}</h2><p className="mt-2 text-sm font-semibold text-white/90">{current.subtitle}</p></div><button className="mt-5 w-fit rounded-xl bg-white px-5 py-2.5 text-sm font-black text-red-600 shadow-lg transition hover:scale-105 active:scale-95">JOIN NOW →</button></div>
        </section>

        <div className="mt-3 flex justify-center gap-1.5">{banners.map((_, i) => <button key={i} onClick={() => setBanner(i)} className={`h-1.5 rounded-full transition-all ${banner === i ? "w-7 bg-red-600" : "w-2 bg-gray-300"}`} />)}</div>

        <section className="mt-7"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-green-600">Choose your game</p><h2 className="text-2xl font-black">Play & Compete</h2></div><button className="text-sm font-bold text-red-600">View All</button></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{games.map((game) => <button key={game.name} className="group overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-1 hover:shadow-lg active:scale-[.98]"><div className={`bg-gradient-to-br ${game.gradient} p-4 text-white`}><div className="flex items-center justify-between"><span className="text-3xl">{game.icon}</span><span className="text-[10px] font-black opacity-80">LIVE</span></div></div><div className="p-3"><h3 className="text-sm font-black">{game.name}</h3><p className="mt-1 text-[11px] font-medium text-gray-500">{game.players} players</p></div></button>)}</div>
        </section>

        <section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-red-600">Battle starts here</p><h2 className="text-2xl font-black">Featured Tournaments</h2></div><button className="text-sm font-bold text-red-600">See All</button></div>
          <div className="space-y-4">{tournaments.map((tournament) => { const progress = Math.min(100, Math.round((tournament.joined / tournament.max) * 100)); return <article key={tournament.title} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gray-100 transition hover:shadow-xl"><div className="border-b border-gray-100 p-4"><div className="flex items-start justify-between gap-3"><div><div className="mb-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${tournament.status === "LIVE" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>{tournament.status === "LIVE" ? "● LIVE" : "UPCOMING"}</span><span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-600">{tournament.game}</span></div><h3 className="text-lg font-black">{tournament.title}</h3><p className="mt-1 text-xs font-medium text-gray-500">🕒 {tournament.time}</p></div><div className="rounded-2xl bg-green-50 px-3 py-2 text-right"><p className="text-[9px] font-bold uppercase text-green-700">Prize Pool</p><p className="text-xl font-black text-green-600">{tournament.prize}</p></div></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-gray-50 p-3"><p className="text-[10px] font-bold text-gray-500">ENTRY FEE</p><p className="mt-1 text-lg font-black text-gray-900">{tournament.entry}</p></div><div className="rounded-2xl bg-gray-50 p-3"><p className="text-[10px] font-bold text-gray-500">PLAYERS</p><p className="mt-1 text-lg font-black text-gray-900">{tournament.joined}/{tournament.max}</p></div></div><div className="mt-4"><div className="mb-1 flex justify-between text-[10px] font-bold text-gray-500"><span>Slots filled</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-green-500 transition-all" style={{width:`${progress}%`}} /></div></div></div><div className="flex gap-2 p-4"><button className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-black text-gray-800 transition hover:bg-gray-50 active:scale-95">Details</button><button onClick={() => {setLoading(true);setTimeout(()=>setLoading(false),700)}} className="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-black text-white shadow-lg shadow-red-100 transition hover:bg-red-700 active:scale-95 disabled:opacity-60" disabled={loading}>{loading ? "Joining..." : "Join Now"}</button></div></article> })}</div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 px-3 py-2 backdrop-blur"><div className="mx-auto grid max-w-2xl grid-cols-4 gap-1">{[["⌂","Home"],["🏆","Tournaments"],["💰","Wallet"],["👤","Profile"]].map(([icon,label],i)=><button key={label} onClick={() => label==="Wallet" ? router.push("/wallet") : label==="Profile" ? router.push("/profile") : label==="Tournaments" ? router.push("/tournaments") : router.push("/")} className={`rounded-2xl py-2 text-center transition active:scale-95 ${i===0?"bg-red-50 text-red-600":"text-gray-500 hover:bg-gray-50"}`}><div className="text-xl">{icon}</div><div className="mt-0.5 text-[10px] font-bold">{label}</div></button>)}</div></nav>

      {menu && <div className="fixed inset-0 z-[100]"><button aria-label="Close menu" onClick={() => setMenu(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" /><aside className="absolute right-0 top-0 h-full w-[82%] max-w-sm animate-[drawer_0.3s_ease-out] bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between"><div><div className="text-xl font-black">GAMER<span className="text-red-600">Z</span>ADDA</div><p className="text-xs font-semibold text-green-600">Gaming Platform</p></div><button onClick={() => setMenu(false)} className="h-10 w-10 rounded-xl bg-gray-100 text-xl">×</button></div>
        <div className="mt-7 space-y-2">
          {[
            ["🏠","Home","/"],
            ["🏆","Tournaments","/tournaments"],
            ["💰","Wallet","/wallet"],
            ["🎁","Rewards","/rewards"],
            ["🔔","Notifications","/notifications"],
            ["❓","Support","/support"],
            ["⚙️","Settings","/settings"],
          ].map(([icon,label,path]) => <button key={label} onClick={() => { setMenu(false); router.push(path); }} className="flex w-full items-center gap-4 rounded-2xl p-4 text-left font-bold transition hover:bg-gray-50"><span className="text-xl">{icon}</span>{label}</button>)}
          <div className="my-3 border-t border-gray-100" />
          <button onClick={logout} disabled={loggingOut} className="flex w-full items-center gap-4 rounded-2xl bg-red-50 p-4 text-left font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60"><span className="text-xl">🚪</span>{loggingOut ? "Logging out..." : "Logout"}</button>
        </div>
        <div className="absolute bottom-6 left-5 right-5 rounded-2xl bg-green-50 p-4"><p className="text-xs font-bold text-green-700">Need Help?</p><p className="mt-1 text-xs text-green-700/80">Contact GamerzAdda support anytime.</p></div>
      </aside></div>}
    </main>
  );
}
