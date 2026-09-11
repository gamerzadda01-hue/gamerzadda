"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Reward = {
  id: string;
  reward_type: string;
  referrer_amount: number;
  referred_amount: number;
  referrer_wallet: string | null;
  referred_wallet: string | null;
  created_at: string;
};

type ReferralRow = {
  id: string;
  referral_code: string;
  created_at: string;
  total_reward: number;
  referrer: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    referral_code: string | null;
  } | null;
  referred: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    referral_code: string | null;
  } | null;
  rewards: Reward[];
};

type Stats = {
  totalReferrals: number;
  signupRewards: number;
  tournamentRewards: number;
  depositRewards: number;
  totalRewards: number;
};

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function rewardLabel(type: string) {
  if (type === "signup") return "Signup";
  if (type === "first_tournament") return "First Tournament";
  if (type === "first_deposit") return "First Deposit";
  return type.replace(/_/g, " ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminReferralsPage() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalReferrals: 0,
    signupRewards: 0,
    tournamentRewards: 0,
    depositRewards: 0,
    totalRewards: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ReferralRow | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token || "";

      const response = await fetch(
        `/api/admin/referrals?search=${encodeURIComponent(search)}`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
          cache: "no-store",
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Unable to load referrals.");
      }

      setRows(result.referrals || []);
      setStats(result.stats || {});
    } catch (e: any) {
      setError(e?.message || "Unable to load referrals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      const values = [
        row.referral_code,
        row.referrer?.full_name,
        row.referrer?.phone,
        row.referred?.full_name,
        row.referred?.phone,
      ];

      return values.some((v) =>
        String(v || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  return (
    <main className="min-h-screen bg-[#080808] text-white p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Referral Dashboard</h1>
            <p className="mt-1 text-sm text-white/50">
              Track referrals and all referral rewards.
            </p>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Total Referrals", stats.totalReferrals],
            ["Signup Rewards", money(stats.signupRewards)],
            ["Tournament Rewards", money(stats.tournamentRewards)],
            ["Deposit Rewards", money(stats.depositRewards)],
            ["Total Rewards", money(stats.totalRewards)],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
            >
              <p className="text-xs text-white/45">{label}</p>
              <p className="mt-2 text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email or referral code..."
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-white/25"
          />
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-4 py-4">Referral</th>
                  <th className="px-4 py-4">Referrer</th>
                  <th className="px-4 py-4">Referred User</th>
                  <th className="px-4 py-4">Rewards</th>
                  <th className="px-4 py-4">Created</th>
                  <th className="px-4 py-4"></th>
                </tr>
              </thead>

              <tbody>
                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-white/40">
                      No referrals found.
                    </td>
                  </tr>
                )}

                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 hover:bg-white/[0.025]"
                  >
                    <td className="px-4 py-4">
                      <div className="font-semibold">{row.referral_code}</div>
                      <div className="mt-1 text-xs text-white/35">
                        {row.rewards.length} reward milestone
                        {row.rewards.length === 1 ? "" : "s"}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium">
                        {row.referrer?.full_name || "Unknown"}
                      </div>
                      <div className="text-xs text-white/40">
                        {row.referrer?.phone || row.referrer?.email || "—"}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium">
                        {row.referred?.full_name || "Unknown"}
                      </div>
                      <div className="text-xs text-white/40">
                        {row.referred?.phone || row.referred?.email || "—"}
                      </div>
                    </td>

                    <td className="px-4 py-4 font-semibold">
                      {money(row.total_reward)}
                    </td>

                    <td className="px-4 py-4 text-xs text-white/50">
                      {formatDate(row.created_at)}
                    </td>

                    <td className="px-4 py-4">
                      <button
                        onClick={() => setSelected(row)}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/10"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setSelected(null)}
          >
            <div
              className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101010] p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Referral Details</h2>
                  <p className="mt-1 text-sm text-white/45">
                    Code: {selected.referral_code}
                  </p>
                </div>

                <button
                  onClick={() => setSelected(null)}
                  className="rounded-lg px-3 py-2 text-white/50 hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs text-white/40">Referrer</p>
                  <p className="mt-1 font-semibold">
                    {selected.referrer?.full_name || "Unknown"}
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    {selected.referrer?.phone || selected.referrer?.email || "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs text-white/40">Referred User</p>
                  <p className="mt-1 font-semibold">
                    {selected.referred?.full_name || "Unknown"}
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    {selected.referred?.phone || selected.referred?.email || "—"}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <h3 className="mb-3 font-semibold">Reward History</h3>

                <div className="space-y-2">
                  {selected.rewards.length === 0 ? (
                    <div className="rounded-xl border border-white/10 p-4 text-sm text-white/40">
                      No reward recorded yet.
                    </div>
                  ) : (
                    selected.rewards.map((reward) => (
                      <div
                        key={reward.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {rewardLabel(reward.reward_type)}
                            </p>
                            <p className="mt-1 text-xs text-white/40">
                              {formatDate(reward.created_at)}
                            </p>
                          </div>

                          <div className="text-right text-sm">
                            <p>
                              Referrer:{" "}
                              <span className="font-semibold">
                                {money(Number(reward.referrer_amount || 0))}
                              </span>
                            </p>
                            <p className="mt-1">
                              Referred:{" "}
                              <span className="font-semibold">
                                {money(Number(reward.referred_amount || 0))}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-white/40">
                          {reward.referrer_wallet || "—"} wallet → referrer
                          {" · "}
                          {reward.referred_wallet || "—"} wallet → referred user
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
