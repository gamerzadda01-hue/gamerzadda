import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

  if (!token) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sessionError || !session) return null;
  if (new Date(session.expires_at) <= new Date()) return null;

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("users")
    .select("id,role,status")
    .eq("id", session.user_id)
    .maybeSingle();

  if (adminError || !admin) return null;
  if (String(admin.role || "").toLowerCase() !== "admin") return null;
  if (String(admin.status || "active").toLowerCase() !== "active") return null;

  return admin;
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);

    if (!admin) {
      return NextResponse.json({ success: false, message: "Admin access required." }, { status: 403 });
    }

    const url = new URL(request.url);
    const search = String(url.searchParams.get("search") || "").trim();

    const { data: referrals, error } = await supabaseAdmin
      .from("referrals")
      .select("id,referrer_id,referred_user_id,referral_code,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) throw error;

    const referralRows = referrals || [];
    const userIds = Array.from(
      new Set(
        referralRows.flatMap((r) => [r.referrer_id, r.referred_user_id]).filter(Boolean)
      )
    );

    let users: any[] = [];

    if (userIds.length) {
      const { data, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id,full_name,phone,email,referral_code")
        .in("id", userIds);

      if (usersError) throw usersError;
      users = data || [];
    }

    const userMap = new Map(users.map((u) => [u.id, u]));

    const referralIds = referralRows.map((r) => r.id);
    let rewards: any[] = [];

    if (referralIds.length) {
      const { data, error: rewardsError } = await supabaseAdmin
        .from("referral_rewards")
        .select(
          "id,referral_id,referrer_id,referred_user_id,reward_type,referrer_amount,referred_amount,referrer_wallet,referred_wallet,reference_id,created_at"
        )
        .in("referral_id", referralIds)
        .order("created_at", { ascending: false });

      if (rewardsError) throw rewardsError;
      rewards = data || [];
    }

    const rewardsByReferral = new Map<string, any[]>();

    for (const reward of rewards) {
      const list = rewardsByReferral.get(reward.referral_id) || [];
      list.push(reward);
      rewardsByReferral.set(reward.referral_id, list);
    }

    let rows = referralRows.map((referral) => {
      const referrer = userMap.get(referral.referrer_id);
      const referred = userMap.get(referral.referred_user_id);
      const referralRewards = rewardsByReferral.get(referral.id) || [];

      const totalReward = referralRewards.reduce(
        (sum, r) =>
          sum + Number(r.referrer_amount || 0) + Number(r.referred_amount || 0),
        0
      );

      return {
        ...referral,
        referrer: referrer
          ? {
              id: referrer.id,
              full_name: referrer.full_name,
              phone: referrer.phone,
              email: referrer.email,
              referral_code: referrer.referral_code,
            }
          : null,
        referred: referred
          ? {
              id: referred.id,
              full_name: referred.full_name,
              phone: referred.phone,
              email: referred.email,
              referral_code: referred.referral_code,
            }
          : null,
        rewards: referralRewards,
        total_reward: Math.round(totalReward * 100) / 100,
      };
    });

    if (search) {
      const q = search.toLowerCase();

      rows = rows.filter((row) => {
        const values = [
          row.referral_code,
          row.referrer?.full_name,
          row.referrer?.phone,
          row.referrer?.email,
          row.referred?.full_name,
          row.referred?.phone,
          row.referred?.email,
        ];

        return values.some((value) =>
          String(value || "").toLowerCase().includes(q)
        );
      });
    }

    const stats = {
      totalReferrals: referralRows.length,
      signupRewards: 0,
      tournamentRewards: 0,
      depositRewards: 0,
      totalRewards: 0,
    };

    for (const reward of rewards) {
      const total =
        Number(reward.referrer_amount || 0) +
        Number(reward.referred_amount || 0);

      stats.totalRewards += total;

      if (reward.reward_type === "signup") stats.signupRewards += total;
      if (reward.reward_type === "first_tournament") stats.tournamentRewards += total;
      if (reward.reward_type === "first_deposit") stats.depositRewards += total;
    }

    stats.totalRewards = Math.round(stats.totalRewards * 100) / 100;
    stats.signupRewards = Math.round(stats.signupRewards * 100) / 100;
    stats.tournamentRewards = Math.round(stats.tournamentRewards * 100) / 100;
    stats.depositRewards = Math.round(stats.depositRewards * 100) / 100;

    return NextResponse.json({
      success: true,
      stats,
      referrals: rows,
    });
  } catch (error) {
    console.error("Admin referrals API error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load referral data." },
      { status: 500 }
    );
  }
}
