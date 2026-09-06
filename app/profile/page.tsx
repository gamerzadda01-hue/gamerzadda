"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  bio: string;
  avatarUrl: string;
};

type Wallet = {
  deposit_balance: number;
  bonus_balance: number;
  winning_balance: number;
};

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile>({
    name: "",
    email: "",
    phone: "",
    referralCode: "",
    bio: "",
    avatarUrl: "",
  });

  const [wallet, setWallet] = useState<Wallet>({
    deposit_balance: 0,
    bonus_balance: 0,
    winning_balance: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState("");
  const [copied, setCopied] = useState(false);

  async function shareReferralCode() {
    const code = profile.referralCode || "";
    if (!code) return;

    const shareText = `Join me on Gamerzadda! Use my referral code: ${code}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Gamerzadda Referral",
          text: shareText,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // User cancelled native share; no action needed.
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", {
          credentials: "include",
          cache: "no-store",
        });

        const result = await response.json();

        if (!mounted) return;

        if (!response.ok || !result?.profile) {
          router.push("/");
          return;
        }

        setProfile(result.profile);
        setBio(result.profile.bio || "");
        setWallet(result.wallet || {});
      } catch {
        if (mounted) router.push("/");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function saveBio() {
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio }),
      });

      if (response.ok) {
        setProfile((prev) => ({ ...prev, bio }));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5faf7] px-5 pt-6">
        <div className="mx-auto max-w-md animate-pulse">
          <div className="h-12 w-12 rounded-2xl bg-emerald-100" />
          <div className="mt-8 h-64 rounded-[30px] bg-white shadow-sm" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5faf7] text-slate-900">
      <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-10">

        {/* Premium top bar — no Gamerzadda text */}
        <header className="flex items-center justify-between py-5">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-slate-700 shadow-[0_8px_25px_rgba(16,185,129,0.10)] transition active:scale-95"
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

          <div className="rounded-full border border-emerald-100 bg-white px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm">
            MY PROFILE
          </div>

          <div className="h-11 w-11" />
        </header>

        {/* Profile hero */}
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#ff1749] via-[#f52a55] to-[#ff6a7f] p-6 text-white shadow-[0_20px_50px_rgba(255,23,73,0.20)]">
          <div className="absolute -right-14 -top-16 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-emerald-300/15" />

          <div className="relative flex flex-col items-center text-center">
            <div className="rounded-full bg-white/20 p-1.5 shadow-xl backdrop-blur-sm">
              <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-emerald-50">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl">
                    👤
                  </div>
                )}
              </div>
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight">
              {profile.name || "Player"}
            </h1>

            <p className="mt-1 max-w-[280px] truncate text-sm text-white/80">
              {profile.bio || "Welcome to your profile"}
            </p>

          </div>
        </section>

        {/* Wallet summary - clickable */}
        <button
          type="button"
          onClick={() => router.push("/wallet")}
          className="mt-5 w-full rounded-[28px] border border-emerald-100 bg-white p-5 text-left shadow-[0_12px_35px_rgba(15,23,42,0.06)] transition active:scale-[0.99] hover:border-emerald-200 hover:shadow-[0_16px_40px_rgba(16,185,129,0.10)]"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">
                Wallet
              </p>
              <h2 className="mt-1 text-lg font-black">Your Balance</h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-lg">
              💳
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold text-slate-400">DEPOSIT</p>
              <p className="mt-1 text-sm font-black">₹{Number(wallet.deposit_balance || 0).toFixed(0)}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3">
              <p className="text-[10px] font-bold text-emerald-600">BONUS</p>
              <p className="mt-1 text-sm font-black">₹{Number(wallet.bonus_balance || 0).toFixed(0)}</p>
            </div>
            <div className="rounded-2xl bg-red-50 p-3">
              <p className="text-[10px] font-bold text-red-500">WINNING</p>
              <p className="mt-1 text-sm font-black">₹{Number(wallet.winning_balance || 0).toFixed(0)}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-emerald-50 pt-3">
            <span className="text-xs font-bold text-slate-400">Tap to open wallet</span>
            <span className="text-sm font-black text-emerald-600">View Wallet →</span>
          </div>
        </button>

        {/* Personal information */}
        <section className="mt-5 rounded-[28px] border border-emerald-100 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">
            Personal details
          </p>

          <div className="mt-4 space-y-3">
            <InfoRow icon="✉️" label="Email" value={profile.email || "Not added"} />
            <InfoRow icon="📱" label="Phone" value={profile.phone || "Not added"} />
            <button
              type="button"
              onClick={shareReferralCode}
              className="flex w-full items-center gap-3 rounded-2xl bg-[#f8fcfa] p-3 text-left transition active:scale-[0.99] hover:bg-emerald-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
                🎟️
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Referral Code
                </p>
                <p className="mt-0.5 truncate text-sm font-black text-slate-800">
                  {profile.referralCode || "—"}
                </p>
              </div>
              <span className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-700">
                {copied ? "Copied!" : "Share"}
              </span>
            </button>
          </div>
        </section>

        {/* Bio editor */}
        <section className="mt-5 rounded-[28px] border border-emerald-100 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-600">
                About you
              </p>
              <h2 className="mt-1 text-lg font-black">Your Bio</h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">
              EDITABLE
            </span>
          </div>

          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={120}
            placeholder="Write something about yourself..."
            className="mt-4 min-h-[100px] w-full resize-none rounded-2xl border border-emerald-100 bg-[#f8fcfa] p-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
          />

          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">{bio.length}/120</span>
            <button
              onClick={saveBio}
              disabled={saving}
              className="rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-200 transition active:scale-95 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#f8fcfa] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-bold text-slate-800">
          {value}
        </p>
      </div>
    </div>
  );
}
