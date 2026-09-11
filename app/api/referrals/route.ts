import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function hashSession(session: string) {
  return crypto.createHash("sha256").update(session).digest("hex");
}

async function getCurrentUserId() {
  const cookieStore = await cookies();
  const session = cookieStore.get("gamerzadda_session")?.value;

  if (!session) return null;

  const tokenHash = hashSession(session);

  const { data: sessionRow } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!sessionRow) return null;

  if (
    sessionRow.expires_at &&
    new Date(sessionRow.expires_at).getTime() <= Date.now()
  ) {
    return null;
  }

  return sessionRow.user_id;
}

export async function GET(_request: NextRequest) {
  try {
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { authenticated: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id,referral_code,status")
      .eq("id", userId)
      .maybeSingle();

    if (userError) throw userError;

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (user.status === "blocked") {
      return NextResponse.json(
        { error: "Your account is blocked." },
        { status: 403 }
      );
    }

    const { data: referrals, error: referralError } = await supabaseAdmin
      .from("referrals")
      .select("id,referred_user_id,referral_code,created_at")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false });

    if (referralError) throw referralError;

    const rows = referrals || [];
    const referredIds = [...new Set(rows.map((row) => row.referred_user_id))];
    const referralIds = rows.map((row) => row.id);

    const usersMap = new Map<string, any>();

    if (referredIds.length > 0) {
      const { data: referredUsers, error: usersError } = await supabaseAdmin
        .from("users")
        .select("id,full_name,referral_code,created_at")
        .in("id", referredIds);

      if (usersError) throw usersError;

      for (const referredUser of referredUsers || []) {
        usersMap.set(referredUser.id, referredUser);
      }
    }

    const rewardsMap = new Map<string, any[]>();

    if (referralIds.length > 0) {
      const { data: rewards, error: rewardsError } = await supabaseAdmin
        .from("referral_rewards")
        .select(
          "id,referral_id,reward_type,referrer_amount,referred_amount,referrer_wallet,referred_wallet,created_at"
        )
        .in("referral_id", referralIds)
        .order("created_at", { ascending: false });

      if (rewardsError) throw rewardsError;

      for (const reward of rewards || []) {
        const current = rewardsMap.get(reward.referral_id) || [];
        current.push(reward);
        rewardsMap.set(reward.referral_id, current);
      }
    }

    let totalEarnings = 0;
    let signupRewards = 0;
    let tournamentRewards = 0;
    let depositRewards = 0;

    const referralList = rows.map((referral) => {
      const rewards = rewardsMap.get(referral.id) || [];

      for (const reward of rewards) {
        const amount = Number(reward.referrer_amount || 0);
        totalEarnings += amount;

        if (reward.reward_type === "signup") signupRewards += amount;
        if (reward.reward_type === "first_tournament") {
          tournamentRewards += amount;
        }
        if (reward.reward_type === "first_deposit") depositRewards += amount;
      }

      const referredUser = usersMap.get(referral.referred_user_id);

      return {
        id: referral.id,
        full_name: referredUser?.full_name || "GAMERZADDA User",
        referral_code: referral.referral_code,
        created_at: referral.created_at,
        rewards,
      };
    });

    return NextResponse.json({
      referralCode: user.referral_code || null,
      totalReferrals: referralList.length,
      totalEarnings,
      signupRewards,
      tournamentRewards,
      depositRewards,
      referrals: referralList,
    });
  } catch (error) {
    console.error("User referrals API error:", error);

    return NextResponse.json(
      { error: "Failed to load referrals." },
      { status: 500 }
    );
  }
}
