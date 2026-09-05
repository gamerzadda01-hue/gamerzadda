"use client";

import Link from "next/link";
import { useState } from "react";

export default function DepositPage() {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDeposit() {
    setError("");

    const value = Number(amount);

    if (!Number.isFinite(value) || value < 10) {
      setError("Minimum deposit amount is ₹10.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/deposit/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to create payment.");
        return;
      }

      if (!data.paymentUrl) {
        setError("Payment link was not received.");
        return;
      }

      window.location.href = data.paymentUrl;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f8f5] text-[#18221c]">
      <header className="border-b border-[#dfe8e1] bg-white">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link
            href="/wallet"
            className="text-sm font-bold text-[#59635c]"
          >
            ← Wallet
          </Link>

          <h1 className="text-base font-extrabold">
            Add Money
          </h1>

          <div className="w-14" />
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-5">
        {error && (
          <div className="mb-4 rounded-xl border border-[#f1c1c1] bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#c62828]">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-[#cfe6d4] bg-[#edfaef] p-5">
          <p className="text-xs font-semibold text-[#657169]">
            Add money to your GamerzAdda wallet
          </p>

          <p className="mt-1 text-sm text-[#718078]">
            Secure payment powered by Pay0.
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-[#e0e6e1] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold">
            Deposit Amount
          </h2>

          <div className="mt-5">
            <label className="mb-2 block text-xs font-bold text-[#465148]">
              Amount
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#7b857d]">
                ₹
              </span>

              <input
                type="number"
                inputMode="decimal"
                min="10"
                step="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                placeholder="Enter amount"
                className="w-full rounded-xl border border-[#dce3de] bg-[#fafcfb] py-3.5 pl-9 pr-3 font-bold outline-none focus:border-[#83c792] focus:ring-4 focus:ring-[#e4f5e7]"
              />
            </div>

            <div className="mt-3 flex gap-2">
              {[50, 100, 200, 500].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setAmount(String(value));
                    setError("");
                  }}
                  className="rounded-lg border border-[#dce5df] bg-[#f8faf8] px-3 py-2 text-[11px] font-bold text-[#536058] hover:bg-[#eff9f1]"
                >
                  ₹{value}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-[#f7faf7] p-4">
            <div className="flex justify-between text-sm">
              <span className="text-[#747e76]">
                Deposit Amount
              </span>

              <span className="font-bold">
                ₹{Number(amount || 0).toFixed(2)}
              </span>
            </div>

            <div className="my-3 border-t border-[#e1e7e2]" />

            <div className="flex justify-between">
              <span className="text-sm font-extrabold">
                Wallet Credit
              </span>

              <span className="text-lg font-black text-[#25803c]">
                ₹{Number(amount || 0).toFixed(2)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDeposit}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-[#d83232] py-3.5 text-sm font-extrabold text-white transition hover:bg-[#c92b2b] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? "Creating Payment..." : "Proceed to Payment"}
          </button>

          <p className="mt-3 text-center text-[10px] text-[#89918b]">
            You will be redirected to the payment page.
          </p>
        </section>
      </div>
    </main>
  );
}