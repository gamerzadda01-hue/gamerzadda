import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SESSION_COOKIE = "gamerzadda_session";

async function getUserFromSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session) return null;

  if (new Date(session.expires_at) <= new Date()) {
    await supabaseAdmin
      .from("user_sessions")
      .delete()
      .eq("token_hash", tokenHash);

    return null;
  }

  return session.user_id;
}

export async function GET() {
  try {
    const userId = await getUserFromSession();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select(`
        id,
        full_name,
        email,
        phone,
        referral_code,
        bio,
        avatar_url
      `)
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Get wallet balance
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallet_balances")
      .select(`
        deposit_balance,
        bonus_balance,
        winning_balance
      `)
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError) {
      console.error("Wallet fetch error:", walletError);
    }

    return NextResponse.json({
      profile: {
        id: user.id,
        name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        referralCode: user.referral_code || "",
        bio: user.bio || "",
        avatarUrl: user.avatar_url || "",
      },

      wallet: {
        deposit: Number(wallet?.deposit_balance || 0),
        bonus: Number(wallet?.bonus_balance || 0),
        winning: Number(wallet?.winning_balance || 0),
        total:
          Number(wallet?.deposit_balance || 0) +
          Number(wallet?.bonus_balance || 0) +
          Number(wallet?.winning_balance || 0),
      },
    });
  } catch (error) {
    console.error("Profile API error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getUserFromSession();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Only BIO can be changed.
    // Name, email, phone and referral code
    // are intentionally NOT accepted here.

    const bio =
      typeof body.bio === "string"
        ? body.bio
        : undefined;

    if (bio === undefined) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 }
      );
    }

    if (bio.length > 30) {
      return NextResponse.json(
        { error: "Bio cannot exceed 30 characters." },
        { status: 400 }
      );
    }

    if (!/^[A-Za-z0-9 ]*$/.test(bio)) {
      return NextResponse.json(
        {
          error:
            "Bio can contain only letters, numbers and spaces.",
        },
        { status: 400 }
      );
    }

    const { data: updatedUser, error } = await supabaseAdmin
      .from("users")
      .update({
        bio,
      })
      .eq("id", userId)
      .select(`
        id,
        full_name,
        email,
        phone,
        referral_code,
        bio,
        avatar_url
      `)
      .single();

    if (error || !updatedUser) {
      console.error("Profile update error:", error);

      return NextResponse.json(
        { error: "Failed to update profile." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,

      profile: {
        id: updatedUser.id,
        name: updatedUser.full_name || "",
        email: updatedUser.email || "",
        phone: updatedUser.phone || "",
        referralCode: updatedUser.referral_code || "",
        bio: updatedUser.bio || "",
        avatarUrl: updatedUser.avatar_url || "",
      },
    });
  } catch (error) {
    console.error("Profile PATCH error:", error);

    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}