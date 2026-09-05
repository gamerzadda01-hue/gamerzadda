 "use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { icon: "▦", label: "Overview", href: "/admin" },
  { icon: "♟", label: "Member Database", href: "/admin/members" },
  { icon: "₹", label: "Deposit Bonus", href: "/admin/deposit-bonus" },
  { icon: "↗", label: "Withdrawals", href: "/admin/withdrawals" },
  { icon: "♛", label: "Tournaments", href: "/admin#tournaments" },
  { icon: "◌", label: "Support Chat", href: "/admin/support" },
  { icon: "▧", label: "Banners", href: "/admin/banners" },
  { icon: "♢", label: "Notifications", href: "/admin/notifications" },
  { icon: "▥", label: "Daily Analytics", href: "/admin/analytics" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Never show admin navigation on the login screen.
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const isActive = (href: string) => {
    const clean = href.split("#")[0];
    if (clean === "/admin") return pathname === "/admin";
    return pathname === clean || pathname.startsWith(clean + "/");
  };

  return (
    <div className="ga-admin-shell">
      <style jsx global>{`
        .ga-admin-shell {
          --ga-bg: #070b12;
          --ga-panel: #0d1520;
          --ga-panel2: #101a27;
          --ga-border: #1d2a3b;
          --ga-text: #e9eef7;
          --ga-muted: #7f8ca1;
          --ga-red: #ef1638;
          min-height: 100vh;
          background: var(--ga-bg);
          color: var(--ga-text);
        }

        .ga-admin-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          z-index: 100;
          width: 238px;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(circle at 10% 0%, rgba(239,22,56,.09), transparent 28%),
            #0a1019;
          border-right: 1px solid var(--ga-border);
          padding: 16px 11px;
          box-sizing: border-box;
          overflow-y: auto;
        }

        .ga-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 8px 17px;
          margin-bottom: 13px;
          border-bottom: 1px solid var(--ga-border);
        }

        .ga-logo {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #ff294b, #c70d2c);
          box-shadow: 0 8px 24px rgba(239,22,56,.22);
          font-size: 17px;
        }

        .ga-brand-title {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .2px;
          line-height: 1.1;
        }

        .ga-brand-title span {
          color: #ef1638;
        }

        .ga-brand-sub {
          margin-top: 3px;
          font-size: 8px;
          color: #657287;
          letter-spacing: 1.2px;
          font-weight: 800;
        }

        .ga-label {
          padding: 8px 10px 6px;
          color: #59677b;
          font-size: 8px;
          letter-spacing: 1.6px;
          font-weight: 900;
        }

        .ga-nav {
          display: grid;
          gap: 3px;
        }

        .ga-nav-link {
          min-height: 38px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 10px;
          border-radius: 8px;
          border: 1px solid transparent;
          color: #96a3b6;
          text-decoration: none;
          font-size: 11px;
          font-weight: 700;
          transition: .18s ease;
        }

        .ga-nav-link:hover {
          background: #101a27;
          color: #edf2f8;
          border-color: #202e40;
          transform: translateX(2px);
        }

        .ga-nav-link.active {
          color: #fff;
          background: linear-gradient(90deg, #ed1739, #b90e2b);
          border-color: rgba(255,255,255,.05);
          box-shadow: 0 7px 20px rgba(239,22,56,.16);
        }

        .ga-collapse-button {
          width: 100%;
          height: 30px;
          margin: 0 0 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid #202e40;
          border-radius: 7px;
          background: #0e1723;
          color: #8f9caf;
          cursor: pointer;
          font-size: 11px;
          font-weight: 800;
          transition: .18s ease;
        }

        .ga-collapse-button:hover {
          background: #141f2d;
          color: #fff;
          border-color: #31435b;
        }

        .ga-admin-sidebar.collapsed {
          width: 72px;
          padding-left: 9px;
          padding-right: 9px;
        }

        .ga-admin-sidebar.collapsed .ga-brand {
          justify-content: center;
          padding-left: 0;
          padding-right: 0;
        }

        .ga-admin-sidebar.collapsed .ga-brand > div:last-child,
        .ga-admin-sidebar.collapsed .ga-collapse-text,
        .ga-admin-sidebar.collapsed .ga-label,
        .ga-admin-sidebar.collapsed .ga-nav-text,
        .ga-admin-sidebar.collapsed .ga-admin-card > div:last-child {
          display: none;
        }

        .ga-admin-sidebar.collapsed .ga-collapse-button {
          font-size: 17px;
        }

        .ga-admin-sidebar.collapsed .ga-nav-link {
          justify-content: center;
          padding-left: 0;
          padding-right: 0;
        }

        .ga-admin-sidebar.collapsed .ga-nav-icon {
          width: auto;
          flex-basis: auto;
        }

        .ga-admin-sidebar.collapsed .ga-admin-card {
          justify-content: center;
          padding: 8px;
        }

        .ga-admin-sidebar.collapsed + .ga-backdrop + .ga-main {
          margin-left: 72px;
        }

        @media (min-width: 761px) {
          .ga-main {
            transition: margin-left .22s ease;
          }

          .ga-admin-sidebar.collapsed ~ .ga-main {
            margin-left: 72px;
          }
        }

        .ga-nav-icon {
          width: 21px;
          text-align: center;
          font-size: 15px;
          flex: 0 0 21px;
        }

        .ga-system {
          margin-top: auto;
          padding-top: 16px;
        }

        .ga-admin-card {
          margin: 10px 2px 0;
          padding: 10px;
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid #202e40;
          border-radius: 9px;
          background: #0f1723;
        }

        .ga-avatar {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: #18243a;
          color: #ff4964;
          font-size: 12px;
          font-weight: 900;
        }

        .ga-admin-card b {
          display: block;
          font-size: 10px;
        }

        .ga-admin-card small {
          display: block;
          margin-top: 2px;
          color: #647186;
          font-size: 8px;
        }

        .ga-main {
          min-height: 100vh;
          margin-left: 238px;
        }

        .ga-mobile-topbar {
          display: none;
          position: sticky;
          top: 0;
          z-index: 90;
          height: 55px;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          background: rgba(7,11,18,.96);
          border-bottom: 1px solid var(--ga-border);
          backdrop-filter: blur(14px);
        }

        .ga-menu-button {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border: 1px solid #263448;
          border-radius: 8px;
          background: #101925;
          color: #fff;
          cursor: pointer;
          font-size: 17px;
        }

        .ga-mobile-title {
          font-size: 12px;
          font-weight: 900;
        }

        .ga-mobile-title span {
          color: #ef1638;
        }

        .ga-backdrop {
          display: none;
        }

        @media (max-width: 760px) {
          .ga-admin-sidebar {
            width: 238px;
            transform: translateX(-105%);
            transition: transform .22s ease;
            box-shadow: 18px 0 45px rgba(0,0,0,.38);
          }

          .ga-admin-sidebar.open {
            transform: translateX(0);
          }

          .ga-admin-sidebar.collapsed {
            width: 238px;
          }

          .ga-admin-sidebar.collapsed .ga-brand > div:last-child,
          .ga-admin-sidebar.collapsed .ga-collapse-text,
          .ga-admin-sidebar.collapsed .ga-label,
          .ga-admin-sidebar.collapsed .ga-nav-text,
          .ga-admin-sidebar.collapsed .ga-admin-card > div:last-child {
            display: block;
          }

          .ga-admin-sidebar.collapsed .ga-nav-link {
            justify-content: flex-start;
            padding-left: 10px;
            padding-right: 10px;
          }

          .ga-admin-sidebar.collapsed .ga-nav-icon {
            width: 21px;
            flex-basis: 21px;
          }

          .ga-admin-sidebar.collapsed .ga-admin-card {
            justify-content: flex-start;
            padding: 10px;
          }

          .ga-collapse-button {
            display: none;
          }

          .ga-main {
            margin-left: 0;
          }

          .ga-mobile-topbar {
            display: flex;
          }

          .ga-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 95;
            border: 0;
            background: rgba(0,0,0,.62);
            backdrop-filter: blur(2px);
          }
        }
      `}</style>

      <aside className={`ga-admin-sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <div className="ga-brand">
          <div className="ga-logo">🎮</div>
          <div>
            <div className="ga-brand-title">
              GAMERZ<span>ADDA</span>
            </div>
            <div className="ga-brand-sub">ADMIN CONTROL</div>
          </div>
        </div>

        <button
          className="ga-collapse-button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((v) => !v)}
        >
          <span>{collapsed ? "»" : "«"}</span>
          <span className="ga-collapse-text">
            {collapsed ? "Expand" : "Collapse"}
          </span>
        </button>

        <div className="ga-label">MAIN</div>

        <nav className="ga-nav">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`ga-nav-link ${isActive(item.href) ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <span className="ga-nav-icon">{item.icon}</span>
              <span className="ga-nav-text">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="ga-system">

          <div className="ga-label">SYSTEM</div>

          <Link
            href="/admin"
            className="ga-nav-link"
            onClick={() => setOpen(false)}
          >
            <span className="ga-nav-icon">⌂</span>
            <span>Control Home</span>
          </Link>

          <div className="ga-admin-card">
            <div className="ga-avatar">A</div>
            <div>
              <b>Admin</b>
              <small>Super Admin</small>
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <button
          aria-label="Close admin sidebar"
          className="ga-backdrop"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="ga-main">
        <div className="ga-mobile-topbar">
          <button
            className="ga-menu-button"
            aria-label="Open admin sidebar"
            onClick={() => setOpen(true)}
          >
            ☰
          </button>
          <div className="ga-mobile-title">
            GAMERZ<span>ADDA</span> · ADMIN
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
