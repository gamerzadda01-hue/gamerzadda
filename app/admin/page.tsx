"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Stats = {
  users: number;
  deposits: number;
  pendingWithdrawals: number;
  tournaments: number;
  support: number;
  entries: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    users: 0,
    deposits: 0,
    pendingWithdrawals: 0,
    tournaments: 0,
    support: 0,
    entries: 0,
  });

  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState("Admin");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
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
        .select("full_name,email,role")
        .eq("id", user.id)
        .single();

      if (!admin || admin.role !== "admin") {
        window.location.href = "/";
        return;
      }

      setAdminName(admin.full_name || admin.email || "Admin");

      const [
        users,
        deposits,
        withdrawals,
        tournaments,
        support,
        entries,
      ] = await Promise.all([
        supabase
          .from("users")
          .select("*", { count: "exact", head: true }),

        supabase
          .from("deposit_orders")
          .select("*", { count: "exact", head: true })
          .eq("status", "SUCCESS"),

        supabase
          .from("withdraw_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),

        supabase
          .from("tournaments")
          .select("*", { count: "exact", head: true }),

        supabase
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .eq("status", "open"),

        supabase
          .from("tournament_entries")
          .select("*", { count: "exact", head: true }),
      ]);

      setStats({
        users: users.count || 0,
        deposits: deposits.count || 0,
        pendingWithdrawals: withdrawals.count || 0,
        tournaments: tournaments.count || 0,
        support: support.count || 0,
        entries: entries.count || 0,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-page">
      <style jsx>{`
        .admin-page {
          min-height: 100vh;
          padding: 22px;
          background:
            radial-gradient(
              circle at 85% 0%,
              rgba(239, 22, 56, 0.08),
              transparent 30%
            ),
            #070b12;
          color: #e9eef7;
        }

        .top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 22px;
        }

        .eyebrow {
          color: #ef1638;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 1.8px;
          margin-bottom: 6px;
        }

        h1 {
          margin: 0;
          font-size: 25px;
          font-weight: 900;
          letter-spacing: -0.6px;
        }

        .sub {
          margin-top: 6px;
          color: #718096;
          font-size: 11px;
        }

        .admin-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border: 1px solid #1d2a3b;
          border-radius: 10px;
          background: #0d1520;
        }

        .avatar {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: #18243a;
          color: #ff4964;
          font-weight: 900;
        }

        .admin-user b {
          display: block;
          font-size: 10px;
        }

        .admin-user span {
          color: #66758a;
          font-size: 8px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 22px;
        }

        .card {
          position: relative;
          padding: 16px;
          min-height: 105px;
          border: 1px solid #1d2a3b;
          border-radius: 12px;
          background: linear-gradient(145deg, #0d1520, #0a111b);
          overflow: hidden;
        }

        .card:after {
          content: "";
          position: absolute;
          width: 80px;
          height: 80px;
          right: -35px;
          top: -35px;
          border-radius: 50%;
          background: rgba(239, 22, 56, 0.07);
        }

        .icon {
          font-size: 18px;
          margin-bottom: 10px;
        }

        .label {
          color: #738198;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .value {
          margin-top: 5px;
          font-size: 23px;
          font-weight: 900;
        }

        .actions-title {
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 900;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .action {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 70px;
          padding: 12px;
          color: #dfe6f1;
          text-decoration: none;
          border: 1px solid #1d2a3b;
          border-radius: 10px;
          background: #0d1520;
          transition: 0.18s ease;
        }

        .action:hover {
          transform: translateY(-2px);
          border-color: #3a4b62;
          background: #101a27;
        }

        .action-icon {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          flex: 0 0 35px;
          border-radius: 8px;
          background: #172235;
          font-size: 16px;
        }

        .action b {
          display: block;
          font-size: 10px;
        }

        .action span {
          display: block;
          margin-top: 3px;
          color: #68778c;
          font-size: 8px;
        }

        .alert {
          margin-top: 18px;
          padding: 13px 15px;
          border: 1px solid rgba(239, 22, 56, 0.25);
          border-radius: 10px;
          background: rgba(239, 22, 56, 0.06);
          font-size: 10px;
          color: #aeb8c8;
        }

        .alert strong {
          color: #ff4964;
        }

        @media (max-width: 900px) {
          .stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .actions {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 600px) {
          .admin-page {
            padding: 14px;
          }

          .top {
            align-items: flex-start;
          }

          h1 {
            font-size: 21px;
          }

          .admin-user {
            display: none;
          }

          .stats {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .card {
            min-height: 90px;
            padding: 12px;
          }

          .value {
            font-size: 19px;
          }

          .actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="top">
        <div>
          <div className="eyebrow">GAMERZADDA CONTROL CENTER</div>
          <h1>Admin Dashboard</h1>
          <div className="sub">
            Welcome back, {adminName}. Manage your platform from here.
          </div>
        </div>

        <div className="admin-user">
          <div className="avatar">A</div>
          <div>
            <b>{adminName}</b>
            <span>Super Admin</span>
          </div>
        </div>
      </div>

      <section className="stats">
        <div className="card">
          <div className="icon">♟</div>
          <div className="label">Total Members</div>
          <div className="value">
            {loading ? "—" : stats.users.toLocaleString()}
          </div>
        </div>

        <div className="card">
          <div className="icon">₹</div>
          <div className="label">Successful Deposits</div>
          <div className="value">
            {loading ? "—" : stats.deposits.toLocaleString()}
          </div>
        </div>

        <div className="card">
          <div className="icon">↗</div>
          <div className="label">Pending Withdrawals</div>
          <div className="value">
            {loading ? "—" : stats.pendingWithdrawals.toLocaleString()}
          </div>
        </div>

        <div className="card">
          <div className="icon">♛</div>
          <div className="label">Tournaments</div>
          <div className="value">
            {loading ? "—" : stats.tournaments.toLocaleString()}
          </div>
        </div>

        <div className="card">
          <div className="icon">◌</div>
          <div className="label">Open Support</div>
          <div className="value">
            {loading ? "—" : stats.support.toLocaleString()}
          </div>
        </div>

        <div className="card">
          <div className="icon">🎮</div>
          <div className="label">Tournament Entries</div>
          <div className="value">
            {loading ? "—" : stats.entries.toLocaleString()}
          </div>
        </div>
      </section>

      <h2 className="actions-title">Quick Admin Actions</h2>

      <section className="actions">
        <Link href="/admin/members" className="action">
          <div className="action-icon">♟</div>
          <div>
            <b>Member Database</b>
            <span>Users & account management</span>
          </div>
        </Link>

        <Link href="/admin/deposit-bonus" className="action">
          <div className="action-icon">₹</div>
          <div>
            <b>Deposit Bonus</b>
            <span>Manage bonus settings</span>
          </div>
        </Link>

        <Link href="/admin/withdrawals" className="action">
          <div className="action-icon">↗</div>
          <div>
            <b>Withdrawals</b>
            <span>Approve or reject requests</span>
          </div>
        </Link>

        <Link href="/admin#tournaments" className="action">
          <div className="action-icon">♛</div>
          <div>
            <b>Tournaments</b>
            <span>Create & manage matches</span>
          </div>
        </Link>

        <Link href="/admin/support" className="action">
          <div className="action-icon">◌</div>
          <div>
            <b>Support Chat</b>
            <span>Handle user tickets</span>
          </div>
        </Link>

        <Link href="/admin/banners" className="action">
          <div className="action-icon">▧</div>
          <div>
            <b>Banners</b>
            <span>Manage app banners</span>
          </div>
        </Link>

        <Link href="/admin/notifications" className="action">
          <div className="action-icon">♢</div>
          <div>
            <b>Notifications</b>
            <span>Send user notifications</span>
          </div>
        </Link>

        <Link href="/admin/analytics" className="action">
          <div className="action-icon">▥</div>
          <div>
            <b>Daily Analytics</b>
            <span>Platform performance</span>
          </div>
        </Link>
      </section>

      <div className="alert">
        <strong>Admin Control:</strong> Sensitive actions such as withdrawals,
        wallet changes and account management should only be performed after
        verifying the user/request details.
      </div>
    </main>
  );
}