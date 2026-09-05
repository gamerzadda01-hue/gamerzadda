"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Withdrawal = {
  id: string;
  user_id: string;
  amount: number;
  upi_id: string;
  status: string;
  service_charge: number | null;
  net_amount: number | null;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;

  users?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    game_name?: string | null;
    free_fire_uid?: string | null;
  } | null;
};

const tabs = [
  {
    key: "pending",
    label: "Pending",
  },
  {
    key: "approved",
    label: "Approved",
  },
  {
    key: "rejected",
    label: "Rejected",
  },
  {
    key: "all",
    label: "All",
  },
];

function money(
  value: number | null | undefined
) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function formatDate(value: string) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  } catch {
    return value;
  }
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] =
    useState<Withdrawal[]>([]);

  const [status, setStatus] =
    useState("pending");

  const [loading, setLoading] =
    useState(true);

  const [processing, setProcessing] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token || null;
  }

  async function loadWithdrawals() {
    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      if (!token) {
        window.location.href =
          "/admin/login";
        return;
      }

      const response = await fetch(
        `/api/admin/withdrawals?status=${encodeURIComponent(
          status
        )}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const text =
        await response.text();

      let data: any = {};

      try {
        data = JSON.parse(text);
      } catch {
        data = {
          error:
            text ||
            `Server returned ${response.status}`,
        };
      }

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href =
            "/admin/login";
          return;
        }

        setError(
          data.error ||
            "Unable to load withdrawals."
        );

        setWithdrawals([]);
        return;
      }

      setWithdrawals(
        data.withdrawals || []
      );
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to load withdrawals."
      );

      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWithdrawals();
  }, [status]);

  async function processWithdrawal(
    withdrawal: Withdrawal,
    action: "approve" | "reject"
  ) {
    if (action === "approve") {
      const ok = window.confirm(
        `Approve ${money(
          withdrawal.net_amount ??
            withdrawal.amount
        )} payment to ${
          withdrawal.upi_id
        }?`
      );

      if (!ok) return;
    }

    let note = "";

    if (action === "reject") {
      const entered =
        window.prompt(
          "Enter rejection reason:"
        );

      if (entered === null) {
        return;
      }

      note = entered.trim();
    }

    setProcessing(withdrawal.id);
    setError("");

    try {
      const token = await getToken();

      if (!token) {
        window.location.href =
          "/admin/login";
        return;
      }

      const response = await fetch(
        "/api/admin/withdrawals",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            withdrawalId:
              withdrawal.id,
            action,
            note,
          }),
        }
      );

      const text =
        await response.text();

      let data: any = {};

      try {
        data = JSON.parse(text);
      } catch {
        data = {
          error:
            text ||
            `Server returned ${response.status}`,
        };
      }

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href =
            "/admin/login";
          return;
        }

        alert(
          data.error ||
            "Unable to process withdrawal."
        );

        return;
      }

      alert(
        action === "approve"
          ? "Withdrawal approved successfully ✅"
          : "Withdrawal rejected and amount refunded ✅"
      );

      await loadWithdrawals();
    } catch (err: any) {
      console.error(err);

      alert(
        err?.message ||
          "Something went wrong."
      );
    } finally {
      setProcessing(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: 1250,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              Withdrawal Management
            </h1>

            <p
              style={{
                margin:
                  "6px 0 0",
                color: "#666",
                fontSize: 14,
              }}
            >
              Review and process user
              withdrawal requests.
            </p>
          </div>

          <button
            onClick={loadWithdrawals}
            disabled={loading}
            style={{
              border: "none",
              borderRadius: 10,
              padding:
                "11px 16px",
              background: "#111827",
              color: "#fff",
              fontWeight: 800,
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() =>
                setStatus(tab.key)
              }
              style={{
                border:
                  "1px solid #ddd",
                borderRadius: 10,
                padding:
                  "10px 16px",
                background:
                  status === tab.key
                    ? "#111827"
                    : "#fff",
                color:
                  status === tab.key
                    ? "#fff"
                    : "#333",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border:
                "1px solid #fecaca",
              color: "#b91c1c",
              padding: 14,
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 14,
              fontWeight: 700,
              whiteSpace:
                "pre-wrap",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 50,
              textAlign: "center",
              color: "#666",
            }}
          >
            Loading withdrawals...
          </div>
        ) : withdrawals.length ===
          0 ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 60,
              textAlign: "center",
              color: "#777",
            }}
          >
            <div
              style={{
                fontSize: 42,
              }}
            >
              💸
            </div>

            <h3
              style={{
                color: "#222",
              }}
            >
              No{" "}
              {status === "all"
                ? ""
                : status}{" "}
              withdrawals
            </h3>

            <p>
              Withdrawal requests
              will appear here.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 14,
            }}
          >
            {withdrawals.map(
              (w) => (
                <div
                  key={w.id}
                  style={{
                    background: "#fff",
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: 20,
                    boxShadow:
                      "0 2px 10px rgba(0,0,0,.04)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(250px,1.5fr) minmax(190px,1fr) minmax(170px,.8fr) auto",
                      gap: 20,
                      alignItems:
                        "center",
                    }}
                  >
                    {/* USER */}
                    <div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 900,
                          color: "#111",
                        }}
                      >
                        {w.users
                          ?.full_name ||
                          "Unknown User"}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#333",
                        }}
                      >
                        🎮{" "}
                        {w.users
                          ?.game_name ||
                          "-"}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          color: "#555",
                        }}
                      >
                        📱{" "}
                        {w.users
                          ?.phone ||
                          "-"}
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 13,
                          color: "#555",
                        }}
                      >
                        📧{" "}
                        {w.users
                          ?.email ||
                          "-"}
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 13,
                          color: "#555",
                        }}
                      >
                        UID:{" "}
                        <strong>
                          {w.users
                            ?.free_fire_uid ||
                            "-"}
                        </strong>
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          color: "#999",
                        }}
                      >
                        Requested:{" "}
                        {formatDate(
                          w.created_at
                        )}
                      </div>

                      {w.processed_at && (
                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 11,
                            color: "#999",
                          }}
                        >
                          Processed:{" "}
                          {formatDate(
                            w.processed_at
                          )}
                        </div>
                      )}
                    </div>

                    {/* UPI */}
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#777",
                        }}
                      >
                        UPI ID
                      </div>

                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 15,
                          fontWeight: 900,
                          wordBreak:
                            "break-all",
                          color: "#111",
                        }}
                      >
                        {w.upi_id}
                      </div>
                    </div>

                    {/* AMOUNT */}
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#777",
                        }}
                      >
                        Requested Amount
                      </div>

                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 23,
                          fontWeight: 900,
                        }}
                      >
                        {money(
                          w.amount
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                          color: "#777",
                        }}
                      >
                        Service Charge:{" "}
                        {money(
                          w.service_charge
                        )}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 15,
                          color: "#15803d",
                          fontWeight: 900,
                        }}
                      >
                        Pay:{" "}
                        {money(
                          w.net_amount
                        )}
                      </div>
                    </div>

                    {/* STATUS / ACTION */}
                    <div
                      style={{
                        textAlign:
                          "right",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "inline-block",
                          padding:
                            "7px 11px",
                          borderRadius:
                            999,
                          background:
                            w.status ===
                            "pending"
                              ? "#fff7ed"
                              : w.status ===
                                "approved"
                              ? "#ecfdf5"
                              : "#fef2f2",
                          color:
                            w.status ===
                            "pending"
                              ? "#c2410c"
                              : w.status ===
                                "approved"
                              ? "#15803d"
                              : "#b91c1c",
                          fontSize: 12,
                          fontWeight: 900,
                          textTransform:
                            "capitalize",
                        }}
                      >
                        {w.status}
                      </div>

                      {w.status ===
                        "pending" && (
                        <div
                          style={{
                            display:
                              "flex",
                            gap: 8,
                            marginTop: 12,
                            justifyContent:
                              "flex-end",
                          }}
                        >
                          <button
                            disabled={
                              processing ===
                              w.id
                            }
                            onClick={() =>
                              processWithdrawal(
                                w,
                                "approve"
                              )
                            }
                            style={{
                              border:
                                "none",
                              borderRadius:
                                8,
                              padding:
                                "9px 12px",
                              background:
                                "#16a34a",
                              color:
                                "#fff",
                              fontWeight:
                                900,
                              cursor:
                                processing ===
                                w.id
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {processing ===
                            w.id
                              ? "..."
                              : "✓ Approve"}
                          </button>

                          <button
                            disabled={
                              processing ===
                              w.id
                            }
                            onClick={() =>
                              processWithdrawal(
                                w,
                                "reject"
                              )
                            }
                            style={{
                              border:
                                "none",
                              borderRadius:
                                8,
                              padding:
                                "9px 12px",
                              background:
                                "#dc2626",
                              color:
                                "#fff",
                              fontWeight:
                                900,
                              cursor:
                                processing ===
                                w.id
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {processing ===
                            w.id
                              ? "..."
                              : "✕ Reject"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {w.admin_note && (
                    <div
                      style={{
                        marginTop: 16,
                        padding: 12,
                        background:
                          "#f8fafc",
                        borderRadius: 9,
                        fontSize: 13,
                        color: "#444",
                      }}
                    >
                      <strong>
                        Admin Note:
                      </strong>{" "}
                      {w.admin_note}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}