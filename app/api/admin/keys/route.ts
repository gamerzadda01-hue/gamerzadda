import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function getAdminUserId(request: NextRequest) {
  const token = request.cookies.get("gamerzadda_session")?.value;

  if (!token) return null;

  let sessionToken = token;

  try {
    sessionToken = decodeURIComponent(token);
  } catch {}

  const tokenHash = hashValue(sessionToken);

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sessionError || !session?.user_id) return null;

  if (
    session.expires_at &&
    new Date(session.expires_at) <= new Date()
  ) {
    return null;
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError || user?.role !== "admin") return null;

  return String(user.id);
}

export async function POST(request: NextRequest) {
  try {
    // =========================
    // ADMIN AUTH
    // =========================
    const adminUserId = await getAdminUserId(request);

    if (!adminUserId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // =========================
    // REQUEST BODY
    // =========================
    const body = await request.json();

    const tournamentId = String(
      body?.tournamentId || ""
    ).trim();

    const roomId = String(
      body?.roomId || ""
    ).trim();

    const roomPassword = String(
      body?.roomPassword || ""
    ).trim();

    if (!tournamentId || !roomId || !roomPassword) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tournament ID, Room ID and Room Password are required.",
        },
        { status: 400 }
      );
    }

    // =========================
    // CHECK TOURNAMENT
    // =========================
    const {
      data: tournament,
      error: tournamentError,
    } = await supabaseAdmin
      .from("tournaments")
      .select("id")
      .eq("id", tournamentId)
      .maybeSingle();

    if (tournamentError) {
      throw tournamentError;
    }

    if (!tournament) {
      return NextResponse.json(
        {
          success: false,
          error: "Tournament not found.",
        },
        { status: 404 }
      );
    }

    // =========================
    // FIND MATCH FOR TOURNAMENT
    // =========================
    const {
      data: existingMatch,
      error: findMatchError,
    } = await supabaseAdmin
      .from("matches")
      .select("id")
      .eq("tournament_id", tournamentId)
      .limit(1)
      .maybeSingle();

    if (findMatchError) {
      throw findMatchError;
    }

    // =========================
    // UPDATE EXISTING MATCH
    // =========================
    if (existingMatch?.id) {
      const {
        data: updatedMatch,
        error: updateError,
      } = await supabaseAdmin
        .from("matches")
        .update({
          room_id: roomId,
          room_password: roomPassword,
          status: "live",
        })
        .eq("id", existingMatch.id)
        .select(
          "id,tournament_id,room_id,room_password,status"
        )
        .single();

      if (updateError) {
        throw updateError;
      }

      // Safety verification
      if (
        !updatedMatch ||
        String(updatedMatch.status).toLowerCase() !== "live"
      ) {
        throw new Error(
          "Match was updated but LIVE status could not be verified."
        );
      }

      return NextResponse.json({
        success: true,
        message: "LIVE KEYS sent to users successfully.",
        match: updatedMatch,
      });
    }

    // =========================
    // CREATE NEW LIVE MATCH
    // =========================
    const {
      data: newMatch,
      error: insertError,
    } = await supabaseAdmin
      .from("matches")
      .insert({
        tournament_id: tournamentId,
        room_id: roomId,
        room_password: roomPassword,
        status: "live",
      })
      .select(
        "id,tournament_id,room_id,room_password,status"
      )
      .single();

    if (insertError) {
      throw insertError;
    }

    if (
      !newMatch ||
      String(newMatch.status).toLowerCase() !== "live"
    ) {
      throw new Error(
        "Match was created but LIVE status could not be verified."
      );
    }

    return NextResponse.json({
      success: true,
      message: "LIVE KEYS sent to users successfully.",
      match: newMatch,
    });
  } catch (error) {
    console.error(
      "LIVE KEYS API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send LIVE KEYS.",
      },
      { status: 500 }
    );
  }
}