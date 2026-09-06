"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const MIN_WITHDRAWAL = 50;
const SERVICE_CHARGE = 5;

type Wallet = {
  deposit: number;
  bonus: number;
  winning: number;
  total: number;
};

export default function WithdrawPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet>({
    deposit: 0,
    bonus: 0,
    winning: 0,
    total: 0,
  });

  const [amount, setAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [upiHolderName, setUpiHolderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
    } catch {
      setError("Unable to load wallet.");
    } finally {
      setLoading(false);
    }
  }

  const numericAmount = Number(amount);

  const receiveAmount = useMemo(() => {
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return 0;
    }

    return Math.max(0, numericAmount - SERVICE_CHARGE);
  }, [numericAmount]);

  function setQuickAmount(value: number) {
    setAmount(String(value));
    setError("");
  }

  function validateForm() {
    const value = Number(amount);

    if (!amount.trim() || !Number.isFinite(value)) {
      return "Enter a valid withdrawal amount.";
    }

    if (value < MIN_WITHDRAWAL) {
      return `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}.`;
    }

    if (Math.round(value * 100) !== value * 100) {
      return "Amount can have maximum 2 decimal places.";
    }

    if (value > Number(wallet.winning || 0)) {
      return "Insufficient winning balance.";
    }

    if (!upiHolderName.trim()) {
      return "UPI holder name is required.";
    }

    if (upiHolderName.trim().length < 2) {
      return "Enter a valid UPI holder name.";
    }

    if (!upiId.trim()) {
      return "UPI ID is required.";
    }

    if (
      !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(
        upiId.trim()
      )
    ) {
      return "Enter a valid UPI ID.";
    }

    return "";
  }

  function handleWithdraw() {
    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setShowConfirm(true);
  }

  async function submitWithdrawal() {
    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: numericAmount,
          upiId: upiId.trim(),
          upiHolderName: upiHolderName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Withdrawal request failed.");
        return;
      }

      // Clear form
      setAmount("");
      setUpiId("");
      setUpiHolderName("");

      // Refresh wallet
      await loadWallet();

      // Show success popup
      setShowSuccess(true);
    } catch {
      setError(
        "Unable to submit withdrawal request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f8f5] text-[#18221c]">
      {/* HEADER */}
      <header className="border-b border-[#dfe8e1] bg-white">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Link
            href="/wallet"
            className="text-sm font-bold text-[#59635c]"
          >
            ← Wallet
          </Link>

          <h1 className="text-base font-extrabold">
            Withdraw
          </h1>

          <div className="w-14" />
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-5">

        {/* ERROR */}
        {error && (
          <div className="mb-4 rounded-xl border border-[#f1c1c1] bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#c62828]">
            {error}
          </div>
        )}

        {/* BALANCE */}
        <section className="rounded-2xl border border-[#cfe6d4] bg-[#edfaef] p-5">
          <p className="text-xs font-semibold text-[#657169]">
            Available Winning Balance
          </p>

          <div className="mt-1 text-3xl font-black text-[#193d24]">
            {loading
              ? "₹..."
              : `₹${Number(
                  wallet.winning || 0
                ).toFixed(2)}`}
          </div>

          <p className="mt-1 text-[11px] text-[#718078]">
            Only winning balance is withdrawable.
          </p>
        </section>

        {/* FORM */}
        <section className="mt-4 rounded-2xl border border-[#e0e6e1] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold">
            Withdraw Money
          </h2>

          {/* AMOUNT */}
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
                min={MIN_WITHDRAWAL}
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

            <div className="mt-2 flex gap-2">
              {[50, 100, 200, 500].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setQuickAmount(value)}
                  disabled={
                    value >
                    Number(wallet.winning || 0)
                  }
                  className="rounded-lg border border-[#dce5df] bg-[#f8faf8] px-3 py-2 text-[11px] font-bold text-[#536058] hover:bg-[#eff9f1] disabled:opacity-40"
                >
                  ₹{value}
                </button>
              ))}
            </div>
          </div>

          {/* UPI */}
          <div className="mt-4">
            <label className="mb-2 block text-xs font-bold text-[#465148]">
              UPI ID
            </label>

            <input
              type="text"
              value={upiId}
              onChange={(e) => {
                setUpiId(e.target.value);
                setError("");
              }}
              placeholder="example@upi"
              autoComplete="off"
              className="w-full rounded-xl border border-[#dce3de] bg-[#fafcfb] px-4 py-3.5 font-semibold outline-none focus:border-[#83c792] focus:ring-4 focus:ring-[#e4f5e7]"
            />
          </div>

          {/* UPI HOLDER NAME */}
          <div className="mt-4">
            <label className="mb-2 block text-xs font-bold text-[#465148]">
              UPI Holder Name
            </label>

            <input
              type="text"
              value={upiHolderName}
              onChange={(e) => {
                setUpiHolderName(e.target.value);
                setError("");
              }}
              placeholder="Enter UPI account holder name"
              autoComplete="name"
              className="w-full rounded-xl border border-[#dce3de] bg-[#fafcfb] px-4 py-3.5 font-semibold outline-none focus:border-[#83c792] focus:ring-4 focus:ring-[#e4f5e7]"
            />
          </div>

          {/* BUTTON */}
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={submitting || loading}
            className="mt-4 w-full rounded-xl bg-[#d83232] py-3.5 text-sm font-extrabold text-white transition hover:bg-[#c92b2b] active:scale-[0.99] disabled:opacity-50"
          >
            {submitting
              ? "Submitting..."
              : "Withdraw"}
          </button>

        </section>
      </div>

      {/* CONFIRM WITHDRAWAL POPUP */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-5 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl text-red-600">
              💸
            </div>

            <h2 className="mt-4 text-center text-xl font-black text-[#18221c]">
              Are you sure you want to withdraw?
            </h2>

            <div className="mt-4 rounded-2xl border border-emerald-100 bg-[#f7faf7] p-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-[#89918b]">
                Withdrawal Details
              </p>

              <div className="rounded-xl border border-emerald-100 bg-white px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[#747e76]">
                    UPI Holder
                  </span>
                  <span className="max-w-[190px] truncate text-right text-sm font-black text-[#18221c]">
                    {upiHolderName.trim()}
                  </span>
                </div>

                <div className="mt-2 border-t border-[#edf1ed] pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-[#747e76]">
                      UPI ID
                    </span>
                    <span className="max-w-[190px] truncate text-right text-sm font-black text-[#18221c]">
                      {upiId.trim()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex justify-between text-sm">
                <span className="text-[#747e76]">Withdrawal Amount</span>
                <span className="font-bold">
                  ₹{Number(numericAmount || 0).toFixed(2)}
                </span>
              </div>

              <div className="mt-2 flex justify-between text-sm">
                <span className="text-[#747e76]">Service Charge</span>
                <span className="font-bold text-[#d32f2f]">-₹5.00</span>
              </div>

              <div className="my-3 border-t border-[#e1e7e2]" />

              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold">You&apos;ll Receive</span>
                <span className="text-xl font-black text-[#25803c]">
                  ₹{receiveAmount.toFixed(2)}
                </span>
              </div>

              <div className="mt-3 rounded-xl bg-[#edfaef] px-3 py-2.5">
                <p className="text-center text-[11px] font-bold leading-5 text-[#25803c]">
                  Money will be credited to this UPI within 30 mins after processing.
                </p>
              </div>
            </div>

            <p className="mt-3 text-center text-[10px] font-semibold text-[#89918b]">
              Please verify your UPI ID and amount before confirming.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 text-sm font-extrabold text-gray-700 transition hover:bg-gray-100 active:scale-[0.99] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={async () => {
                  setShowConfirm(false);
                  await submitWithdrawal();
                }}
                disabled={submitting}
                className="w-full rounded-xl bg-[#d83232] py-3 text-sm font-extrabold text-white transition hover:bg-[#c92b2b] active:scale-[0.99] disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Withdraw"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS POPUP */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-5 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e5f7e8] text-3xl text-[#25803c]">
              ✓
            </div>

            <h2 className="mt-4 text-xl font-black text-[#18221c]">
              Withdrawal Request Submitted
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#69746c]">
              Your withdrawal request has been successfully
              submitted.
            </p>

            <div className="mt-4 rounded-xl bg-[#edfaef] px-4 py-3">
              <p className="text-sm font-bold text-[#25803c]">
                Money will be credited in your bank UPI within 30 mins.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSuccess(false)}
              className="mt-5 w-full rounded-xl bg-[#d83232] py-3 text-sm font-extrabold text-white hover:bg-[#c92b2b]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </main>
  );
}