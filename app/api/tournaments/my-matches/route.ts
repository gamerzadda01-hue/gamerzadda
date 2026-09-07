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

  if (!token) return null;

  let sessionToken = token;

  try {
    sessionToken = decodeURIComponent(token);
  } catch {}

  const tokenHash = crypto
    .createHash("sha256")
    .update(sessionToken)
    .digest("hex");

  const { data: session, error } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !session?.user_id) return null;

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

    // Get tournaments joined by current user
    // tournament_entries does NOT have created_at.
    const { data: entries, error: entriesError } =
      await supabaseAdmin
        .from("tournament_entries")
        .select("tournament_id")
        .eq("user_id", userId)
        .eq("cancelled", false);

    if (entriesError) {
      console.error(
        "My matches entries error:",
        entriesError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load joined matches.",
        },
        { status: 500 }
      );
    }

    if (!entries || entries.length === 0) {
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
          .map((id) => String(id))
      ),
    ];

    if (tournamentIds.length === 0) {
      return NextResponse.json({
        success: true,
        matches: [],
      });
    }

    // Get tournament details
    const {
      data: tournaments,
      error: tournamentsError,
    } = await supabaseAdmin
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

    // Get LIVE/room information from matches table
    const {
      data: matchRows,
      error: matchError,
    } = await supabaseAdmin
      .from("matches")
      .select(
        "id,tournament_id,room_id,room_password,status"
      )
      .in("tournament_id", tournamentIds)
      .order("id", { ascending: false });

    if (matchError) {
      console.error(
        "My matches room error:",
        matchError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load match information.",
        },
        { status: 500 }
      );
    }

    // Keep latest match row for each tournament
    const matchByTournament = new Map<
      string,
      {
        id: string | number;
        tournament_id: string;
        room_id: string | null;
        room_password: string | null;
        status: string | null;
      }
    >();

    for (const match of matchRows || []) {
      const tournamentId = String(match.tournament_id);

      if (!matchByTournament.has(tournamentId)) {
        matchByTournament.set(tournamentId, {
          id: match.id,
          tournament_id: tournamentId,
          room_id: match.room_id ?? null,
          room_password: match.room_password ?? null,
          status: match.status ?? null,
        });
      }
    }

    const matches = (tournaments || [])
      .map((tournament) => {
        const match = matchByTournament.get(
          String(tournament.id)
        );

        const isLive =
          String(match?.status || "").toLowerCase() ===
          "live";

        return {
          ...tournament,

          // Use LIVE status from matches table
          // when admin has sent LIVE KEYS.
          status: isLive
            ? "live"
            : tournament.status,

          entry_fee: Number(
            tournament.entry_fee || 0
          ),

          prize_pool: Number(
            tournament.prize_pool || 0
          ),

          kill_reward: Number(
            tournament.kill_reward || 0
          ),

          max_players: Number(
            tournament.max_players || 0
          ),

          // Room information
          room_id: isLive
            ? match?.room_id || null
            : null,

          room_password: isLive
            ? match?.room_password || null
            : null,

          room_ready:
            isLive &&
            Boolean(
              match?.room_id &&
              match?.room_password
            ),
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
    console.error(
      "My Matches API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}