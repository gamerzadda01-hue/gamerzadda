"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

  function getStatusClass(status: string) {
    const value = status.toLowerCase();

    if (
      value === "approved" ||
      value === "success" ||
      value === "completed"
    ) {
      return "text-green-400";
    }

    if (
      value === "rejected" ||
      value === "failed" ||
      value === "cancelled"
    ) {
      return "text-red-400";
    }

    return "text-yellow-400";
  }

  return (
    <main className="min-h-screen bg-[#070b12] text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090d15]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-gray-300"
          >
            <span className="text-xl">←</span>
            Home
          </Link>

          <h1 className="text-lg font-bold">
            My <span className="text-green-400">Wallet</span>
          </h1>

          <button
            type="button"
            onClick={loadWallet}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300"
          >
            ↻
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-10 pt-5">
        {/* ERROR */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* TOTAL BALANCE */}
        <section className="relative overflow-hidden rounded-2xl border border-green-500/20 bg-gradient-to-br from-[#102319] via-[#0d1715] to-[#091016] p-6 shadow-xl">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-green-400/10 blur-2xl" />

          <p className="text-sm text-gray-400">Total Balance</p>

          <div className="mt-2 text-4xl font-extrabold tracking-tight">
            {loading ? "₹..." : formatAmount(wallet.total)}
          </div>

          <div className="mt-5 flex gap-3">
            {/* ADD MONEY */}
            <button
              type="button"
              onClick={openDepositPage}
              disabled={loading}
              className="flex-1 cursor-pointer rounded-xl bg-green-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-green-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              + Add Money
            </button>

            {/* WITHDRAW */}
            <button
              type="button"
              onClick={openWithdrawPage}
              className="flex-1 cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10 active:scale-[0.98]"
            >
              Withdraw
            </button>
          </div>

          <p className="mt-3 text-center text-[11px] text-gray-500">
            Add Money & withdrawal are available.
          </p>
        </section>

        {/* BALANCE BREAKDOWN */}
        <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
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

        {/* TRANSACTIONS */}
        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Transactions</h2>

            <span className="text-xs text-gray-500">
              Latest 50
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c111a]">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Loading transactions...
              </div>
            ) : transactions.length === 0 ? (
              <EmptyState
                icon="📜"
                title="No transactions yet"
                text="Your wallet transactions will appear here."
              />
            ) : (
              <div className="divide-y divide-white/5">
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
                              ? "bg-green-500/10"
                              : "bg-red-500/10"
                          }`}
                        >
                          {positive ? "↓" : "↑"}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {transaction.description ||
                              transaction.type ||
                              "Wallet transaction"}
                          </p>

                          <p className="mt-1 text-[11px] text-gray-500">
                            {formatDate(transaction.created_at)}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`shrink-0 text-sm font-bold ${
                          positive
                            ? "text-green-400"
                            : "text-red-400"
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

        {/* WITHDRAWAL HISTORY */}
        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">
              Withdrawal History
            </h2>

            <span className="text-xs text-gray-500">
              Latest 50
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c111a]">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500">
                Loading withdrawals...
              </div>
            ) : withdrawals.length === 0 ? (
              <EmptyState
                icon="💸"
                title="No withdrawals yet"
                text="Your withdrawal requests will appear here."
              />
            ) : (
              <div className="divide-y divide-white/5">
                {withdrawals.map((withdrawal) => (
                  <div
                    key={withdrawal.id}
                    className="p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">
                          Withdrawal
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          UPI: {withdrawal.upi_id}
                        </p>

                        <p className="mt-1 text-[11px] text-gray-600">
                          {formatDate(withdrawal.created_at)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold text-white">
                          {formatAmount(withdrawal.amount)}
                        </p>

                        <p
                          className={`mt-1 text-xs font-semibold capitalize ${getStatusClass(
                            withdrawal.status
                          )}`}
                        >
                          {withdrawal.status}
                        </p>
                      </div>
                    </div>

                    {withdrawal.admin_note && (
                      <div className="mt-3 rounded-lg bg-white/5 p-3 text-xs text-gray-400">
                        <span className="font-semibold text-gray-300">
                          Admin note:
                        </span>{" "}
                        {withdrawal.admin_note}
                      </div>
                    )}
                  </div>
                ))}
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
    <div className="rounded-2xl border border-white/10 bg-[#0c111a] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-lg">
          {icon}
        </div>

        <div>
          <p className="text-xs text-gray-500">
            {title}
          </p>

          <p className="mt-1 text-lg font-bold">
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
    <div className="p-8 text-center">
      <div className="text-3xl">{icon}</div>

      <p className="mt-3 text-sm font-semibold text-gray-300">
        {title}
      </p>

      <p className="mt-1 text-xs text-gray-500">
        {text}
      </p>
    </div>
  );
}