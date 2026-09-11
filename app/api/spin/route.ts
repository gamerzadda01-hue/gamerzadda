import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE = "gamerzadda_session";

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message, error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}

async function getUserId(request: NextRequest): Promise<string | null> {
  let token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    token = decodeURIComponent(token);
  } catch {}

  const tokenHash = hashValue(token);

  const { data: session, error } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("SPIN SESSION ERROR:", error);
    throw new Error("Unable to verify your session.");
  }

  if (!session?.user_id) return null;

  if (
    session.expires_at &&
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    await supabaseAdmin
      .from("user_sessions")
      .delete()
      .eq("token_hash", tokenHash);
    return null;
  }

  return String(session.user_id);
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return jsonError("Please login first to use Daily Spin.", 401);
    }

    /*
     * IMPORTANT:
     * Do NOT read/update wallet_balances here.
     *
     * process_daily_spin() performs the complete operation inside ONE
     * PostgreSQL transaction:
     *   Bonus -> Deposit fee deduction
     *   Winning reward credit
     *   wallet transaction insert
     *
     * Therefore there is NO database-visible intermediate state where
     * Winning can appear before Bonus/Deposit is deducted.
     */
    const { data, error } = await supabaseAdmin.rpc("process_daily_spin", {
      p_user_id: userId,
    });

    if (error) {
      console.error("SPIN RPC ERROR:", error);

      const msg = String(error.message || "");

      if (msg.toLowerCase().includes("already used")) {
        return jsonError(
          "You have already used your Daily Spin today. Come back tomorrow.",
          409
        );
      }

      if (msg.toLowerCase().includes("at least ₹10")) {
        return jsonError(msg, 400);
      }

      if (msg.toLowerCase().includes("wallet not found")) {
        return jsonError("Wallet not found for your account.", 404);
      }

      return jsonError(
        "Unable to complete the spin. Your wallet was not changed.",
        500
      );
    }

    if (!data || data.success !== true) {
      console.error("SPIN RPC INVALID RESPONSE:", data);
      return jsonError(
        "Unable to complete the spin. Your wallet was not changed.",
        500
      );
    }

    /*
     * Return ONLY the final committed wallet snapshot.
     * Frontend should replace its wallet state once with this object.
     */
    return NextResponse.json(
      {
        success: true,
        reward: Number(data.reward ?? 0),
        wheelIndex: Number(data.wheelIndex ?? 0),
        spinFee: Number(data.spinFee ?? 10),
        feeSource: {
          bonus: Number(data.feeSource?.bonus ?? 0),
          deposit: Number(data.feeSource?.deposit ?? 0),
          winning: 0,
        },
        wallet: {
          bonus: Number(data.wallet?.bonus ?? 0),
          deposit: Number(data.wallet?.deposit ?? 0),
          winning: Number(data.wallet?.winning ?? 0),
        },
        message:
          Number(data.reward ?? 0) > 0
            ? `Congratulations! You won ₹${Number(data.reward)}.`
            : "Better luck next time!",
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("DAILY SPIN FATAL ERROR:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to process Daily Spin right now.",
      500
    );
  }
}

export async function GET() {
  return jsonError("Method not allowed.", 405);
}
