"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Member = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  game_name: string | null;
  free_fire_uid: string | null;
  role: string | null;
  created_at: string | null;
};

type Wallet = {
  deposit_balance: number;
  bonus_balance: number;
  winning_balance: number;
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  async function checkAdminAndLoad() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/admin/login";
        return;
      }

      const { data: admin } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!admin || admin.role !== "admin") {
        await supabase.auth.signOut();
        window.location.href = "/admin/login";
        return;
      }

      await loadMembers();
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  }

  async function loadMembers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("users")
      .select(
        "id,full_name,email,phone,game_name,free_fire_uid,role,created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Members loading error:", error);
      alert("Members loading failed: " + error.message);
      setLoading(false);
      return;
    }

    setMembers(data || []);
    setLoading(false);
  }

  async function openMember(member: Member) {
    setSelected(member);
    setWallet(null);
    setWalletLoading(true);

    const { data, error } = await supabase
      .from("wallet_balances")
      .select("deposit_balance,bonus_balance,winning_balance")
      .eq("user_id", member.id)
      .maybeSingle();

    if (error) {
      console.error("Wallet loading error:", error);
    }

    setWallet(data || {
      deposit_balance: 0,
      bonus_balance: 0,
      winning_balance: 0,
    });

    setWalletLoading(false);
  }

  function money(value: number | null | undefined) {
    return `₹${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value: string | null) {
    if (!value) return "-";

    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return members;

    return members.filter((member) =>
      [
        member.full_name,
        member.email,
        member.phone,
        member.game_name,
        member.free_fire_uid,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [members, search]);

  return (
    <main className="members-page">
      <style jsx>{`
        .members-page {
          min-height: 100vh;
          padding: 24px;
          background: #f5f7fb;
          color: #111827;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 20px;
        }

        .eyebrow {
          color: #e9163a;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1.8px;
        }

        h1 {
          margin: 5px 0 0;
          font-size: 28px;
          font-weight: 900;
          color: #111827;
        }

        .subtitle {
          margin-top: 6px;
          color: #64748b;
          font-size: 12px;
        }

        .refresh {
          border: 0;
          border-radius: 9px;
          padding: 11px 17px;
          background: #111827;
          color: white;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .toolbar {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 15px;
        }

        .search {
          flex: 1;
          height: 44px;
          border: 1px solid #dbe1ea;
          border-radius: 10px;
          padding: 0 14px;
          outline: none;
          background: white;
          color: #111827;
          font-size: 12px;
        }

        .search:focus {
          border-color: #e9163a;
          box-shadow: 0 0 0 3px rgba(233, 22, 58, 0.08);
        }

        .count {
          padding: 12px 15px;
          border-radius: 10px;
          background: white;
          border: 1px solid #e1e6ee;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .table-wrap {
          overflow-x: auto;
          background: white;
          border: 1px solid #e1e6ee;
          border-radius: 13px;
          box-shadow: 0 5px 20px rgba(15, 23, 42, 0.04);
        }

        table {
          width: 100%;
          min-width: 900px;
          border-collapse: collapse;
        }

        th {
          padding: 13px 15px;
          text-align: left;
          background: #f8fafc;
          color: #64748b;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          font-weight: 900;
          border-bottom: 1px solid #e5e7eb;
        }

        td {
          padding: 14px 15px;
          border-bottom: 1px solid #eef1f5;
          font-size: 11px;
          color: #334155;
        }

        tr:last-child td {
          border-bottom: 0;
        }

        tbody tr {
          cursor: pointer;
          transition: 0.15s ease;
        }

        tbody tr:hover {
          background: #fafbfc;
        }

        .name {
          font-weight: 800;
          color: #111827;
        }

        .muted {
          margin-top: 3px;
          color: #94a3b8;
          font-size: 9px;
        }

        .uid {
          font-family: monospace;
          font-weight: 700;
          color: #475569;
        }

        .role {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 6px;
          background: #f1f5f9;
          color: #475569;
          font-size: 9px;
          font-weight: 800;
          text-transform: capitalize;
        }

        .view {
          border: 1px solid #e2e8f0;
          background: white;
          color: #e9163a;
          border-radius: 7px;
          padding: 7px 10px;
          font-size: 9px;
          font-weight: 900;
          cursor: pointer;
        }

        .empty {
          padding: 50px 20px;
          text-align: center;
          color: #94a3b8;
          font-size: 12px;
        }

        .overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          justify-content: flex-end;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(3px);
        }

        .drawer {
          width: 430px;
          max-width: 94vw;
          height: 100%;
          overflow-y: auto;
          padding: 22px;
          background: white;
          box-shadow: -10px 0 35px rgba(0, 0, 0, 0.15);
        }

        .drawer-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
        }

        .drawer-head h2 {
          margin: 0;
          font-size: 19px;
          font-weight: 900;
        }

        .close {
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          cursor: pointer;
          font-size: 16px;
        }

        .profile {
          padding: 16px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          margin-bottom: 14px;
        }

        .profile-name {
          font-size: 18px;
          font-weight: 900;
          color: #111827;
        }

        .profile-email {
          margin-top: 4px;
          color: #64748b;
          font-size: 10px;
        }

        .details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 14px;
        }

        .detail {
          padding: 11px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: white;
        }

        .detail-label {
          color: #94a3b8;
          font-size: 8px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .detail-value {
          margin-top: 4px;
          color: #1e293b;
          font-size: 11px;
          font-weight: 800;
          word-break: break-word;
        }

        .wallet-title {
          margin: 20px 0 10px;
          font-size: 13px;
          font-weight: 900;
        }

        .wallet-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 9px;
        }

        .wallet-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 13px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
        }

        .wallet-card span {
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
        }

        .wallet-card strong {
          font-size: 14px;
          color: #111827;
        }

        .total {
          margin-top: 9px;
          padding: 15px;
          border-radius: 10px;
          background: #111827;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .total span {
          font-size: 10px;
          color: #cbd5e1;
        }

        .total strong {
          font-size: 17px;
        }

        @media (max-width: 650px) {
          .members-page {
            padding: 14px;
          }

          .header {
            align-items: flex-start;
          }

          h1 {
            font-size: 22px;
          }

          .refresh {
            padding: 9px 11px;
          }

          .toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .count {
            text-align: center;
          }
        }
      `}</style>

      <div className="header">
        <div>
          <div className="eyebrow">GAMERZADDA ADMIN</div>
          <h1>Member Database</h1>
          <div className="subtitle">
            Search and inspect registered GamerzAdda members.
          </div>
        </div>

        <button className="refresh" onClick={loadMembers}>
          ↻ Refresh
        </button>
      </div>

      <div className="toolbar">
        <input
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, game name or Free Fire UID..."
        />

        <div className="count">
          {filteredMembers.length} Members
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty">Loading members...</div>
        ) : filteredMembers.length === 0 ? (
          <div className="empty">No members found.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Phone</th>
                <th>Game Name</th>
                <th>Free Fire UID</th>
                <th>Role</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredMembers.map((member) => (
                <tr
                  key={member.id}
                  onClick={() => openMember(member)}
                >
                  <td>
                    <div className="name">
                      {member.full_name || "Unnamed User"}
                    </div>
                    <div className="muted">
                      {member.email || "-"}
                    </div>
                  </td>

                  <td>{member.phone || "-"}</td>

                  <td>
                    {member.game_name || "-"}
                  </td>

                  <td className="uid">
                    {member.free_fire_uid || "-"}
                  </td>

                  <td>
                    <span className="role">
                      {member.role || "user"}
                    </span>
                  </td>

                  <td>
                    {formatDate(member.created_at)}
                  </td>

                  <td>
                    <button
                      className="view"
                      onClick={(e) => {
                        e.stopPropagation();
                        openMember(member);
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div
          className="overlay"
          onClick={() => setSelected(null)}
        >
          <aside
            className="drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-head">
              <h2>Member Details</h2>

              <button
                className="close"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </div>

            <div className="profile">
              <div className="profile-name">
                {selected.full_name || "Unnamed User"}
              </div>

              <div className="profile-email">
                {selected.email || "-"}
              </div>

              <div className="details">
                <div className="detail">
                  <div className="detail-label">
                    Phone
                  </div>
                  <div className="detail-value">
                    {selected.phone || "-"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Game Name
                  </div>
                  <div className="detail-value">
                    {selected.game_name || "-"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Free Fire UID
                  </div>
                  <div className="detail-value">
                    {selected.free_fire_uid || "-"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Role
                  </div>
                  <div className="detail-value">
                    {selected.role || "user"}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Member ID
                  </div>
                  <div className="detail-value">
                    {selected.id}
                  </div>
                </div>

                <div className="detail">
                  <div className="detail-label">
                    Joined
                  </div>
                  <div className="detail-value">
                    {formatDate(selected.created_at)}
                  </div>
                </div>
              </div>
            </div>

            <div className="wallet-title">
              Wallet Balances
            </div>

            {walletLoading ? (
              <div className="empty">
                Loading wallet...
              </div>
            ) : (
              <>
                <div className="wallet-grid">
                  <div className="wallet-card">
                    <span>Deposit Balance</span>
                    <strong>
                      {money(wallet?.deposit_balance)}
                    </strong>
                  </div>

                  <div className="wallet-card">
                    <span>Bonus Balance</span>
                    <strong>
                      {money(wallet?.bonus_balance)}
                    </strong>
                  </div>

                  <div className="wallet-card">
                    <span>Winning Balance</span>
                    <strong>
                      {money(wallet?.winning_balance)}
                    </strong>
                  </div>
                </div>

                <div className="total">
                  <span>Total Wallet Balance</span>

                  <strong>
                    {money(
                      Number(wallet?.deposit_balance || 0) +
                        Number(wallet?.bonus_balance || 0) +
                        Number(wallet?.winning_balance || 0)
                    )}
                  </strong>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}