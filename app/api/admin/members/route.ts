import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("gamerzadda_session")?.value;

  if (!token) {
    return { ok: false, error: "Admin login required." };
  }

  // Match the existing session-token architecture used by the app.
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", token)
    .maybeSingle();

  if (sessionError || !session?.user_id) {
    return { ok: false, error: "Invalid session." };
  }

  if (
    session.expires_at &&
    new Date(session.expires_at).getTime() < Date.now()
  ) {
    return { ok: false, error: "Session expired." };
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", session.user_id)
    .maybeSingle();

  if (adminError || admin?.role !== "admin") {
    return { ok: false, error: "Access denied. Admin only." };
  }

  return { ok: true, adminId: session.user_id };
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

    if (userId) {
      const { data: member, error: memberError } = await supabaseAdmin
        .from("users")
        .select(
          "id, full_name, phone, email, free_fire_uid, role, created_at, ip_address, game_name, status"
        )
        .eq("id", userId)
        .maybeSingle();

      if (memberError) throw memberError;

      if (!member) {
        return NextResponse.json(
          { success: false, error: "Member not found." },
          { status: 404 }
        );
      }

      const { data: wallet, error: walletError } = await supabaseAdmin
        .from("wallet_balances")
        .select("deposit_balance, bonus_balance, winning_balance")
        .eq("user_id", userId)
        .maybeSingle();

      if (walletError) throw walletError;

      return NextResponse.json({
        success: true,
        member,
        wallet: wallet || null,
      });
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from("users")
      .select(
        "id, full_name, phone, email, free_fire_uid, role, created_at, ip_address, game_name, status"
      )
      .order("created_at", { ascending: false });

    if (membersError) throw membersError;

    const rows = members || [];
    const ids = rows.map((m) => m.id);

    const walletMap: Record<string, number> = {};
    const activityMap: Record<string, string | null> = {};

    if (ids.length) {
      const { data: wallets, error: walletError } = await supabaseAdmin
        .from("wallet_balances")
        .select("user_id, deposit_balance, bonus_balance, winning_balance")
        .in("user_id", ids);

      if (walletError) throw walletError;

      for (const wallet of wallets || []) {
        walletMap[wallet.user_id] =
          Number(wallet.deposit_balance || 0) +
          Number(wallet.bonus_balance || 0) +
          Number(wallet.winning_balance || 0);
      }

      const { data: transactions, error: txError } = await supabaseAdmin
        .from("wallet_transactions")
        .select("user_id, created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false });

      if (txError) throw txError;

      for (const tx of transactions || []) {
        if (!activityMap[tx.user_id]) {
          activityMap[tx.user_id] = tx.created_at;
        }
      }
    }

    return NextResponse.json({
      success: true,
      members: rows.map((member) => ({
        ...member,
        wallet_total: walletMap[member.id] || 0,
        last_wallet_activity: activityMap[member.id] || null,
      })),
    });
  } catch (error: any) {
    console.error("Admin members API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unable to load members.",
      },
      { status: 500 }
    );
  }
}
