import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE = "gamerzadda_session";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

async function getUserId(request: NextRequest): Promise<string | null> {
  let token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    token = decodeURIComponent(token);
  } catch {}

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const { data: session, error } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    console.error("SCRATCH SESSION ERROR:", error);
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

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return json(
        { success: false, error: "Unauthorized. Please login again." },
        401
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "get_scratch_card_dashboard",
      { p_user_id: userId }
    );

    if (error) {
      console.error("SCRATCH DASHBOARD RPC ERROR:", error);
      return json(
        {
          success: false,
          error: "Unable to load Scratch Card data.",
        },
        500
      );
    }

    return json(data);
  } catch (error) {
    console.error("Scratch dashboard error:", error);
    return json(
      { success: false, error: "Internal server error." },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return json(
        { success: false, error: "Unauthorized. Please login again." },
        401
      );
    }

    const body = await request.json().catch(() => null);
    const cardId = String(body?.cardId || "").trim();

    if (!cardId) {
      return json(
        { success: false, error: "Scratch Card ID is required." },
        400
      );
    }

    const { data, error } = await supabaseAdmin.rpc("scratch_card_claim", {
      p_user_id: userId,
      p_card_id: cardId,
    });

    if (error) {
      console.error("SCRATCH CLAIM RPC ERROR:", error);

      const message = String(error.message || "");

      if (message.toLowerCase().includes("expired")) {
        return json(
          { success: false, error: "This Scratch Card has expired." },
          409
        );
      }

      if (message.toLowerCase().includes("already been used")) {
        return json(
          { success: false, error: "This Scratch Card has already been used." },
          409
        );
      }

      if (message.toLowerCase().includes("not found")) {
        return json(
          { success: false, error: "Scratch Card not found." },
          404
        );
      }

      if (message.toLowerCase().includes("wallet not found")) {
        return json(
          { success: false, error: "Wallet not found for your account." },
          404
        );
      }

      return json(
        {
          success: false,
          error: "Unable to scratch the card. Your wallet was not changed.",
        },
        500
      );
    }

    if (!data?.success) {
      return json(
        {
          success: false,
          error: "Unable to complete Scratch Card.",
        },
        500
      );
    }

    return json(data);
  } catch (error) {
    console.error("Scratch claim error:", error);
    return json(
      { success: false, error: "Internal server error." },
      500
    );
  }
}
