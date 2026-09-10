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

  const { data: session, error } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !session) return null;

  if (new Date(session.expires_at) <= new Date()) {
    await supabaseAdmin
      .from("user_sessions")
      .delete()
      .eq("token_hash", tokenHash);

    return null;
  }

  return session.user_id;
}

export async function GET(request: Request) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tournamentId = String(
      searchParams.get("tournamentId") || ""
    ).trim();

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: "Tournament ID is required." },
        { status: 400 }
      );
    }

    // IMPORTANT:
    // A Duo team is active only when the creator still has
    // an active tournament entry. This prevents a cancelled
    // entry from showing the old Team Code again.
    const { data: entry, error: entryError } = await supabaseAdmin
      .from("tournament_entries")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("user_id", userId)
      .eq("cancelled", false)
      .maybeSingle();

    if (entryError) {
      console.error("Duo my-team entry check error:", entryError);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify your tournament entry.",
        },
        { status: 500 }
      );
    }

    // No active tournament entry = no active Duo team.
    if (!entry) {
      return NextResponse.json({
        success: true,
        teamCode: null,
        team: null,
      });
    }

    const { data: team, error: teamError } = await supabaseAdmin
      .from("duo_teams")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("creator_user_id", userId)
      .neq("status", "cancelled")
      .maybeSingle();

    if (teamError) {
      console.error("Duo my-team database error:", teamError);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to fetch your Duo team.",
        },
        { status: 500 }
      );
    }

    if (!team) {
      return NextResponse.json({
        success: true,
        teamCode: null,
        team: null,
      });
    }

    const teamCode = String(team.team_code || "").trim();

    return NextResponse.json({
      success: true,
      teamCode,
      team,
    });
  } catch (error) {
    console.error("Duo my-team API:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}
