import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE = "gamerzadda_session";

async function getUserFromSession() {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  let sessionToken = token;

  try {
    sessionToken = decodeURIComponent(token);
  } catch {
    // Keep original token if decoding fails
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(sessionToken)
    .digest("hex");

  const { data: session, error } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !session?.user_id) {
    return null;
  }

  if (
    session.expires_at &&
    new Date(session.expires_at) <= new Date()
  ) {
    await supabaseAdmin
      .from("user_sessions")
      .delete()
      .eq("token_hash", tokenHash);

    return null;
  }

  return String(session.user_id);
}

export async function GET() {
  try {
    const userId = await getUserFromSession();

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // Get tournaments joined by this user
    // NOTE: tournament_entries does NOT have created_at
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from("tournament_entries")
      .select("tournament_id")
      .eq("user_id", userId)
      .eq("cancelled", false);

    if (entriesError) {
      console.error("My matches entries error:", entriesError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load joined matches.",
        },
        { status: 500 }
      );
    }

    if (!entries?.length) {
      return NextResponse.json({
        success: true,
        matches: [],
      });
    }

    const tournamentIds = [
      ...new Set(
        entries
          .map((entry) => entry.tournament_id)
          .filter(Boolean)
          .map(String)
      ),
    ];

    if (!tournamentIds.length) {
      return NextResponse.json({
        success: true,
        matches: [],
      });
    }

    // Get tournament information
    const { data: tournaments, error: tournamentsError } =
      await supabaseAdmin
        .from("tournaments")
        .select(
          "id,title,game,mode,entry_fee,prize_pool,kill_reward,max_players,start_time,map,status"
        )
        .in("id", tournamentIds);

    if (tournamentsError) {
      console.error(
        "My matches tournaments error:",
        tournamentsError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load tournament details.",
        },
        { status: 500 }
      );
    }

    // Get latest match for every tournament
    // IMPORTANT: match status is taken from matches.status
    const { data: matchRows, error: matchError } = await supabaseAdmin
      .from("matches")
      .select(
        "id,tournament_id,room_id,room_password,start_time,status"
      )
      .in("tournament_id", tournamentIds)
      .order("id", { ascending: false });

    if (matchError) {
      console.error(
        "My matches match data error:",
        matchError
      );
    }

    const matchByTournament = new Map<
      string,
      {
        room_ready: boolean;
        room_id: string | null;
        room_password: string | null;
        match_start_time: string | null;
        match_status: string | null;
      }
    >();

    for (const row of matchRows || []) {
      const tournamentId = String(row.tournament_id);

      // Only keep latest match for each tournament
      if (matchByTournament.has(tournamentId)) {
        continue;
      }

      const roomId = String(row.room_id || "").trim();
      const roomPassword = String(row.room_password || "").trim();

      matchByTournament.set(tournamentId, {
        room_ready: Boolean(roomId && roomPassword),
        room_id: row.room_id || null,
        room_password: row.room_password || null,
        match_start_time: row.start_time || null,
        match_status: row.status || null,
      });
    }

    // Count active participants in each tournament
    const { data: activeEntries, error: activeEntriesError } =
      await supabaseAdmin
        .from("tournament_entries")
        .select("tournament_id")
        .in("tournament_id", tournamentIds)
        .eq("cancelled", false);

    if (activeEntriesError) {
      console.error(
        "My matches participant count error:",
        activeEntriesError
      );
    }

    const playerCountByTournament = new Map<string, number>();

    for (const row of activeEntries || []) {
      const tournamentId = String(row.tournament_id);

      playerCountByTournament.set(
        tournamentId,
        (playerCountByTournament.get(tournamentId) || 0) + 1
      );
    }

    // Final response
    const matches = (tournaments || [])
      .map((tournament) => {
        const tournamentId = String(tournament.id);

        const match = matchByTournament.get(tournamentId);

        return {
          ...tournament,

          entry_fee: Number(tournament.entry_fee || 0),
          prize_pool: Number(tournament.prize_pool || 0),
          kill_reward: Number(tournament.kill_reward || 0),
          max_players: Number(tournament.max_players || 0),

          joined_at: null,

          joined_count:
            playerCountByTournament.get(tournamentId) || 0,

          room_ready: match?.room_ready || false,

          room_id: match?.room_id || null,

          room_password: match?.room_password || null,

          match_start_time:
            match?.match_start_time ||
            tournament.start_time ||
            null,

          // IMPORTANT:
          // Frontend uses this to decide LIVE / PAST
          match_status: match?.match_status || null,
        };
      })
      .sort((a, b) => {
        const aTime = a.start_time
          ? new Date(a.start_time).getTime()
          : Number.MAX_SAFE_INTEGER;

        const bTime = b.start_time
          ? new Date(b.start_time).getTime()
          : Number.MAX_SAFE_INTEGER;

        return aTime - bTime;
      });

    return NextResponse.json({
      success: true,
      matches,
    });
  } catch (error) {
    console.error("My Matches API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}