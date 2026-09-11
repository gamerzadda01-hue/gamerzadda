import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hashValue(value: string) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

export async function GET() {
  try {
    const cookieStore = await cookies();

    const sessionToken = cookieStore.get(
      "gamerzadda_session"
    )?.value;

    // No session = logged out
    if (!sessionToken) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    const tokenHash = hashValue(sessionToken);

    const { data: session, error } = await supabaseAdmin
      .from("user_sessions")
      .select("user_id, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    // Session not found
    if (error || !session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    // Session expired
    if (
      session.expires_at &&
      new Date(session.expires_at).getTime() <= Date.now()
    ) {
      await supabaseAdmin
        .from("user_sessions")
        .delete()
        .eq("token_hash", tokenHash);

      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    // Session is valid
    return NextResponse.json(
      {
        authenticated: true,
        userId: session.user_id,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("ME API ERROR:", error);

    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }
}