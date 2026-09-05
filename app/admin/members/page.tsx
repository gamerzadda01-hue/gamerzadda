"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Member = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  free_fire_uid: string | null;
  role: string | null;
  created_at: string | null;
  ip_address: string | null;
  game_name: string | null;
  status: string | null;
  wallet_total: number;
  last_wallet_activity: string | null;
};

type Wallet = {
  deposit_balance: number | null;
  bonus_balance: number | null;
  winning_balance: number | null;
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("newest");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [savingWallet, setSavingWallet] = useState(false);
  const [walletType, setWalletType] = useState("deposit");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Admin login required.");
      }

      const response = await fetch("/api/admin/members", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const raw = await response.text();
      let result: any = null;

      try {
        result = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(raw || "Unable to load members.");
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to load members.");
      }

      setMembers(result.members || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unable to load members.");
    } finally {
      setLoading(false);
    }
  }

  async function openMember(member: Member) {
    setSelectedMember(member);
    setWallet(null);
    setHistory([]);
    setActionMessage("");
    setWalletLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Admin login required.");
      }

      const response = await fetch(
        `/api/admin/members?userId=${encodeURIComponent(member.id)}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const raw = await response.text();
      let result: any = null;

      try {
        result = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(raw || "Unable to load wallet.");
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to load wallet.");
      }

      setWallet(result.wallet || null);
      setHistory(result.history || []);
    } catch (err) {
      console.error(err);
      setWallet(null);
      setHistory([]);
    } finally {
      setWalletLoading(false);
    }
  }

  async function adjustWallet() {
    if (!selectedMember) return;

    const amount = Number(adjustAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      setActionMessage("Enter a valid amount. Use negative value to deduct.");
      return;
    }

    if (Math.round(amount * 100) / 100 !== amount) {
      setActionMessage("Maximum 2 decimal places allowed.");
      return;
    }

    setSavingWallet(true);
    setActionMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Admin login required.");

      const response = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          userId: selectedMember.id,
          walletType,
          amount,
          note: adjustNote || "Admin wallet adjustment",
        }),
      });

      const raw = await response.text();
      const result = raw ? JSON.parse(raw) : null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to change wallet.");
      }

      setWallet(result.wallet || null);
      setHistory((old) => [result.transaction, ...old].filter(Boolean));
      setAdjustAmount("");
      setAdjustNote("");
      setActionMessage("Wallet updated successfully.");
      await loadMembers();
    } catch (err: any) {
      console.error(err);
      setActionMessage(err?.message || "Unable to change wallet.");
    } finally {
      setSavingWallet(false);
    }
  }

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();

    let result = members.filter((member) => {
      if (!q) return true;

      return [
        member.id,
        member.full_name,
        member.phone,
        member.email,
        member.free_fire_uid,
        member.game_name,
        member.role,
        member.status,
        member.ip_address,
      ].some((value) =>
        String(value || "").toLowerCase().includes(q)
      );
    });

    const sevenDaysAgo =
      Date.now() - 7 * 24 * 60 * 60 * 1000;

    if (filter === "active") {
      result = result.filter(
        (member) =>
          !!member.last_wallet_activity &&
          new Date(member.last_wallet_activity).getTime() >=
            sevenDaysAgo
      );
    }

    if (filter === "inactive") {
      result = result.filter(
        (member) =>
          !member.last_wallet_activity ||
          new Date(member.last_wallet_activity).getTime() <
            sevenDaysAgo
      );
    }

    if (filter === "restricted") {
      result = result.filter(
        (member) =>
          String(member.status || "").toLowerCase() ===
          "restricted"
      );
    }

    result.sort((a, b) => {
      if (filter === "oldest") {
        return (
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime()
        );
      }

      if (filter === "wallet-low") {
        return a.wallet_total - b.wallet_total;
      }

      if (filter === "wallet-high") {
        return b.wallet_total - a.wallet_total;
      }

      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });

    return result;
  }, [members, search, filter]);

  function formatDate(date: string | null) {
    if (!date) return "-";

    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function shortId(id: string) {
    if (!id) return "-";
    return `${id.slice(0, 8)}...${id.slice(-6)}`;
  }

  function money(value: number | null | undefined) {
    return `₹${Number(value || 0).toFixed(2)}`;
  }

  return (
    <div className="members-page">
      <style jsx>{`
        .members-page {
          min-height: 100vh;
          padding: 24px;
          background: #070b12;
          color: #e9eef7;
          box-sizing: border-box;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 20px;
        }

        .title {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
        }

        .subtitle {
          margin: 6px 0 0;
          color: #7f8ca1;
          font-size: 11px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .count {
          padding: 8px 11px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          background: #0d1520;
          color: #aeb9c9;
          font-size: 10px;
          font-weight: 800;
        }

        .refresh {
          border: 1px solid #263448;
          background: #101925;
          color: #e9eef7;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .refresh:hover {
          background: #172334;
        }

        .toolbar {
          margin-bottom: 14px;
        }

        .search {
          width: 100%;
          height: 42px;
          box-sizing: border-box;
          border: 1px solid #1d2a3b;
          border-radius: 9px;
          outline: none;
          padding: 0 14px;
          background: #0d1520;
          color: #fff;
          font-size: 11px;
        }

        .search::placeholder {
          color: #5f6d81;
        }

        .search:focus {
          border-color: #ef1638;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #1d2a3b;
          border-radius: 10px;
          background: #0d1520;
        }

        table {
          width: 100%;
          min-width: 1350px;
          border-collapse: collapse;
        }

        th {
          padding: 12px 13px;
          text-align: left;
          background: #101a27;
          color: #68778c;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
          white-space: nowrap;
          border-bottom: 1px solid #1d2a3b;
        }

        td {
          padding: 12px 13px;
          border-bottom: 1px solid #172333;
          color: #c5cfdd;
          font-size: 10px;
          white-space: nowrap;
        }

        tbody tr {
          cursor: pointer;
          transition: background 0.15s ease;
        }

        tbody tr:hover {
          background: #111c2a;
        }

        .member-name {
          color: #fff;
          font-weight: 800;
        }

        .id {
          color: #738197;
          font-family: monospace;
          font-size: 9px;
        }

        .uid {
          color: #f0f4fa;
          font-family: monospace;
          font-weight: 700;
        }

        .email {
          color: #aab6c7;
        }

        .phone {
          color: #d2d9e4;
        }

        .ip {
          color: #8997aa;
          font-family: monospace;
        }

        .filter-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .filter-label {
          color: #68778c;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .filter-select {
          height: 38px;
          min-width: 330px;
          padding: 0 12px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          background: #0d1520;
          color: #e9eef7;
          font-size: 10px;
          font-weight: 700;
          outline: none;
        }

        .filter-select:focus {
          border-color: #ef1638;
        }

        .wallet-total {
          color: #fff;
          font-weight: 900;
        }

        .activity {
          color: #8f9caf;
          font-size: 9px;
        }

        .role {
          display: inline-flex;
          padding: 4px 7px;
          border-radius: 5px;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
        }

        .role.admin {
          background: rgba(239, 22, 56, 0.13);
          color: #ff5069;
          border: 1px solid rgba(239, 22, 56, 0.22);
        }

        .role.user {
          background: rgba(40, 180, 110, 0.1);
          color: #66d69b;
          border: 1px solid rgba(40, 180, 110, 0.18);
        }

        .status {
          color: #66d69b;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .status.blocked {
          color: #ff526b;
        }

        .loading,
        .empty,
        .error {
          padding: 45px 20px;
          text-align: center;
          color: #738197;
          font-size: 11px;
        }

        .error {
          color: #ff647b;
        }

        .drawer-backdrop {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(0, 0, 0, 0.65);
          border: 0;
          padding: 0;
        }

        .drawer {
          position: fixed;
          z-index: 210;
          top: 0;
          right: 0;
          width: 430px;
          max-width: 92vw;
          height: 100vh;
          overflow-y: auto;
          box-sizing: border-box;
          padding: 22px;
          background: #0a111b;
          border-left: 1px solid #253448;
          box-shadow: -20px 0 60px rgba(0, 0, 0, 0.45);
        }

        .drawer-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          margin-bottom: 22px;
        }

        .drawer-title {
          margin: 0;
          font-size: 18px;
          font-weight: 900;
        }

        .drawer-subtitle {
          margin-top: 5px;
          color: #738197;
          font-size: 10px;
        }

        .close {
          width: 32px;
          height: 32px;
          border: 1px solid #263448;
          border-radius: 8px;
          background: #101925;
          color: #fff;
          cursor: pointer;
          font-size: 15px;
        }

        .section {
          margin-top: 18px;
        }

        .section-title {
          margin-bottom: 9px;
          color: #66758a;
          font-size: 8px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          font-weight: 900;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .info {
          padding: 11px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          background: #0e1723;
        }

        .info.full {
          grid-column: 1 / -1;
        }

        .info-label {
          color: #647186;
          font-size: 8px;
          margin-bottom: 5px;
        }

        .info-value {
          color: #edf2f8;
          font-size: 10px;
          font-weight: 700;
          word-break: break-word;
        }

        .wallet-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }

        .wallet-card {
          padding: 12px 9px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          background: #0e1723;
          text-align: center;
        }

        .wallet-label {
          color: #647186;
          font-size: 7px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .wallet-value {
          margin-top: 7px;
          color: #fff;
          font-size: 12px;
          font-weight: 900;
        }

        .edit-box {
          margin-top: 12px;
          padding: 12px;
          border: 1px solid #253448;
          border-radius: 9px;
          background: #0d1520;
        }

        .edit-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 8px;
        }

        .edit-input, .edit-select {
          width: 100%;
          height: 36px;
          box-sizing: border-box;
          border: 1px solid #263448;
          border-radius: 7px;
          background: #101925;
          color: #fff;
          padding: 0 10px;
          font-size: 10px;
          outline: none;
        }

        .edit-note {
          width: 100%;
          height: 54px;
          resize: vertical;
          box-sizing: border-box;
          border: 1px solid #263448;
          border-radius: 7px;
          background: #101925;
          color: #fff;
          padding: 9px 10px;
          font-size: 10px;
          outline: none;
          margin-bottom: 8px;
        }

        .adjust-btn {
          width: 100%;
          height: 36px;
          border: 0;
          border-radius: 7px;
          background: #ef1638;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .adjust-btn:disabled { opacity: .55; cursor: not-allowed; }

        .action-message {
          margin-top: 8px;
          color: #8ed8ae;
          font-size: 9px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 7px;
          max-height: 330px;
          overflow-y: auto;
        }

        .history-item {
          padding: 10px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          background: #0e1723;
        }

        .history-top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .history-amount {
          font-size: 11px;
          font-weight: 900;
        }

        .history-amount.credit { color: #66d69b; }
        .history-amount.debit { color: #ff647b; }

        .history-type {
          color: #718096;
          font-size: 8px;
          text-transform: uppercase;
          font-weight: 800;
        }

        .history-desc {
          margin-top: 5px;
          color: #b1bdcc;
          font-size: 9px;
        }

        .history-date {
          margin-top: 4px;
          color: #65748a;
          font-size: 8px;
        }

        .no-history {
          padding: 15px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          color: #65748a;
          font-size: 9px;
          text-align: center;
        }

        @media (max-width: 700px) {
          .members-page {
            padding: 16px;
          }

          .header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-right {
            width: 100%;
            justify-content: space-between;
          }

          .filter-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .filter-select {
            width: 100%;
            min-width: 0;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .info.full {
            grid-column: auto;
          }

          .wallet-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="header">
        <div>
          <h1 className="title">Member Database</h1>
          <p className="subtitle">
            All registered GamerzAdda members
          </p>
        </div>

        <div className="header-right">
          <div className="count">
            {filteredMembers.length} / {members.length} MEMBERS
          </div>

          <button className="refresh" onClick={loadMembers}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="text"
          placeholder="Search Member ID, Name, Phone, Email, UID, Role or IP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-row">
        <label className="filter-label">FILTER</label>
        <select
          className="filter-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="newest">Newest → Oldest</option>
          <option value="oldest">Oldest → Newest</option>
          <option value="wallet-low">Wallet Low → High</option>
          <option value="wallet-high">Wallet High → Low</option>
          <option value="active">
            Active Members · Wallet Activity in Last 7 Days
          </option>
          <option value="inactive">
            Inactive Members · No Wallet Activity in 7 Days
          </option>
          <option value="restricted">Restricted Members</option>
        </select>
      </div>

      {loading ? (
        <div className="table-wrap">
          <div className="loading">Loading members...</div>
        </div>
      ) : error ? (
        <div className="table-wrap">
          <div className="error">{error}</div>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="table-wrap">
          <div className="empty">No members found.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Free Fire UID</th>
                <th>Role</th>
                <th>Joined</th>
                <th>IP Address</th>
                <th>Total Wallet</th>
                <th>Last Wallet Activity</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredMembers.map((member) => (
                <tr
                  key={member.id}
                  onClick={() => openMember(member)}
                >
                  <td>
                    <span
                      className="id"
                      title={member.id}
                    >
                      {shortId(member.id)}
                    </span>
                  </td>

                  <td>
                    <span className="member-name">
                      {member.full_name ||
                        member.game_name ||
                        "—"}
                    </span>
                  </td>

                  <td>
                    <span className="phone">
                      {member.phone || "—"}
                    </span>
                  </td>

                  <td>
                    <span className="email">
                      {member.email || "—"}
                    </span>
                  </td>

                  <td>
                    <span className="uid">
                      {member.free_fire_uid || "—"}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`role ${
                        String(member.role || "user").toLowerCase() ===
                        "admin"
                          ? "admin"
                          : "user"
                      }`}
                    >
                      {member.role || "user"}
                    </span>
                  </td>

                  <td>{formatDate(member.created_at)}</td>

                  <td>
                    <span className="ip">
                      {member.ip_address || "Not recorded"}
                    </span>
                  </td>

                  <td>
                    <span className="wallet-total">
                      {money(member.wallet_total)}
                    </span>
                  </td>

                  <td>
                    <span className="activity">
                      {member.last_wallet_activity
                        ? formatDate(member.last_wallet_activity)
                        : "No activity"}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`status ${
                        String(
                          member.status || "active"
                        ).toLowerCase() === "blocked"
                          ? "blocked"
                          : ""
                      }`}
                    >
                      {member.status || "active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedMember && (
        <>
          <button
            className="drawer-backdrop"
            aria-label="Close member details"
            onClick={() => setSelectedMember(null)}
          />

          <aside className="drawer">
            <div className="drawer-header">
              <div>
                <h2 className="drawer-title">
                  {selectedMember.full_name ||
                    selectedMember.game_name ||
                    "Member"}
                </h2>

                <div className="drawer-subtitle">
                  Member details & wallet
                </div>
              </div>

              <button
                className="close"
                onClick={() => setSelectedMember(null)}
              >
                ×
              </button>
            </div>

            <div className="section">
              <div className="section-title">
                Member Information
              </div>

              <div className="info-grid">
                <div className="info full">
                  <div className="info-label">Member ID</div>
                  <div className="info-value">
                    {selectedMember.id}
                  </div>
                </div>

                <div className="info">
                  <div className="info-label">Full Name</div>
                  <div className="info-value">
                    {selectedMember.full_name || "—"}
                  </div>
                </div>

                <div className="info">
                  <div className="info-label">Game Name</div>
                  <div className="info-value">
                    {selectedMember.game_name || "—"}
                  </div>
                </div>

                <div className="info">
                  <div className="info-label">Phone</div>
                  <div className="info-value">
                    {selectedMember.phone || "—"}
                  </div>
                </div>

                <div className="info">
                  <div className="info-label">Email</div>
                  <div className="info-value">
                    {selectedMember.email || "—"}
                  </div>
                </div>

                <div className="info">
                  <div className="info-label">Free Fire UID</div>
                  <div className="info-value">
                    {selectedMember.free_fire_uid || "—"}
                  </div>
                </div>

                <div className="info">
                  <div className="info-label">Role</div>
                  <div className="info-value">
                    {selectedMember.role || "user"}
                  </div>
                </div>

                <div className="info">
                  <div className="info-label">Status</div>
                  <div className="info-value">
                    {selectedMember.status || "active"}
                  </div>
                </div>

                <div className="info">
                  <div className="info-label">IP Address</div>
                  <div className="info-value">
                    {selectedMember.ip_address ||
                      "Not recorded"}
                  </div>
                </div>

                <div className="info full">
                  <div className="info-label">Joined</div>
                  <div className="info-value">
                    {formatDate(selectedMember.created_at)}
                  </div>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="section-title">
                Wallet Balance
              </div>

              {walletLoading ? (
                <div className="info">
                  <div className="info-value">
                    Loading wallet...
                  </div>
                </div>
              ) : (
                <div className="wallet-grid">
                  <div className="wallet-card">
                    <div className="wallet-label">
                      Deposit
                    </div>
                    <div className="wallet-value">
                      {money(wallet?.deposit_balance)}
                    </div>
                  </div>

                  <div className="wallet-card">
                    <div className="wallet-label">
                      Bonus
                    </div>
                    <div className="wallet-value">
                      {money(wallet?.bonus_balance)}
                    </div>
                  </div>

                  <div className="wallet-card">
                    <div className="wallet-label">
                      Winning
                    </div>
                    <div className="wallet-value">
                      {money(wallet?.winning_balance)}
                    </div>
                  </div>
                </div>
              )}

              <div className="edit-box">
                <div className="section-title">Admin Wallet Adjustment</div>
                <div className="edit-row">
                  <select className="edit-select" value={walletType} onChange={(e) => setWalletType(e.target.value)}>
                    <option value="deposit">Deposit Wallet</option>
                    <option value="bonus">Bonus Wallet</option>
                    <option value="winning">Winning Wallet</option>
                  </select>
                  <input
                    className="edit-input"
                    type="number"
                    step="0.01"
                    placeholder="Amount (+ credit / - debit)"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                  />
                </div>
                <textarea
                  className="edit-note"
                  placeholder="Reason / note (optional)"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                />
                <button className="adjust-btn" onClick={adjustWallet} disabled={savingWallet}>
                  {savingWallet ? "Updating..." : "Update Wallet"}
                </button>
                {actionMessage && <div className="action-message">{actionMessage}</div>}
              </div>
            </div>

            <div className="section">
              <div className="section-title">Wallet History</div>
              {history.length === 0 ? (
                <div className="no-history">No wallet transactions yet.</div>
              ) : (
                <div className="history-list">
                  {history.map((tx) => {
                    const numericAmount = Number(tx.amount || 0);
                    const isCredit = numericAmount >= 0 || String(tx.type || "").toLowerCase() === "credit";
                    return (
                      <div className="history-item" key={`${tx.id}-${tx.created_at}`}>
                        <div className="history-top">
                          <span className={`history-amount ${isCredit ? "credit" : "debit"}`}>
                            {isCredit ? "+" : "-"}{money(Math.abs(numericAmount))}
                          </span>
                          <span className="history-type">{tx.type || "transaction"}</span>
                        </div>
                        <div className="history-desc">{tx.description || "Wallet transaction"}</div>
                        <div className="history-date">{formatDate(tx.created_at)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}