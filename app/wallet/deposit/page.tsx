"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DepositPage() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const [minDeposit, setMinDeposit] = useState(10);
  const [bonusPercent, setBonusPercent] = useState(10);

  const [error, setError] = useState("");

  // ==========================================
  // LOAD WALLET SETTINGS
  // ==========================================

  useEffect(() => {
    async function loadSettings() {
      try {
        setSettingsLoading(true);

        const { data, error } = await supabase
          .from("app_settings")
          .select("key, value")
          .in("key", [
            "min_deposit_amount",
            "deposit_bonus_percent",
          ]);

        if (error) {
          console.error("Wallet settings error:", error);

          // Keep safe default values if settings cannot be loaded
          setMinDeposit(10);
          setBonusPercent(10);

          return;
        }

        let minimum = 10;
        let bonus = 10;

        for (const setting of data || []) {
          if (setting.key === "min_deposit_amount") {
            const value = Number(setting.value);

            if (Number.isFinite(value) && value > 0) {
              minimum = value;
            }
          }

          if (setting.key === "deposit_bonus_percent") {
            const value = Number(setting.value);

            if (
              Number.isFinite(value) &&
              value >= 0 &&
              value <= 100
            ) {
              bonus = value;
            }
          }
        }

        setMinDeposit(minimum);
        setBonusPercent(bonus);
      } catch (error) {
        console.error("Settings loading failed:", error);

        setMinDeposit(10);
        setBonusPercent(10);
      } finally {
        setSettingsLoading(false);
      }
    }

    loadSettings();
  }, []);

  // ==========================================
  // CALCULATIONS
  // ==========================================

  const depositAmount = Number(amount || 0);

  const bonusAmount =
    depositAmount > 0
      ? (depositAmount * bonusPercent) / 100
      : 0;

  const totalWalletCredit =
    depositAmount + bonusAmount;

  // ==========================================
  // HANDLE DEPOSIT
  // ==========================================

  async function handleDeposit() {
    setError("");

    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      setError("Please enter a valid deposit amount.");
      return;
    }

    if (value < minDeposit) {
      setError(
        `Minimum deposit amount is ₹${minDeposit}.`
      );
      return;
    }

    if (
      Math.round(value * 100) !==
      value * 100
    ) {
      setError(
        "Amount can have maximum 2 decimal places."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "/api/deposit/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: value,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Unable to create payment."
        );
        return;
      }

      if (!data.paymentUrl) {
        setError(
          "Payment link was not received."
        );
        return;
      }

      window.location.href =
        data.paymentUrl;
    } catch {
      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // QUICK AMOUNTS
  // ==========================================

  const quickAmounts = [
    50,
    100,
    200,
    500,
  ].filter(
    (value) => value >= minDeposit
  );

  return (
    <main className="min-h-screen bg-[#f5f8f5] text-[#18221c]">
      {/* ========================================
          HEADER
      ======================================== */}

      <header className="border-b border-[#dfe8e1] bg-white">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
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

          <h1 className="text-base font-extrabold">
            Add Money
          </h1>

          <div className="w-14" />
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-5">
        {/* ========================================
            ERROR
        ======================================== */}

        {error && (
          <div className="mb-4 rounded-xl border border-[#f1c1c1] bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#c62828]">
            {error}
          </div>
        )}

        {/* ========================================
            INFO
        ======================================== */}

        <section className="rounded-2xl border border-[#cfe6d4] bg-[#edfaef] p-5">
          <p className="text-xs font-semibold text-[#657169]">
            Add money to your GamerzAdda wallet
          </p>

          {!settingsLoading && (
            <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-[#25803c]">
              🎁 Get {bonusPercent}% extra bonus on
              your deposit
            </div>
          )}
        </section>

        {/* ========================================
            DEPOSIT CARD
        ======================================== */}

        <section className="mt-4 rounded-2xl border border-[#e0e6e1] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-extrabold">
            Deposit Amount
          </h2>

          {/* SETTINGS LOADING */}

          {settingsLoading ? (
            <div className="mt-5 rounded-xl bg-[#f7faf7] p-4 text-center text-sm font-semibold text-[#747e76]">
              Loading deposit settings...
            </div>
          ) : (
            <>
              {/* MINIMUM DEPOSIT */}

              <div className="mt-2 text-xs font-semibold text-[#7a847c]">
                Minimum deposit: ₹
                {minDeposit}
              </div>

              {/* AMOUNT INPUT */}

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
                    min={minDeposit}
                    step="0.01"
                    value={amount}
                    onChange={(e) => {
                      setAmount(
                        e.target.value
                      );
                      setError("");
                    }}
                    placeholder={`Enter amount (Min ₹${minDeposit})`}
                    className="w-full rounded-xl border border-[#dce3de] bg-[#fafcfb] py-3.5 pl-9 pr-3 font-bold outline-none focus:border-[#83c792] focus:ring-4 focus:ring-[#e4f5e7]"
                  />
                </div>

                {/* QUICK AMOUNTS */}

                {quickAmounts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {quickAmounts.map(
                      (value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setAmount(
                              String(value)
                            );
                            setError("");
                          }}
                          className="rounded-lg border border-[#dce5df] bg-[#f8faf8] px-3 py-2 text-[11px] font-bold text-[#536058] hover:bg-[#eff9f1]"
                        >
                          ₹{value}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* ====================================
                  WALLET CALCULATION
              ==================================== */}

              <div className="mt-5 rounded-xl bg-[#f7faf7] p-4">
                {/* DEPOSIT */}

                <div className="flex justify-between text-sm">
                  <span className="text-[#747e76]">
                    Deposit Amount
                  </span>

                  <span className="font-bold">
                    ₹
                    {depositAmount.toFixed(
                      2
                    )}
                  </span>
                </div>

                {/* BONUS */}

                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-[#25803c]">
                    Deposit Bonus (
                    {bonusPercent}%)
                  </span>

                  <span className="font-bold text-[#25803c]">
                    + ₹
                    {bonusAmount.toFixed(
                      2
                    )}
                  </span>
                </div>

                <div className="my-3 border-t border-[#e1e7e2]" />

                {/* TOTAL */}

                <div className="flex justify-between">
                  <span className="text-sm font-extrabold">
                    Total Wallet Credit
                  </span>

                  <span className="text-lg font-black text-[#25803c]">
                    ₹
                    {totalWalletCredit.toFixed(
                      2
                    )}
                  </span>
                </div>
              </div>

              {/* BONUS MESSAGE */}

              {depositAmount >= minDeposit &&
                depositAmount > 0 && (
                  <div className="mt-3 rounded-xl border border-[#cfe6d4] bg-[#edfaef] px-4 py-3 text-center text-xs font-bold text-[#25803c]">
                    🎁 You will receive ₹
                    {bonusAmount.toFixed(
                      2
                    )}{" "}
                    bonus
                  </div>
                )}

              {/* PAYMENT BUTTON */}

              <button
                type="button"
                onClick={handleDeposit}
                disabled={loading}
                className="mt-4 w-full rounded-xl bg-[#d83232] py-3.5 text-sm font-extrabold text-white transition hover:bg-[#c92b2b] active:scale-[0.99] disabled:opacity-50"
              >
                {loading
                  ? "Creating Payment..."
                  : "Proceed to Payment"}
              </button>

              <p className="mt-3 text-center text-[10px] text-[#89918b]">
                You will be redirected to the
                payment page.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}