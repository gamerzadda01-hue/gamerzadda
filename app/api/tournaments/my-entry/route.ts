import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function getUserId(request: NextRequest) {
  const token = request.cookies.get("gamerzadda_session")?.value;

  if (!token) return null;

  let sessionToken = token;

  try {
    sessionToken = decodeURIComponent(token);
  } catch {}

  const tokenHash = hashValue(sessionToken);

  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session?.user_id) return null;

  if (
    session.expires_at &&
    new Date(session.expires_at) <= new Date()
  ) {
    return null;
  }

  return String(session.user_id);
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const tournamentId =
      request.nextUrl.searchParams.get("tournamentId");

    if (!tournamentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Tournament ID is required",
        },
        { status: 400 }
      );
    }

    // Only ACTIVE entry means user is currently joined.
    const { data: entry, error } = await supabaseAdmin
      .from("tournament_entries")
      .select("id,user_id,cancelled")
      .eq("tournament_id", tournamentId)
      .eq("user_id", userId)
      .eq("cancelled", false)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      userId,
      entryId: entry?.id ?? null,
      joined: !!entry,
    });
  } catch (error) {
    console.error("my-entry error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to verify participant.",
      },
      { status: 500 }
    );
  }
}