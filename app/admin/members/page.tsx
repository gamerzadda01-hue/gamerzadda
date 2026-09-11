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
  referral_code: string | null;
  referred_by: string | null;
  device_id?: string | null;
  device_user_agent?: string | null;
  last_login_at?: string | null;
  device_changed_at?: string | null;
  daily_free_fire_limit?: number | null;
  daily_free_fire_max_limit?: number | null;
  daily_clash_squad_limit?: number | null;
  daily_lone_wolf_limit?: number | null;
};

type Wallet = {
  deposit_balance: number | null;
  bonus_balance: number | null;
  winning_balance: number | null;
};

type ReferralSettings = {
  id?: string;
  signup_bonus: number;
  referrer_signup_reward_min: number;
  referrer_signup_reward_max: number;
  referred_signup_reward_min: number;
  referred_signup_reward_max: number;
  tournament_reward_min: number;
  tournament_reward_max: number;
  first_deposit_percent: number;
  is_active: boolean;
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
  const [memberDetail, setMemberDetail] = useState<any>(null);
  const [referral, setReferral] = useState<any>(null);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [statusAction, setStatusAction] = useState<"block" | "unblock" | "restrict" | "unrestrict" | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [restrictionDays, setRestrictionDays] = useState("7");
  const [statusSaving, setStatusSaving] = useState(false);
  const [savingMatchLimits, setSavingMatchLimits] = useState(false);
  const [matchLimitMessage, setMatchLimitMessage] = useState("");
  const [matchLimits, setMatchLimits] = useState({
    freeFire: "",
    freeFireMax: "",
    clashSquad: "",
    loneWolf: "",
  });

  const [referralSettings, setReferralSettings] = useState<ReferralSettings>({
    signup_bonus: 20,
    referrer_signup_reward_min: 30,
    referrer_signup_reward_max: 60,
    referred_signup_reward_min: 30,
    referred_signup_reward_max: 50,
    tournament_reward_min: 20,
    tournament_reward_max: 40,
    first_deposit_percent: 10,
    is_active: true,
  });
  const [referralSettingsLoading, setReferralSettingsLoading] = useState(false);
  const [referralSettingsSaving, setReferralSettingsSaving] = useState(false);
  const [referralSettingsMessage, setReferralSettingsMessage] = useState("");

  useEffect(() => {
    loadMembers();
    loadReferralSettings();
  }, []);

  async function loadReferralSettings() {
    setReferralSettingsLoading(true);
    setReferralSettingsMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Admin login required.");

      const response = await fetch("/api/admin/referral-settings", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const raw = await response.text();
      const result = raw ? JSON.parse(raw) : null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to load referral settings.");
      }

      if (result.settings) {
        setReferralSettings({
          signup_bonus: Number(result.settings.signup_bonus ?? 20),
          referrer_signup_reward_min: Number(result.settings.referrer_signup_reward_min ?? 30),
          referrer_signup_reward_max: Number(result.settings.referrer_signup_reward_max ?? 60),
          referred_signup_reward_min: Number(result.settings.referred_signup_reward_min ?? 30),
          referred_signup_reward_max: Number(result.settings.referred_signup_reward_max ?? 50),
          tournament_reward_min: Number(result.settings.tournament_reward_min ?? 20),
          tournament_reward_max: Number(result.settings.tournament_reward_max ?? 40),
          first_deposit_percent: Number(result.settings.first_deposit_percent ?? 10),
          is_active: Boolean(result.settings.is_active),
          id: result.settings.id,
        });
      }
    } catch (err: any) {
      console.error(err);
      setReferralSettingsMessage(err?.message || "Unable to load referral settings.");
    } finally {
      setReferralSettingsLoading(false);
    }
  }

  function validateMoneyRange(label: string, min: number, max: number) {
    if (!Number.isFinite(min) || min < 0 || min > 100000) {
      throw new Error(`${label} minimum must be between ₹0 and ₹100000.`);
    }
    if (!Number.isFinite(max) || max < 0 || max > 100000) {
      throw new Error(`${label} maximum must be between ₹0 and ₹100000.`);
    }
    if (min > max) {
      throw new Error(`${label} minimum cannot be greater than maximum.`);
    }
  }

  async function saveReferralSettings() {
    try {
      const signupBonus = Number(referralSettings.signup_bonus);
      const referrerMin = Number(referralSettings.referrer_signup_reward_min);
      const referrerMax = Number(referralSettings.referrer_signup_reward_max);
      const referredMin = Number(referralSettings.referred_signup_reward_min);
      const referredMax = Number(referralSettings.referred_signup_reward_max);
      const tournamentMin = Number(referralSettings.tournament_reward_min);
      const tournamentMax = Number(referralSettings.tournament_reward_max);
      const depositPercent = Number(referralSettings.first_deposit_percent);

      if (!Number.isFinite(signupBonus) || signupBonus < 0 || signupBonus > 100000) {
        throw new Error("Signup bonus must be between ₹0 and ₹100000.");
      }
      validateMoneyRange("Referrer signup reward", referrerMin, referrerMax);
      validateMoneyRange("Referred user signup reward", referredMin, referredMax);
      validateMoneyRange("First tournament reward", tournamentMin, tournamentMax);

      if (!Number.isFinite(depositPercent) || depositPercent < 0 || depositPercent > 100) {
        throw new Error("First deposit percentage must be between 0% and 100%.");
      }

      const values = [signupBonus, referrerMin, referrerMax, referredMin, referredMax, tournamentMin, tournamentMax, depositPercent];
      if (values.some((value) => Math.round(value * 100) / 100 !== value)) {
        throw new Error("Maximum 2 decimal places allowed.");
      }

      setReferralSettingsSaving(true);
      setReferralSettingsMessage("");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Admin login required.");

      const response = await fetch("/api/admin/referral-settings", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          signup_bonus: signupBonus,
          referrer_signup_reward_min: referrerMin,
          referrer_signup_reward_max: referrerMax,
          referred_signup_reward_min: referredMin,
          referred_signup_reward_max: referredMax,
          tournament_reward_min: tournamentMin,
          tournament_reward_max: tournamentMax,
          first_deposit_percent: depositPercent,
          is_active: referralSettings.is_active,
        }),
      });

      const raw = await response.text();
      const result = raw ? JSON.parse(raw) : null;
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to save referral settings.");
      }

      if (result.settings) {
        setReferralSettings({
          ...referralSettings,
          ...result.settings,
          signup_bonus: Number(result.settings.signup_bonus),
          referrer_signup_reward_min: Number(result.settings.referrer_signup_reward_min),
          referrer_signup_reward_max: Number(result.settings.referrer_signup_reward_max),
          referred_signup_reward_min: Number(result.settings.referred_signup_reward_min),
          referred_signup_reward_max: Number(result.settings.referred_signup_reward_max),
          tournament_reward_min: Number(result.settings.tournament_reward_min),
          tournament_reward_max: Number(result.settings.tournament_reward_max),
          first_deposit_percent: Number(result.settings.first_deposit_percent),
          is_active: Boolean(result.settings.is_active),
        });
      }

      setReferralSettingsMessage("Referral settings saved successfully.");
    } catch (err: any) {
      console.error(err);
      setReferralSettingsMessage(err?.message || "Unable to save referral settings.");
    } finally {
      setReferralSettingsSaving(false);
    }
  }

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
    setMemberDetail(null);
    setReferral(null);
    setLoginHistory([]);
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
      setMemberDetail(result.member || null);
      setReferral(result.referral || null);
      setLoginHistory(result.loginHistory || []);
      const m = result.member || member;
      setMatchLimits({
        freeFire: m.daily_free_fire_limit == null ? "" : String(m.daily_free_fire_limit),
        freeFireMax: m.daily_free_fire_max_limit == null ? "" : String(m.daily_free_fire_max_limit),
        clashSquad: m.daily_clash_squad_limit == null ? "" : String(m.daily_clash_squad_limit),
        loneWolf: m.daily_lone_wolf_limit == null ? "" : String(m.daily_lone_wolf_limit),
      });
      setMatchLimitMessage("");
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

  function normalizedStatus(member: Member | null) {
    return String(member?.status || "active").trim().toLowerCase();
  }

  async function changeMemberStatus(
    action: "block" | "unblock" | "restrict" | "unrestrict"
  ) {
    if (!selectedMember) return;

    if ((action === "block" || action === "restrict") && !statusReason.trim()) {
      setActionMessage("Please enter a reason.");
      return;
    }

    if (action === "restrict") {
      const days = Number(restrictionDays);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        setActionMessage("Restriction duration must be between 1 and 365 days.");
        return;
      }
    }

    setStatusSaving(true);
    setActionMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Admin login required.");

      const body: any = {
        userId: selectedMember.id,
        action,
        reason: statusReason.trim() || null,
      };

      if (action === "restrict") {
        body.durationDays = Number(restrictionDays);
      }

      const response = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const raw = await response.text();
      let result: any = null;

      try {
        result = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(raw || "Unable to update member status.");
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to update member status.");
      }

      const nextStatus =
        action === "block"
          ? "blocked"
          : action === "restrict"
            ? "restricted"
            : "active";

      setMembers((old) =>
        old.map((m) =>
          m.id === selectedMember.id ? { ...m, status: nextStatus } : m
        )
      );

      setSelectedMember((old) =>
        old ? { ...old, status: nextStatus } : old
      );

      setStatusAction(null);
      setStatusReason("");
      setActionMessage(
        action === "block"
          ? "Member blocked successfully."
          : action === "restrict"
            ? "Member restricted successfully."
            : action === "unblock"
              ? "Member unblocked successfully."
              : "Member unrestricted successfully."
      );

      await loadMembers();
    } catch (err: any) {
      console.error(err);
      setActionMessage(err?.message || "Unable to update member status.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function saveMatchLimits() {
    if (!selectedMember) return;

    const fields = [
      ["Free Fire", matchLimits.freeFire],
      ["Free Fire MAX", matchLimits.freeFireMax],
      ["Clash Squad", matchLimits.clashSquad],
      ["Lone Wolf", matchLimits.loneWolf],
    ] as const;

    const parsed: Record<string, number | null> = {};

    for (const [name, value] of fields) {
      const clean = value.trim();
      if (clean === "") continue;
      if (!/^\d+$/.test(clean)) {
        setMatchLimitMessage(`${name}: enter a whole number or leave blank for Unlimited.`);
        return;
      }
      const n = Number(clean);
      if (!Number.isSafeInteger(n) || n < 0 || n > 10000) {
        setMatchLimitMessage(`${name}: limit must be between 0 and 10000.`);
        return;
      }
    }

    parsed.daily_free_fire_limit = matchLimits.freeFire.trim() === "" ? null : Number(matchLimits.freeFire);
    parsed.daily_free_fire_max_limit = matchLimits.freeFireMax.trim() === "" ? null : Number(matchLimits.freeFireMax);
    parsed.daily_clash_squad_limit = matchLimits.clashSquad.trim() === "" ? null : Number(matchLimits.clashSquad);
    parsed.daily_lone_wolf_limit = matchLimits.loneWolf.trim() === "" ? null : Number(matchLimits.loneWolf);

    setSavingMatchLimits(true);
    setMatchLimitMessage("");

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
          action: "update_match_limits",
          ...parsed,
        }),
      });

      const raw = await response.text();
      const result = raw ? JSON.parse(raw) : null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to save match limits.");
      }

      const updated = result.member || {};
      setSelectedMember((old) => old ? {
        ...old,
        daily_free_fire_limit: updated.daily_free_fire_limit,
        daily_free_fire_max_limit: updated.daily_free_fire_max_limit,
        daily_clash_squad_limit: updated.daily_clash_squad_limit,
        daily_lone_wolf_limit: updated.daily_lone_wolf_limit,
      } : old);
      setMembers((old) => old.map((m) => m.id === selectedMember.id ? {
        ...m,
        daily_free_fire_limit: updated.daily_free_fire_limit,
        daily_free_fire_max_limit: updated.daily_free_fire_max_limit,
        daily_clash_squad_limit: updated.daily_clash_squad_limit,
        daily_lone_wolf_limit: updated.daily_lone_wolf_limit,
      } : m));
      setMatchLimitMessage("Daily match limits saved successfully.");
    } catch (err: any) {
      setMatchLimitMessage(err?.message || "Unable to save match limits.");
    } finally {
      setSavingMatchLimits(false);
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

        .referral-settings {
          margin-bottom: 18px;
          padding: 15px;
          border: 1px solid #1d2a3b;
          border-radius: 10px;
          background: #0d1520;
        }

        .referral-settings-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .referral-settings-title {
          color: #fff;
          font-size: 12px;
          font-weight: 900;
        }

        .referral-settings-subtitle {
          margin-top: 4px;
          color: #68778c;
          font-size: 8px;
          line-height: 1.45;
        }

        .referral-toggle {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #8ed8ae;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
          cursor: pointer;
        }

        .referral-toggle input {
          width: 16px;
          height: 16px;
          accent-color: #ef1638;
        }

        .referral-settings-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .referral-setting-card {
          padding: 10px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          background: #101925;
        }

        .referral-setting-label {
          color: #718096;
          font-size: 8px;
          font-weight: 800;
          line-height: 1.35;
          min-height: 22px;
        }

        .referral-setting-input {
          width: 100%;
          height: 34px;
          margin-top: 6px;
          box-sizing: border-box;
          border: 1px solid #263448;
          border-radius: 7px;
          background: #0d1520;
          color: #fff;
          padding: 0 9px;
          font-size: 10px;
          outline: none;
        }

        .referral-setting-input:focus {
          border-color: #ef1638;
        }

        .referral-setting-help {
          margin-top: 8px;
          color: #65748a;
          font-size: 8px;
          line-height: 1.45;
        }

        .referral-settings-save {
          width: 100%;
          height: 37px;
          margin-top: 10px;
          border: 0;
          border-radius: 7px;
          background: #ef1638;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .referral-settings-save:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .referral-settings-message {
          margin-top: 7px;
          color: #8ed8ae;
          font-size: 9px;
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

.match-limit-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .match-limit-card {
          padding: 10px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          background: #0e1723;
        }

        .match-limit-label {
          color: #647186;
          font-size: 8px;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .match-limit-input {
          width: 100%;
          height: 34px;
          box-sizing: border-box;
          border: 1px solid #263448;
          border-radius: 7px;
          background: #101925;
          color: #fff;
          padding: 0 9px;
          font-size: 10px;
          outline: none;
        }

        .match-limit-help {
          margin-top: 7px;
          color: #65748a;
          font-size: 8px;
          line-height: 1.45;
        }

        .match-limit-save {
          width: 100%;
          height: 36px;
          margin-top: 9px;
          border: 0;
          border-radius: 7px;
          background: #ef1638;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .match-limit-save:disabled { opacity: .55; cursor: not-allowed; }

        .match-limit-message {
          margin-top: 7px;
          color: #8ed8ae;
          font-size: 9px;
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

        .profile-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid #1d2a3b;
          border-radius: 9px;
          background: #0e1723;
        }

        .profile-avatar {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #263448;
          background: #101925;
          flex: 0 0 auto;
        }

        .profile-avatar-fallback {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #182333;
          color: #fff;
          font-size: 20px;
          font-weight: 900;
          border: 2px solid #263448;
          flex: 0 0 auto;
        }

        .profile-name {
          color: #fff;
          font-size: 13px;
          font-weight: 900;
        }

        .profile-game {
          margin-top: 3px;
          color: #718096;
          font-size: 9px;
        }

        .bio-box {
          padding: 11px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          background: #0e1723;
          color: #b8c3d1;
          font-size: 10px;
          line-height: 1.55;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .ref-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .ref-card {
          padding: 11px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          background: #0e1723;
        }

        .ref-label {
          color: #647186;
          font-size: 8px;
          margin-bottom: 5px;
        }

        .ref-value {
          color: #edf2f8;
          font-size: 10px;
          font-weight: 800;
          word-break: break-word;
        }

        .referrer-card {
          margin-top: 8px;
          padding: 11px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          background: #0e1723;
        }

        .referrer-title {
          color: #647186;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: .8px;
          margin-bottom: 6px;
        }

        .referral-list {
          display: flex;
          flex-direction: column;
          gap: 7px;
          max-height: 250px;
          overflow-y: auto;
          margin-top: 8px;
        }

        .referral-item {
          padding: 10px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          background: #0e1723;
        }

        .referral-item-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }

        .referral-item-name {
          color: #fff;
          font-size: 10px;
          font-weight: 800;
        }

        .referral-item-date {
          color: #65748a;
          font-size: 8px;
        }

        .referral-item-meta {
          margin-top: 4px;
          color: #8290a3;
          font-size: 8px;
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

    
    .security-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 10px;
    }
    .security-card {
      border: 1px solid #2a2a32;
      background: #15151b;
      border-radius: 12px;
      padding: 12px;
      min-width: 0;
    }
    .security-value {
      margin-top: 5px;
      font-size: 13px;
      font-weight: 700;
      color: #eee;
      word-break: break-word;
    }
    .security-mono {
      font-family: monospace;
      font-size: 11px;
      color: #aaa;
    }
    .device-warning {
      color: #f59e0b !important;
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

        .status-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 10px;
        }

        .status-btn {
          height: 38px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
          border: 1px solid transparent;
        }

        .status-btn.restrict {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
          border-color: rgba(245, 158, 11, 0.28);
        }

        .status-btn.block {
          background: rgba(239, 22, 56, 0.12);
          color: #ff647b;
          border-color: rgba(239, 22, 56, 0.28);
        }

        .status-btn.unrestrict,
        .status-btn.unblock {
          background: rgba(40, 180, 110, 0.10);
          color: #66d69b;
          border-color: rgba(40, 180, 110, 0.22);
        }

        .status-btn:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 8px;
          border-radius: 6px;
          font-size: 8px;
          font-weight: 900;
          text-transform: uppercase;
          border: 1px solid;
        }

        .status-badge.active {
          color: #66d69b;
          background: rgba(40, 180, 110, 0.08);
          border-color: rgba(40, 180, 110, 0.18);
        }

        .status-badge.restricted {
          color: #fbbf24;
          background: rgba(245, 158, 11, 0.08);
          border-color: rgba(245, 158, 11, 0.20);
        }

        .status-badge.blocked {
          color: #ff647b;
          background: rgba(239, 22, 56, 0.08);
          border-color: rgba(239, 22, 56, 0.20);
        }

        .status-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(0, 0, 0, .72);
        }

        .status-modal {
          width: 100%;
          max-width: 390px;
          padding: 20px;
          border: 1px solid #2a394d;
          border-radius: 14px;
          background: #0b121c;
          box-shadow: 0 25px 80px rgba(0,0,0,.55);
        }

        .status-modal-title {
          margin: 0;
          color: #fff;
          font-size: 15px;
          font-weight: 900;
        }

        .status-modal-subtitle {
          margin-top: 5px;
          color: #738197;
          font-size: 9px;
          line-height: 1.5;
        }

        .status-modal-label {
          display: block;
          margin: 16px 0 7px;
          color: #68778c;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .status-reason {
          width: 100%;
          min-height: 78px;
          resize: vertical;
          box-sizing: border-box;
          border: 1px solid #263448;
          border-radius: 8px;
          background: #101925;
          color: #fff;
          padding: 10px;
          font-size: 10px;
          outline: none;
        }

        .status-days {
          width: 100%;
          height: 38px;
          box-sizing: border-box;
          border: 1px solid #263448;
          border-radius: 8px;
          background: #101925;
          color: #fff;
          padding: 0 10px;
          font-size: 10px;
          outline: none;
        }

        .status-modal-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 14px;
        }

        .status-modal-cancel,
        .status-modal-confirm {
          height: 38px;
          border-radius: 8px;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .status-modal-cancel {
          border: 1px solid #263448;
          background: #101925;
          color: #c5cfdd;
        }

        .status-modal-confirm {
          border: 0;
          background: #ef1638;
          color: #fff;
        }

        .status-modal-confirm:disabled,
        .status-modal-cancel:disabled {
          opacity: .55;
          cursor: not-allowed;
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

          .referral-settings-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .referral-settings-grid {
            grid-template-columns: 1fr 1fr;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .info.full {
            grid-column: auto;
          }

  .match-limit-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .match-limit-card {
          padding: 10px;
          border: 1px solid #1d2a3b;
          border-radius: 8px;
          background: #0e1723;
        }

        .match-limit-label {
          color: #647186;
          font-size: 8px;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .match-limit-input {
          width: 100%;
          height: 34px;
          box-sizing: border-box;
          border: 1px solid #263448;
          border-radius: 7px;
          background: #101925;
          color: #fff;
          padding: 0 9px;
          font-size: 10px;
          outline: none;
        }

        .match-limit-help {
          margin-top: 7px;
          color: #65748a;
          font-size: 8px;
          line-height: 1.45;
        }

        .match-limit-save {
          width: 100%;
          height: 36px;
          margin-top: 9px;
          border: 0;
          border-radius: 7px;
          background: #ef1638;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .match-limit-save:disabled { opacity: .55; cursor: not-allowed; }

        .match-limit-message {
          margin-top: 7px;
          color: #8ed8ae;
          font-size: 9px;
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

      <div className="referral-settings">
        <div className="referral-settings-head">
          <div>
            <div className="referral-settings-title">Referral System Settings</div>
            <div className="referral-settings-subtitle">
              Global referral rewards. Signup bonus goes to Deposit Wallet; referral rewards follow the wallet rules configured for each milestone.
            </div>
          </div>
          <label className="referral-toggle">
            <input
              type="checkbox"
              checked={referralSettings.is_active}
              onChange={(e) => setReferralSettings((v) => ({ ...v, is_active: e.target.checked }))}
              disabled={referralSettingsLoading || referralSettingsSaving}
            />
            Referral System ON
          </label>
        </div>

        <div className="referral-settings-grid">
          <div className="referral-setting-card">
            <div className="referral-setting-label">Normal Signup Bonus · Deposit Wallet</div>
            <input className="referral-setting-input" type="number" min="0" max="100000" step="0.01" value={referralSettings.signup_bonus} onChange={(e) => setReferralSettings((v) => ({ ...v, signup_bonus: Number(e.target.value) }))} />
          </div>

          <div className="referral-setting-card">
            <div className="referral-setting-label">Referrer Signup Reward · Bonus Wallet</div>
            <input className="referral-setting-input" type="number" min="0" max="100000" step="0.01" value={referralSettings.referrer_signup_reward_min} onChange={(e) => setReferralSettings((v) => ({ ...v, referrer_signup_reward_min: Number(e.target.value) }))} placeholder="Min" />
            <input className="referral-setting-input" type="number" min="0" max="100000" step="0.01" value={referralSettings.referrer_signup_reward_max} onChange={(e) => setReferralSettings((v) => ({ ...v, referrer_signup_reward_max: Number(e.target.value) }))} placeholder="Max" />
          </div>

          <div className="referral-setting-card">
            <div className="referral-setting-label">Referred User Signup Reward · Bonus Wallet</div>
            <input className="referral-setting-input" type="number" min="0" max="100000" step="0.01" value={referralSettings.referred_signup_reward_min} onChange={(e) => setReferralSettings((v) => ({ ...v, referred_signup_reward_min: Number(e.target.value) }))} placeholder="Min" />
            <input className="referral-setting-input" type="number" min="0" max="100000" step="0.01" value={referralSettings.referred_signup_reward_max} onChange={(e) => setReferralSettings((v) => ({ ...v, referred_signup_reward_max: Number(e.target.value) }))} placeholder="Max" />
          </div>

          <div className="referral-setting-card">
            <div className="referral-setting-label">First Tournament Reward · Bonus Wallet</div>
            <input className="referral-setting-input" type="number" min="0" max="100000" step="0.01" value={referralSettings.tournament_reward_min} onChange={(e) => setReferralSettings((v) => ({ ...v, tournament_reward_min: Number(e.target.value) }))} placeholder="Min" />
            <input className="referral-setting-input" type="number" min="0" max="100000" step="0.01" value={referralSettings.tournament_reward_max} onChange={(e) => setReferralSettings((v) => ({ ...v, tournament_reward_max: Number(e.target.value) }))} placeholder="Max" />
          </div>

          <div className="referral-setting-card">
            <div className="referral-setting-label">First Deposit Reward · Referrer → Deposit Wallet</div>
            <input className="referral-setting-input" type="number" min="0" max="100" step="0.01" value={referralSettings.first_deposit_percent} onChange={(e) => setReferralSettings((v) => ({ ...v, first_deposit_percent: Number(e.target.value) }))} />
          </div>
        </div>

        <div className="referral-setting-help">
          Referred user first deposit reward: same percentage goes to Bonus Wallet. Each signup, first tournament join, and first deposit milestone is rewarded only once by the backend.
        </div>

        <button className="referral-settings-save" onClick={saveReferralSettings} disabled={referralSettingsLoading || referralSettingsSaving}>
          {referralSettingsSaving ? "Saving..." : referralSettingsLoading ? "Loading..." : "Save Referral Settings"}
        </button>
        {referralSettingsMessage && <div className="referral-settings-message">{referralSettingsMessage}</div>}
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
                <th>Device</th>
                <th>Last Login</th>
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
                    <span className={member.device_changed_at ? "device-warning" : "activity"}>
                      {member.device_changed_at ? "⚠ Changed" : member.device_id ? "✓ Tracked" : "Not recorded"}
                    </span>
                  </td>

                  <td>
                    <span className="activity">
                      {member.last_login_at ? formatDate(member.last_login_at) : "Never"}
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
                    <span className={`status-badge ${normalizedStatus(member)}`}>
                      {normalizedStatus(member) === "blocked"
                        ? "● Blocked"
                        : normalizedStatus(member) === "restricted"
                          ? "● Restricted"
                          : "● Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {statusAction && selectedMember && (
        <div
          className="status-modal-backdrop"
          onClick={() => {
            if (!statusSaving) setStatusAction(null);
          }}
        >
          <div
            className="status-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="status-modal-title">
              {statusAction === "block" ? "Block User" : "Restrict User"}
            </h3>

            <div className="status-modal-subtitle">
              {statusAction === "block"
                ? "This will prevent the user from using the account. Existing sessions should also be invalidated by the server."
                : "This will keep the user logged in but prevent restricted actions such as joining tournaments and earning/reward actions."}
            </div>

            <label className="status-modal-label">Reason</label>
            <textarea
              className="status-reason"
              placeholder={
                statusAction === "block"
                  ? "Enter block reason..."
                  : "Enter restriction reason..."
              }
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              disabled={statusSaving}
            />

            {statusAction === "restrict" && (
              <>
                <label className="status-modal-label">Restriction Duration</label>
                <select
                  className="status-days"
                  value={restrictionDays}
                  onChange={(e) => setRestrictionDays(e.target.value)}
                  disabled={statusSaving}
                >
                  <option value="1">1 Day</option>
                  <option value="3">3 Days</option>
                  <option value="7">7 Days</option>
                  <option value="15">15 Days</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                  <option value="365">365 Days</option>
                </select>
              </>
            )}

            <div className="status-modal-actions">
              <button
                type="button"
                className="status-modal-cancel"
                disabled={statusSaving}
                onClick={() => setStatusAction(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="status-modal-confirm"
                disabled={statusSaving || !statusReason.trim()}
                onClick={() => changeMemberStatus(statusAction)}
              >
                {statusSaving
                  ? "Saving..."
                  : statusAction === "block"
                    ? "Confirm Block"
                    : "Confirm Restrict"}
              </button>
            </div>
          </div>
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

                <div className="info full">
                  <div className="info-label">Account Status</div>
                  <div className="info-value">
                    <span className={`status-badge ${normalizedStatus(selectedMember)}`}>
                      {normalizedStatus(selectedMember) === "blocked"
                        ? "● Blocked"
                        : normalizedStatus(selectedMember) === "restricted"
                          ? "● Restricted"
                          : "● Active"}
                    </span>

                    <div className="status-actions">
                      {normalizedStatus(selectedMember) === "blocked" ? (
                        <button
                          className="status-btn unblock"
                          type="button"
                          disabled={statusSaving}
                          onClick={() => changeMemberStatus("unblock")}
                        >
                          {statusSaving ? "Updating..." : "✓ Unblock User"}
                        </button>
                      ) : (
                        <button
                          className="status-btn block"
                          type="button"
                          disabled={statusSaving}
                          onClick={() => {
                            setStatusAction("block");
                            setStatusReason("");
                          }}
                        >
                          🚫 Block User
                        </button>
                      )}

                      {normalizedStatus(selectedMember) === "restricted" ? (
                        <button
                          className="status-btn unrestrict"
                          type="button"
                          disabled={statusSaving}
                          onClick={() => changeMemberStatus("unrestrict")}
                        >
                          {statusSaving ? "Updating..." : "✓ Unrestrict"}
                        </button>
                      ) : (
                        <button
                          className="status-btn restrict"
                          type="button"
                          disabled={statusSaving}
                          onClick={() => {
                            setStatusAction("restrict");
                            setStatusReason("");
                            setRestrictionDays("7");
                          }}
                        >
                          ⚠ Restrict User
                        </button>
                      )}
                    </div>
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
              <div className="section-title">Profile</div>

              <div className="profile-header">
                {memberDetail?.avatar_url ? (
                  <img
                    className="profile-avatar"
                    src={memberDetail.avatar_url}
                    alt="Profile"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.parentElement?.querySelector(".profile-avatar-fallback") as HTMLElement | null;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className={`profile-avatar-fallback ${memberDetail?.avatar_url ? "profile-avatar-hidden" : ""}`}
                  style={memberDetail?.avatar_url ? { display: "none" } : undefined}
                >
                  {(selectedMember.full_name || selectedMember.game_name || "M").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="profile-name">
                    {selectedMember.full_name || selectedMember.game_name || "Member"}
                  </div>
                  <div className="profile-game">
                    {selectedMember.game_name || "No game name"}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div className="info-label">Bio</div>
                <div className="bio-box">
                  {memberDetail?.bio || "No bio added."}
                </div>
              </div>
            </div>

            <div className="section">
              <div className="section-title">Referral Information</div>

              <div className="ref-summary">
                <div className="ref-card">
                  <div className="ref-label">My Referral Code</div>
                  <div className="ref-value">
                    {memberDetail?.referral_code || "—"}
                  </div>
                </div>
                <div className="ref-card">
                  <div className="ref-label">Total Referrals</div>
                  <div className="ref-value">
                    {Number(referral?.total_referrals || 0)}
                  </div>
                </div>
              </div>

              <div className="referrer-card">
                <div className="referrer-title">Referred By</div>
                {referral?.referrer ? (
                  <>
                    <div className="ref-value">
                      {referral.referrer.full_name || referral.referrer.game_name || "Member"}
                    </div>
                    <div className="referral-item-meta">
                      Code: {referral.referrer.referral_code || "—"}
                      {referral.referrer.phone ? ` · ${referral.referrer.phone}` : ""}
                    </div>
                  </>
                ) : (
                  <div className="ref-value">
                    {memberDetail?.referred_by || "No referrer"}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="referrer-title">Users Referred By This Member</div>
                {!referral?.users?.length ? (
                  <div className="no-history">No referrals yet.</div>
                ) : (
                  <div className="referral-list">
                    {referral.users.map((user: any) => (
                      <div className="referral-item" key={user.id}>
                        <div className="referral-item-top">
                          <span className="referral-item-name">
                            {user.full_name || user.game_name || "Member"}
                          </span>
                          <span className="referral-item-date">
                            {formatDate(user.created_at)}
                          </span>
                        </div>
                        <div className="referral-item-meta">
                          {user.game_name || "No game name"}
                          {user.phone ? ` · ${user.phone}` : ""}
                        </div>
                        <div className="referral-item-meta">
                          UID: {user.free_fire_uid || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="section">
              <div className="section-title">Device & Login Security</div>
              <div className="security-grid">
                <div className="security-card">
                  <div className="info-label">Current IP</div>
                  <div className="security-value">{memberDetail?.ip_address || selectedMember.ip_address || "Not recorded"}</div>
                </div>
                <div className="security-card">
                  <div className="info-label">Device Status</div>
                  <div className={`security-value ${memberDetail?.device_changed_at ? "device-warning" : ""}`}>
                    {memberDetail?.device_changed_at ? "⚠ Device Changed" : "✓ No device change recorded"}
                  </div>
                </div>
                <div className="security-card">
                  <div className="info-label">Last Login</div>
                  <div className="security-value">{formatDate(memberDetail?.last_login_at || null)}</div>
                </div>
                <div className="security-card">
                  <div className="info-label">Device ID</div>
                  <div className="security-value security-mono">{memberDetail?.device_id || "Not recorded"}</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="referrer-title">Login / Device History</div>
                {!loginHistory.length ? (
                  <div className="no-history">No login history recorded yet.</div>
                ) : (
                  <div className="history-list">
                    {loginHistory.map((login) => (
                      <div className="history-item" key={`${login.id}-${login.created_at}`}>
                        <div className="history-top">
                          <span className={`history-type ${login.device_changed ? "device-warning" : ""}`}>
                            {login.device_changed ? "⚠ NEW DEVICE" : "✓ LOGIN"}
                          </span>
                          <span className="history-date">{formatDate(login.created_at)}</span>
                        </div>
                        <div className="history-desc">IP: {login.ip_address || "Not recorded"}</div>
                        <div className="history-date">Device ID: {login.device_id || "Not recorded"}</div>
                        <div className="history-date" style={{ wordBreak: "break-word" }}>
                          {login.user_agent || "User agent not recorded"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="section">
              <div className="section-title">Daily Match Limits</div>
              <div className="match-limit-grid">
                <div className="match-limit-card">
                  <div className="match-limit-label">Free Fire</div>
                  <input className="match-limit-input" type="number" min="0" max="10000" step="1" placeholder="Unlimited" value={matchLimits.freeFire} onChange={(e) => setMatchLimits((v) => ({ ...v, freeFire: e.target.value }))} />
                </div>
                <div className="match-limit-card">
                  <div className="match-limit-label">Free Fire MAX</div>
                  <input className="match-limit-input" type="number" min="0" max="10000" step="1" placeholder="Unlimited" value={matchLimits.freeFireMax} onChange={(e) => setMatchLimits((v) => ({ ...v, freeFireMax: e.target.value }))} />
                </div>
                <div className="match-limit-card">
                  <div className="match-limit-label">Clash Squad</div>
                  <input className="match-limit-input" type="number" min="0" max="10000" step="1" placeholder="Unlimited" value={matchLimits.clashSquad} onChange={(e) => setMatchLimits((v) => ({ ...v, clashSquad: e.target.value }))} />
                </div>
                <div className="match-limit-card">
                  <div className="match-limit-label">Lone Wolf</div>
                  <input className="match-limit-input" type="number" min="0" max="10000" step="1" placeholder="Unlimited" value={matchLimits.loneWolf} onChange={(e) => setMatchLimits((v) => ({ ...v, loneWolf: e.target.value }))} />
                </div>
              </div>
              <div className="match-limit-help">Blank = Unlimited · 0 = no joins · Limit resets automatically each day.</div>
              <button className="match-limit-save" onClick={saveMatchLimits} disabled={savingMatchLimits}>
                {savingMatchLimits ? "Saving..." : "Save Match Limits"}
              </button>
              {matchLimitMessage && <div className="match-limit-message">{matchLimitMessage}</div>}
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