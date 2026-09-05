import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SESSION_COOKIE = "gamerzadda_session";
const MIN_WITHDRAWAL = 50;

async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session) return null;

  if (new Date(session.expires_at) <= new Date()) {
    await supabaseAdmin.from("user_sessions").delete().eq("token_hash", tokenHash);
    return null;
  }
  return session.user_id;
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { count, error } = await supabaseAdmin
      .from("withdraw_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startOfToday.toISOString());

    if (error) {
      console.error("Withdrawal count error:", error);
      return NextResponse.json({ error: "Unable to load withdrawal information." }, { status: 500 });
    }

    const todayWithdrawals = count || 0;

    return NextResponse.json({
      success: true,
      todayWithdrawals,
      serviceCharge: todayWithdrawals === 0 ? 5 : 10,
    });
  } catch (error) {
    console.error("Withdrawal GET error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await request.json();
    const amount = Number(body?.amount);
    const upiId = typeof body?.upiId === "string" ? body.upiId.trim() : "";

    if (!Number.isFinite(amount))
      return NextResponse.json({ error: "Enter a valid withdrawal amount." }, { status: 400 });

    if (amount < MIN_WITHDRAWAL)
      return NextResponse.json({ error: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}.` }, { status: 400 });

    if (Math.round(amount * 100) !== amount * 100)
      return NextResponse.json({ error: "Amount can have maximum 2 decimal places." }, { status: 400 });

    if (!upiId)
      return NextResponse.json({ error: "UPI ID is required." }, { status: 400 });

    if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(upiId))
      return NextResponse.json({ error: "Enter a valid UPI ID." }, { status: 400 });

    const { data, error } = await supabaseAdmin.rpc("create_withdrawal_request", {
      p_user_id: userId,
      p_amount: amount,
      p_upi_id: upiId,
    });

    if (error) {
      console.error("Withdrawal RPC error:", error);
      return NextResponse.json({ error: "Unable to process withdrawal request." }, { status: 500 });
    }

    if (!data?.success)
      return NextResponse.json({ error: data?.error || "Withdrawal failed." }, { status: 400 });

    return NextResponse.json({
      success: true,
      message: data.message,
      withdrawalId: data.withdrawal_id,
      amount: Number(data.amount),
      serviceCharge: Number(data.service_charge),
      netAmount: Number(data.net_amount),
    });
  } catch (error) {
    console.error("Withdraw API error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
