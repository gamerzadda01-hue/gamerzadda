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

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const { data: session, error } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("SESSION DB ERROR:", error);
    return null;
  }

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
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { count, error } = await supabaseAdmin
      .from("withdraw_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startOfToday.toISOString());

    if (error) {
      console.error("WITHDRAW GET DB ERROR:", error);

      return NextResponse.json(
        {
          error: "Unable to load withdrawal information.",
          debug: error.message,
        },
        { status: 500 }
      );
    }

    const todayWithdrawals = count || 0;

    return NextResponse.json({
      success: true,
      todayWithdrawals,
      serviceCharge: todayWithdrawals === 0 ? 5 : 10,
    });
  } catch (error: any) {
    console.error("WITHDRAW GET ERROR:", error);

    return NextResponse.json(
      {
        error: "Something went wrong.",
        debug: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    console.log("========== WITHDRAW POST START ==========");

    const userId = await getUserId();

    console.log("WITHDRAW USER ID:", userId);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();

    console.log("WITHDRAW BODY:", {
      amount: body?.amount,
      upiId: body?.upiId,
    });

    const amount = Number(body?.amount);

    const upiId =
      typeof body?.upiId === "string"
        ? body.upiId.trim()
        : "";

    if (!Number.isFinite(amount)) {
      return NextResponse.json(
        { error: "Enter a valid withdrawal amount." },
        { status: 400 }
      );
    }

    if (amount < MIN_WITHDRAWAL) {
      return NextResponse.json(
        {
          error: `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}.`,
        },
        { status: 400 }
      );
    }

    if (Math.round(amount * 100) !== amount * 100) {
      return NextResponse.json(
        {
          error: "Amount can have maximum 2 decimal places.",
        },
        { status: 400 }
      );
    }

    if (!upiId) {
      return NextResponse.json(
        { error: "UPI ID is required." },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$/.test(upiId)) {
      return NextResponse.json(
        { error: "Enter a valid UPI ID." },
        { status: 400 }
      );
    }

    console.log("CALLING WITHDRAW RPC...");

    const { data, error } = await supabaseAdmin.rpc(
      "create_withdrawal_request",
      {
        p_user_id: userId,
        p_amount: amount,
        p_upi_id: upiId,
      }
    );

    console.log("RPC DATA:", data);
    console.log("RPC ERROR:", error);

    if (error) {
      console.error("WITHDRAWAL RPC ERROR:", error);

      return NextResponse.json(
        {
          error: "Unable to process withdrawal request.",
          debug: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    if (!data?.success) {
      console.error("WITHDRAWAL RPC FAILED:", data);

      return NextResponse.json(
        {
          error: data?.error || "Withdrawal failed.",
          debug: data,
        },
        { status: 400 }
      );
    }

    console.log("WITHDRAW SUCCESS:", data);
    console.log("========== WITHDRAW POST END ==========");

    return NextResponse.json({
      success: true,
      message: data.message,
      withdrawalId: data.withdrawal_id,
      amount: Number(data.amount),
      serviceCharge: Number(data.service_charge),
      netAmount: Number(data.net_amount),
    });
  } catch (error: any) {
    console.error("WITHDRAW API ERROR:", error);

    return NextResponse.json(
      {
        error: "Something went wrong.",
        debug: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}