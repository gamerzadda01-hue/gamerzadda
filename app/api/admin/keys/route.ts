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

  if (!token) {
    return null;
  }

  let sessionToken = token;

  try {
    sessionToken = decodeURIComponent(token);
  } catch {
    // Keep original token if decoding fails
  }

  const tokenHash = hashValue(sessionToken);

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sessionError) {
    console.error("ADMIN SESSION ERROR:", sessionError);
    return null;
  }

  if (!session?.user_id) {
    return null;
  }

  if (
    session.expires_at &&
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    return null;
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, role")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError) {
    console.error("ADMIN USER ERROR:", userError);
    return null;
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return String(user.id);
}

export async function POST(request: NextRequest) {
  try {
    // --------------------------------------------------
    // 1. VERIFY ADMIN
    // --------------------------------------------------
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

    // --------------------------------------------------
    // 2. READ REQUEST BODY
    // --------------------------------------------------
    const body = await request.json();

    const tournamentId = String(body?.tournamentId || "").trim();
    const roomId = String(body?.roomId || "").trim();
    const roomPassword = String(body?.roomPassword || "").trim();

    if (!tournamentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Tournament ID is required.",
        },
        { status: 400 }
      );
    }

    if (!roomId) {
      return NextResponse.json(
        {
          success: false,
          error: "Room ID is required.",
        },
        { status: 400 }
      );
    }

    if (!roomPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "Room Password is required.",
        },
        { status: 400 }
      );
    }

    console.log("=================================");
    console.log("LIVE KEYS REQUEST");
    console.log("Admin:", adminUserId);
    console.log("Tournament:", tournamentId);
    console.log("Room ID:", roomId);
    console.log("=================================");

    // --------------------------------------------------
    // 3. VERIFY TOURNAMENT EXISTS
    // --------------------------------------------------
    const { data: tournament, error: tournamentFindError } =
      await supabaseAdmin
        .from("tournaments")
        .select("id, status")
        .eq("id", tournamentId)
        .maybeSingle();

    if (tournamentFindError) {
      console.error(
        "TOURNAMENT FIND ERROR:",
        tournamentFindError
      );

      throw tournamentFindError;
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

    // --------------------------------------------------
    // 4. FIND EXISTING MATCH
    // --------------------------------------------------
    const { data: existingMatch, error: matchFindError } =
      await supabaseAdmin
        .from("matches")
        .select("id, tournament_id, status")
        .eq("tournament_id", tournamentId)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (matchFindError) {
      console.error(
        "MATCH FIND ERROR:",
        matchFindError
      );

      throw matchFindError;
    }

    let matchId: string | number;

    // --------------------------------------------------
    // 5. UPDATE EXISTING MATCH
    // --------------------------------------------------
    if (existingMatch?.id) {
      matchId = existingMatch.id;

      const { error: matchUpdateError } = await supabaseAdmin
        .from("matches")
        .update({
          room_id: roomId,
          room_password: roomPassword,
          status: "live",
        })
        .eq("id", existingMatch.id);

      if (matchUpdateError) {
        console.error(
          "MATCH UPDATE ERROR:",
          matchUpdateError
        );

        throw matchUpdateError;
      }
    }

    // --------------------------------------------------
    // 6. CREATE MATCH IF NONE EXISTS
    // --------------------------------------------------
    else {
      const { data: newMatch, error: insertMatchError } =
        await supabaseAdmin
          .from("matches")
          .insert({
            tournament_id: tournamentId,
            room_id: roomId,
            room_password: roomPassword,
            status: "live",
          })
          .select("id")
          .single();

      if (insertMatchError) {
        console.error(
          "MATCH INSERT ERROR:",
          insertMatchError
        );

        throw insertMatchError;
      }

      if (!newMatch?.id) {
        throw new Error(
          "Match was created but match ID was not returned."
        );
      }

      matchId = newMatch.id;
    }

    // --------------------------------------------------
    // 7. MAKE TOURNAMENT LIVE
    // --------------------------------------------------
    const { error: tournamentStatusError } =
      await supabaseAdmin
        .from("tournaments")
        .update({
          status: "live",
        })
        .eq("id", tournamentId);

    if (tournamentStatusError) {
      console.error(
        "TOURNAMENT STATUS UPDATE ERROR:",
        tournamentStatusError
      );

      throw tournamentStatusError;
    }

    // --------------------------------------------------
    // 8. VERIFY MATCH
    // --------------------------------------------------
    const { data: verifiedMatch, error: verifyMatchError } =
      await supabaseAdmin
        .from("matches")
        .select(
          "id, tournament_id, room_id, room_password, status"
        )
        .eq("id", matchId)
        .maybeSingle();

    if (verifyMatchError) {
      console.error(
        "MATCH VERIFY ERROR:",
        verifyMatchError
      );

      throw verifyMatchError;
    }

    if (!verifiedMatch) {
      throw new Error(
        "Match could not be verified after update."
      );
    }

    if (
      String(verifiedMatch.status).toLowerCase() !== "live"
    ) {
      throw new Error(
        `Match status verification failed. Database status is "${verifiedMatch.status}".`
      );
    }

    // --------------------------------------------------
    // 9. VERIFY TOURNAMENT
    // --------------------------------------------------
    const {
      data: verifiedTournament,
      error: verifyTournamentError,
    } = await supabaseAdmin
      .from("tournaments")
      .select("id, status")
      .eq("id", tournamentId)
      .maybeSingle();

    if (verifyTournamentError) {
      console.error(
        "TOURNAMENT VERIFY ERROR:",
        verifyTournamentError
      );

      throw verifyTournamentError;
    }

    if (!verifiedTournament) {
      throw new Error(
        "Tournament could not be verified after update."
      );
    }

    if (
      String(verifiedTournament.status).toLowerCase() !==
      "live"
    ) {
      throw new Error(
        `Tournament status verification failed. Database status is "${verifiedTournament.status}".`
      );
    }

    // --------------------------------------------------
    // 10. SUCCESS
    // --------------------------------------------------
    console.log("=================================");
    console.log("LIVE KEYS SUCCESS");
    console.log("Tournament:", tournamentId);
    console.log("Match:", matchId);
    console.log(
      "Tournament Status:",
      verifiedTournament.status
    );
    console.log("Match Status:", verifiedMatch.status);
    console.log("=================================");

    return NextResponse.json({
      success: true,
      message: "LIVE KEYS sent to users successfully.",

      tournamentId,
      matchId,

      tournamentStatus: "live",
      matchStatus: "live",

      roomId: verifiedMatch.room_id,
      roomPassword: verifiedMatch.room_password,
    });
  } catch (error) {
    console.error("=================================");
    console.error("LIVE KEYS API ERROR:", error);
    console.error("=================================");

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