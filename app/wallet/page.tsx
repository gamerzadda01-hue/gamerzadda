"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  reference_id: string | null;
  created_at: string;
};

type Withdrawal = {
  id: string;
  amount: number;
  upi_id: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
};

type Wallet = {
  deposit: number;
  bonus: number;
  winning: number;
  total: number;
};

export default function WalletPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet>({
    deposit: 0,
    bonus: 0,
    winning: 0,
    total: 0,
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadWallet();
  }, []);

  async function loadWallet() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/wallet", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to load wallet.");
        return;
      }

      setWallet(
        data.wallet || {
          deposit: 0,
          bonus: 0,
          winning: 0,
          total: 0,
        }
      );

      setTransactions(data.transactions || []);
      setWithdrawals(data.withdrawals || []);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function openDepositPage() {
    window.location.href = "/wallet/deposit";
  }

  function openWithdrawPage() {
    window.location.href = "/wallet/withdraw";
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatAmount(amount: number) {
    return `₹${Number(amount || 0).toFixed(2)}`;
  }

  function getTransactionTitle(transaction: Transaction) {
    const raw = `${transaction.type || ""} ${transaction.description || ""}`.toLowerCase();

    if (raw.includes("join") || raw.includes("entry") || raw.includes("tournament")) {
      if (raw.includes("join") || raw.includes("entry") || Number(transaction.amount) < 0) {
        return "Tournament Joining Fee";
      }
    }

    if (raw.includes("deposit") || raw.includes("add money") || raw.includes("topup") || raw.includes("top-up")) {
      return "Add Money";
    }

    if (raw.includes("withdraw")) {
      return "Withdrawal";
    }

    if (raw.includes("win") || raw.includes("prize") || raw.includes("reward")) {
      return "Tournament Winning";
    }

    return transaction.description || transaction.type || "Wallet Transaction";
  }

  function getStatusClass(status: string) {
    const value = status.toLowerCase();

    if (
      value === "approved" ||
      value === "success" ||
      value === "completed"
    ) {
      return "text-emerald-600";
    }

    if (
      value === "rejected" ||
      value === "failed" ||
      value === "cancelled"
    ) {
      return "text-red-600";
    }

    return "text-amber-600";
  }

  return (
    <main className="min-h-screen bg-[#f4fbf7] text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-emerald-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between px-4">
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

          <h1 className="text-lg font-black tracking-tight text-slate-900">
            My <span className="text-emerald-600">Wallet</span>
          </h1>

        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pb-6 pt-3">
        {/* ERROR */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {/* TOTAL BALANCE */}
        <section className="relative overflow-hidden rounded-[24px] border border-red-200 bg-gradient-to-br from-[#ff174f] via-[#ed1749] to-[#ff5b72] p-5 text-white shadow-xl shadow-red-200/50">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />

          <p className="text-sm font-semibold text-white/80">Total Balance</p>

          <div className="mt-2 text-4xl font-extrabold tracking-tight">
            {loading ? "₹..." : formatAmount(wallet.total)}
          </div>


        </section>

        {/* BALANCE BREAKDOWN */}
        <section className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <BalanceCard
            icon="💵"
            title="Deposit"
            amount={wallet.deposit}
          />

          <BalanceCard
            icon="🎁"
            title="Bonus"
            amount={wallet.bonus}
          />

          <BalanceCard
            icon="🏆"
            title="Winning"
            amount={wallet.winning}
          />
        </section>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {/* ADD MONEY */}
            <button
              type="button"
              onClick={openDepositPage}
              disabled={loading}
              className="group flex min-h-[50px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-300/40 bg-gradient-to-br from-emerald-300 to-emerald-500 px-3 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              + Add Money
            </button>

            {/* WITHDRAW */}
            <button
              type="button"
              onClick={openWithdrawPage}
              className="group flex min-h-[50px] items-center justify-center gap-1.5 rounded-xl border border-white/70 bg-white px-4 py-3 text-center text-sm font-black text-red-600 shadow-lg shadow-red-950/10 transition hover:-translate-y-0.5 hover:bg-red-50 hover:shadow-xl active:scale-[0.98]"
            >
              Withdraw
            </button>
          </div>



        {/* TRANSACTIONS */}
        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Wallet Transactions</h2>

            <span className="text-xs font-semibold text-slate-500">
              Latest 50
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
            {loading ? (
              <div className="p-5 text-center text-sm text-slate-500">
                Loading transactions...
              </div>
            ) : transactions.length === 0 ? (
              <EmptyState
                icon="📜"
                title="No transactions yet"
                text="Your wallet transactions will appear here."
              />
            ) : (
              <div className="divide-y divide-emerald-50">
                {transactions.map((transaction) => {
                  const positive = Number(transaction.amount) >= 0;

                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            positive
                              ? "bg-emerald-50"
                              : "bg-red-50"
                          }`}
                        >
                          {positive ? "↓" : "↑"}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-800">
                            {transaction.description ||
                              transaction.type ||
                              "Wallet transaction"}
                          </p>

                          <p className="mt-1 text-[11px] text-white/70">
                            {formatDate(transaction.created_at)}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`shrink-0 text-sm font-bold ${
                          positive
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {positive ? "+" : ""}
                        {formatAmount(transaction.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>


      </div>
    </main>
  );
}

function BalanceCard({
  icon,
  title,
  amount,
}: {
  icon: string;
  title: string;
  amount: number;
}) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-lg">
          {icon}
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500">
            {title}
          </p>

          <p className="mt-1 text-lg font-black text-slate-900">
            ₹{Number(amount || 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="p-5 text-center">
      <div className="text-3xl">{icon}</div>

      <p className="mt-3 text-sm font-bold text-slate-700">
        {title}
      </p>

      <p className="mt-1 text-xs font-semibold text-slate-500">
        {text}
      </p>
    </div>
  );
}