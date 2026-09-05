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
    email?: string | null;
    game_name?: string | null;
    free_fire_uid?: string | null;
  } | null;
};

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadWithdrawals() {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      window.location.href = "/admin/login";
      return;
    }

    const response = await fetch(
      `/api/admin/withdrawals?status=${encodeURIComponent(status)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      alert(data.error || "Unable to load withdrawals.");
      setLoading(false);
      return;
    }

    setWithdrawals(data.withdrawals || []);
    setLoading(false);
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
        `Approve ₹${Number(withdrawal.net_amount ?? withdrawal.amount).toFixed(2)} to ${withdrawal.upi_id}?`
      );
      if (!ok) return;
    } else {
      const note = window.prompt("Rejection reason:");
      if (note === null) return;

      await submitAction(withdrawal, action, note);
      return;
    }

    await submitAction(withdrawal, action, "");
  }

  async function submitAction(
    withdrawal: Withdrawal,
    action: "approve" | "reject",
    note: string
  ) {
    setProcessing(withdrawal.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        alert("Admin session expired. Please login again.");
        window.location.href = "/admin/login";
        return;
      }

      const response = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          withdrawalId: withdrawal.id,
          action,
          note,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Unable to process withdrawal.");
        return;
      }

      alert(
        action === "approve"
          ? "Withdrawal approved successfully ✅"
          : "Withdrawal rejected and amount refunded ✅"
      );

      await loadWithdrawals();
    } catch (error: any) {
      alert(error?.message || "Something went wrong.");
    } finally {
      setProcessing(null);
    }
  }

  function money(value: number | null | undefined) {
    return `₹${Number(value || 0).toFixed(2)}`;
  }

  function date(value: string) {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 15,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>💸 Withdrawal Management</h1>
            <p style={{ color: "#666", marginTop: 6 }}>
              Review and process user withdrawal requests.
            </p>
          </div>

          <button
            onClick={loadWithdrawals}
            style={{
              padding: "11px 16px",
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🔄 Refresh
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          {[
            ["pending", "⏳ Pending"],
            ["approved", "✅ Approved"],
            ["rejected", "❌ Rejected"],
            ["all", "📋 All"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              style={{
                padding: "10px 15px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: status === value ? "#111" : "#fff",
                color: status === value ? "#fff" : "#222",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 40,
              textAlign: "center",
            }}
          >
            Loading withdrawals...
          </div>
        ) : withdrawals.length === 0 ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 50,
              textAlign: "center",
              color: "#777",
            }}
          >
            <div style={{ fontSize: 40 }}>💸</div>
            <h3>No {status === "all" ? "" : status} withdrawals</h3>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {withdrawals.map((w) => (
              <div
                key={w.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e5e5",
                  borderRadius: 14,
                  padding: 18,
                  boxShadow: "0 2px 8px rgba(0,0,0,.04)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(220px,1.4fr) minmax(180px,1fr) minmax(160px,.8fr) auto",
                    gap: 18,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>
                      {w.users?.game_name || "Unknown User"}
                    </div>
                    <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
                      {w.users?.email || "-"}
                    </div>
                    <div style={{ color: "#666", fontSize: 12, marginTop: 3 }}>
                      UID: {w.users?.free_fire_uid || "-"}
                    </div>
                    <div style={{ color: "#999", fontSize: 11, marginTop: 7 }}>
                      {date(w.created_at)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "#777" }}>UPI ID</div>
                    <div
                      style={{
                        fontWeight: 800,
                        marginTop: 4,
                        wordBreak: "break-all",
                      }}
                    >
                      {w.upi_id}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: "#777" }}>
                      Requested
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900 }}>
                      {money(w.amount)}
                    </div>
                    <div style={{ fontSize: 12, color: "#777" }}>
                      Charge: -{money(w.service_charge)}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#15803d",
                        fontWeight: 800,
                      }}
                    >
                      Pay: {money(w.net_amount)}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "inline-block",
                        padding: "6px 10px",
                        borderRadius: 999,
                        background:
                          w.status === "pending"
                            ? "#fff7ed"
                            : w.status === "approved"
                            ? "#ecfdf5"
                            : "#fef2f2",
                        color:
                          w.status === "pending"
                            ? "#c2410c"
                            : w.status === "approved"
                            ? "#15803d"
                            : "#b91c1c",
                        fontSize: 12,
                        fontWeight: 800,
                        textTransform: "capitalize",
                      }}
                    >
                      {w.status}
                    </div>

                    {w.status === "pending" && (
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 12,
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          disabled={processing === w.id}
                          onClick={() => processWithdrawal(w, "approve")}
                          style={{
                            padding: "9px 12px",
                            border: "none",
                            borderRadius: 8,
                            background: "#16a34a",
                            color: "#fff",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {processing === w.id ? "..." : "✓ Approve"}
                        </button>

                        <button
                          disabled={processing === w.id}
                          onClick={() => processWithdrawal(w, "reject")}
                          style={{
                            padding: "9px 12px",
                            border: "none",
                            borderRadius: 8,
                            background: "#dc2626",
                            color: "#fff",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {processing === w.id ? "..." : "✕ Reject"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {w.admin_note && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 10,
                      background: "#f8f8f8",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    <strong>Admin note:</strong> {w.admin_note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
