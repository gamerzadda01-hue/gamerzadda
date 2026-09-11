import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (bearerToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(bearerToken);
    if (!error && data?.user?.id) {
      const { data: admin, error: adminError } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!adminError && admin?.role === "admin") {
        return { ok: true, userId: data.user.id };
      }
      return { ok: false, error: "Access denied. Admin only." };
    }
  }

  const token = request.cookies.get("gamerzadda_session")?.value;
  if (!token) return { ok: false, error: "Admin login required." };

  let sessionToken = token;
  try {
    sessionToken = decodeURIComponent(token);
  } catch {}

  const tokenHash = hashValue(sessionToken);
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sessionError || !session?.user_id) {
    return { ok: false, error: "Invalid session." };
  }

  if (session.expires_at && new Date(session.expires_at) <= new Date()) {
    return { ok: false, error: "Session expired." };
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", session.user_id)
    .maybeSingle();

  if (adminError || admin?.role !== "admin") {
    return { ok: false, error: "Access denied. Admin only." };
  }

  return { ok: true, userId: session.user_id };
}

const DEFAULTS = {
  signup_bonus: 20,
  referrer_signup_reward_min: 30,
  referrer_signup_reward_max: 60,
  referred_signup_reward_min: 30,
  referred_signup_reward_max: 50,
  tournament_reward_min: 20,
  tournament_reward_max: 40,
  first_deposit_percent: 10,
  is_active: true,
};

function roundMoney(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function validateRange(label: string, min: number | null, max: number | null) {
  if (min === null || max === null) {
    return `${label} must contain valid numbers.`;
  }
  if (min < 0 || min > 100000 || max < 0 || max > 100000) {
    return `${label} must be between ₹0 and ₹100000.`;
  }
  if (min > max) {
    return `${label} minimum cannot be greater than maximum.`;
  }
  return null;
}

async function getSettings() {
  const { data, error } = await supabaseAdmin
    .from("referral_settings")
    .select(
      "id, signup_bonus, referrer_signup_reward_min, referrer_signup_reward_max, referred_signup_reward_min, referred_signup_reward_max, tournament_reward_min, tournament_reward_max, first_deposit_percent, is_active, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (data) return data;

  const { data: created, error: createError } = await supabaseAdmin
    .from("referral_settings")
    .insert(DEFAULTS)
    .select(
      "id, signup_bonus, referrer_signup_reward_min, referrer_signup_reward_max, referred_signup_reward_min, referred_signup_reward_max, tournament_reward_min, tournament_reward_max, first_deposit_percent, is_active, created_at, updated_at"
    )
    .single();

  if (createError) throw createError;
  return created;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const settings = await getSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error("Referral settings GET error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Unable to load referral settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();

    const signupBonus = roundMoney(body.signup_bonus);
    const referrerMin = roundMoney(body.referrer_signup_reward_min);
    const referrerMax = roundMoney(body.referrer_signup_reward_max);
    const referredMin = roundMoney(body.referred_signup_reward_min);
    const referredMax = roundMoney(body.referred_signup_reward_max);
    const tournamentMin = roundMoney(body.tournament_reward_min);
    const tournamentMax = roundMoney(body.tournament_reward_max);
    const firstDepositPercent = roundMoney(body.first_deposit_percent);
    const isActive = Boolean(body.is_active);

    if (
      signupBonus === null ||
      signupBonus < 0 ||
      signupBonus > 100000
    ) {
      return NextResponse.json(
        { success: false, error: "Signup bonus must be between ₹0 and ₹100000." },
        { status: 400 }
      );
    }

    const rangeErrors = [
      validateRange("Referrer signup reward", referrerMin, referrerMax),
      validateRange("Referred user signup reward", referredMin, referredMax),
      validateRange("First tournament reward", tournamentMin, tournamentMax),
    ].filter(Boolean) as string[];

    if (rangeErrors.length) {
      return NextResponse.json(
        { success: false, error: rangeErrors[0] },
        { status: 400 }
      );
    }

    if (
      firstDepositPercent === null ||
      firstDepositPercent < 0 ||
      firstDepositPercent > 100
    ) {
      return NextResponse.json(
        { success: false, error: "First deposit percentage must be between 0% and 100%." },
        { status: 400 }
      );
    }

    const values = [
      signupBonus,
      referrerMin,
      referrerMax,
      referredMin,
      referredMax,
      tournamentMin,
      tournamentMax,
      firstDepositPercent,
    ];

    if (values.some((value) => value === null || !Number.isFinite(value))) {
      return NextResponse.json(
        { success: false, error: "All referral settings must contain valid numbers." },
        { status: 400 }
      );
    }

    const current = await getSettings();

    const { data: settings, error } = await supabaseAdmin
      .from("referral_settings")
      .update({
        signup_bonus: signupBonus,
        referrer_signup_reward_min: referrerMin,
        referrer_signup_reward_max: referrerMax,
        referred_signup_reward_min: referredMin,
        referred_signup_reward_max: referredMax,
        tournament_reward_min: tournamentMin,
        tournament_reward_max: tournamentMax,
        first_deposit_percent: firstDepositPercent,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .select(
        "id, signup_bonus, referrer_signup_reward_min, referrer_signup_reward_max, referred_signup_reward_min, referred_signup_reward_max, tournament_reward_min, tournament_reward_max, first_deposit_percent, is_active, created_at, updated_at"
      )
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error("Referral settings PATCH error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Unable to save referral settings." },
      { status: 500 }
    );
  }
}
