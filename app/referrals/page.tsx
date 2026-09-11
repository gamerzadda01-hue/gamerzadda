"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Reward = {
  id: string;
  reward_type: string;
  referrer_amount: number;
  referred_amount: number;
  referrer_wallet: string | null;
  referred_wallet: string | null;
  created_at: string;
};

type ReferralUser = {
  id: string;
  full_name: string | null;
  referral_code: string | null;
  created_at: string;
  rewards: Reward[];
};

type ReferralData = {
  referralCode: string | null;
  totalReferrals: number;
  totalEarnings: number;
  signupRewards: number;
  tournamentRewards: number;
  depositRewards: number;
  referrals: ReferralUser[];
};

function money(value: number) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function rewardLabel(type: string) {
  if (type === "signup") return "Signup Reward";
  if (type === "first_tournament") return "First Tournament";
  if (type === "first_deposit") return "First Deposit";
  return "Referral Reward";
}

export default function ReferralsPage() {
  const router = useRouter();

  const [data, setData] = useState<ReferralData>({
    referralCode: null,
    totalReferrals: 0,
    totalEarnings: 0,
    signupRewards: 0,
    tournamentRewards: 0,
    depositRewards: 0,
    referrals: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferrals();
  }, []);

  async function loadReferrals() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/referrals", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const result = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        setError(result?.error || "Failed to load referrals.");
        return;
      }

      setData({
        referralCode: result.referralCode || null,
        totalReferrals: Number(result.totalReferrals || 0),
        totalEarnings: Number(result.totalEarnings || 0),
        signupRewards: Number(result.signupRewards || 0),
        tournamentRewards: Number(result.tournamentRewards || 0),
        depositRewards: Number(result.depositRewards || 0),
        referrals: Array.isArray(result.referrals) ? result.referrals : [],
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!data.referralCode) return;

    try {
      await navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Unable to copy referral code.");
    }
  }

  async function shareReferral() {
    if (!data.referralCode) return;

    const text = `🎁 Refer & Earn with GAMERZADDA!

💰 Use my referral code: ${data.referralCode}
🔥 Get bonus rewards by joining through my code!

📲 Download the GAMERZADDA app:
https://gamerzadda.com

✅ Open gamerzadda.com
✅ Download the app
✅ Complete signup
✅ Enter my referral code: ${data.referralCode}
✅ Start playing tournaments & earn rewards!

🚀 Join now and let's play together!`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join GAMERZADDA",
          text,
        });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch {}
  }

  return (
    <main className="min-h-screen bg-white pb-10 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
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

          <div>
            <h1 className="text-lg font-black">My Referrals</h1>
            <p className="text-[10px] font-semibold text-slate-400">
              Invite friends • Earn rewards
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-4">
        {error && (
          <div className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
            {error}
          </div>
        )}

        <section className="relative overflow-hidden rounded-[24px] border border-red-100 bg-gradient-to-br from-red-50 via-white to-orange-50 p-5 shadow-sm">
          <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-red-200/30 blur-3xl" />

          <div className="relative">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                👥
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-500">
                  Referral Program
                </p>
                <h2 className="mt-1 text-2xl font-black leading-tight">
                  Refer & Get Up To <span className="text-red-500">₹100</span>
                </h2>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                  Invite your friends to GAMERZADDA and earn bonus cash when they join, play & deposit.
                </p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-3 py-1.5 shadow-sm">
                  <span className="text-sm">🎁</span>
                  <span className="text-[10px] font-black text-red-600">
                    Refer friends • Earn bonus cash
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                Your Referral Code
              </p>

              <div className="mt-2 flex items-center gap-2">
                <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-3 text-center text-lg font-black tracking-[0.18em] text-slate-900">
                  {loading ? "••••••" : data.referralCode || "Not available"}
                </div>

                <button
                  onClick={copyCode}
                  disabled={!data.referralCode}
                  className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white disabled:opacity-40"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <button
                onClick={shareReferral}
                disabled={!data.referralCode}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-3.5 text-xs font-black text-white shadow-[0_8px_20px_rgba(239,68,68,0.22)] transition active:scale-[0.98] disabled:opacity-40"
              >
                <span>↗</span>
                Share & Earn
              </button>
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400">Total Referrals</p>
            <p className="mt-1 text-2xl font-black">{data.totalReferrals}</p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-emerald-600">Total Earnings</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">
              {money(data.totalEarnings)}
            </p>
          </div>
        </section>

        <section className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="text-[9px] font-bold text-slate-400">Signup</p>
            <p className="mt-1 text-sm font-black">{money(data.signupRewards)}</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="text-[9px] font-bold text-slate-400">Tournament</p>
            <p className="mt-1 text-sm font-black">{money(data.tournamentRewards)}</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="text-[9px] font-bold text-slate-400">Deposit</p>
            <p className="mt-1 text-sm font-black">{money(data.depositRewards)}</p>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-red-500">
                Referral Activity
              </p>
              <h3 className="mt-1 text-lg font-black">Your Referrals</h3>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-xs font-bold text-slate-400 shadow-sm">
              Loading referrals...
            </div>
          ) : data.referrals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <div className="text-3xl">👥</div>
              <p className="mt-2 text-sm font-black">No referrals yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Share your referral code to start earning.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.referrals.map((referral) => {
                const earned = referral.rewards.reduce(
                  (sum, reward) => sum + Number(reward.referrer_amount || 0),
                  0
                );

                return (
                  <div
                    key={referral.id}
                    className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {referral.full_name || "GAMERZADDA User"}
                        </p>
                        <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                          Joined {formatDate(referral.created_at)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Earned
                        </p>
                        <p className="text-sm font-black text-emerald-600">
                          {money(earned)}
                        </p>
                      </div>
                    </div>

                    {referral.rewards.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {referral.rewards.map((reward) => (
                          <div
                            key={reward.id}
                            className="flex items-center justify-between gap-3 px-4 py-3"
                          >
                            <div>
                              <p className="text-xs font-black">
                                {rewardLabel(reward.reward_type)}
                              </p>
                              <p className="mt-0.5 text-[9px] font-medium text-slate-400">
                                {formatDate(reward.created_at)}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-xs font-black text-emerald-600">
                                + {money(reward.referrer_amount)}
                              </p>
                              <p className="mt-0.5 text-[9px] font-semibold text-slate-400">
                                {reward.referrer_wallet === "deposit"
                                  ? "Deposit Wallet"
                                  : "Bonus Wallet"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-[10px] font-semibold text-slate-400">
                        No rewards recorded yet.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-black">How referral rewards work</p>
          <div className="mt-2 space-y-1.5 text-[10px] font-medium leading-relaxed text-slate-500">
            <p>• Signup reward is credited after a referred user successfully signs up.</p>
            <p>• First tournament reward is credited after their first successful tournament join.</p>
            <p>• First deposit reward is credited after their first successful deposit.</p>
            <p>• Each referral milestone is rewarded only once.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
