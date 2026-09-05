import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SESSION_COOKIE = "gamerzadda_session";

async function getUserId() {
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
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // -----------------------------
    // WALLET BALANCE
    // -----------------------------
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
      console.error("Wallet balance error:", walletError);

      return NextResponse.json(
        { error: "Failed to load wallet." },
        { status: 500 }
      );
    }

    const deposit = Number(wallet?.deposit_balance || 0);
    const bonus = Number(wallet?.bonus_balance || 0);
    const winning = Number(wallet?.winning_balance || 0);

    // -----------------------------
    // TRANSACTIONS
    // -----------------------------
    const { data: transactions, error: transactionError } =
      await supabaseAdmin
        .from("wallet_transactions")
        .select(`
          id,
          amount,
          type,
          description,
          reference_id,
          created_at
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

    if (transactionError) {
      console.error(
        "Transaction history error:",
        transactionError
      );
    }

    // -----------------------------
    // WITHDRAWAL HISTORY
    // -----------------------------
    const { data: withdrawals, error: withdrawalError } =
      await supabaseAdmin
        .from("withdraw_requests")
        .select(`
          id,
          amount,
          upi_id,
          status,
          admin_note,
          created_at,
          processed_at
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

    if (withdrawalError) {
      console.error(
        "Withdrawal history error:",
        withdrawalError
      );
    }

    return NextResponse.json({
      success: true,

      wallet: {
        deposit,
        bonus,
        winning,
        total: deposit + bonus + winning,
      },

      transactions: transactions || [],

      withdrawals: withdrawals || [],
    });
  } catch (error) {
    console.error("Wallet API error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}