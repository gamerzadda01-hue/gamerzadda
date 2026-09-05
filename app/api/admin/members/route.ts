import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function requireAdmin(request: NextRequest) {
  // 1. Admin panel uses Supabase Auth. Prefer its Bearer token.
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

  // 2. Keep compatibility with GamerzAdda custom session cookie.
  const token = request.cookies.get("gamerzadda_session")?.value;

  if (!token) {
    return { ok: false, error: "Admin login required." };
  }

  let sessionToken = token;
  try {
    sessionToken = decodeURIComponent(token);
  } catch {
    // Use the original value if decoding fails.
  }

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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const userId = request.nextUrl.searchParams.get("userId");

    // Detail request: return one member's wallet.
    if (userId) {
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from("wallet_balances")
        .select("deposit_balance, bonus_balance, winning_balance")
        .eq("user_id", userId)
        .maybeSingle();

      if (walletError) {
        console.error("Member wallet error:", walletError);
        return NextResponse.json(
          { success: false, error: "Unable to load wallet." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        wallet: wallet || {
          deposit_balance: 0,
          bonus_balance: 0,
          winning_balance: 0,
        },
      });
    }

    // List all members.
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select(
        "id, full_name, phone, email, free_fire_uid, role, created_at, ip_address, game_name, status"
      )
      .order("created_at", { ascending: false });

    if (usersError) {
      console.error("Members query error:", usersError);
      return NextResponse.json(
        { success: false, error: usersError.message },
        { status: 500 }
      );
    }

    const memberRows = users || [];
    const memberIds = memberRows.map((member) => member.id);

    const walletMap: Record<string, number> = {};
    const activityMap: Record<string, string | null> = {};

    if (memberIds.length > 0) {
      const { data: wallets, error: walletError } = await supabaseAdmin
        .from("wallet_balances")
        .select("user_id, deposit_balance, bonus_balance, winning_balance")
        .in("user_id", memberIds);

      if (walletError) {
        console.error("Wallet list error:", walletError);
      }

      for (const wallet of wallets || []) {
        walletMap[wallet.user_id] =
          Number(wallet.deposit_balance || 0) +
          Number(wallet.bonus_balance || 0) +
          Number(wallet.winning_balance || 0);
      }

      const { data: transactions, error: transactionError } =
        await supabaseAdmin
          .from("wallet_transactions")
          .select("user_id, created_at")
          .in("user_id", memberIds)
          .order("created_at", { ascending: false });

      if (transactionError) {
        console.error("Wallet activity error:", transactionError);
      }

      for (const tx of transactions || []) {
        if (!activityMap[tx.user_id]) {
          activityMap[tx.user_id] = tx.created_at;
        }
      }
    }

    const members = memberRows.map((member) => ({
      ...member,
      wallet_total: walletMap[member.id] || 0,
      last_wallet_activity: activityMap[member.id] || null,
    }));

    return NextResponse.json({ success: true, members });
  } catch (error) {
    console.error("Admin members API error:", error);

    return NextResponse.json(
      { success: false, error: "Something went wrong." },
      { status: 500 }
    );
  }
}
