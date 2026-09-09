import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE = "gamerzadda_session";

async function getUserId() {
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const tournamentId = String(id || "").trim();

    if (!tournamentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Tournament ID is missing.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // TOURNAMENT
    // --------------------------------------------------

    const { data: tournament, error: tournamentError } =
      await supabaseAdmin
        .from("tournaments")
        .select(
          "id,title,game,mode,map,start_time,prize_pool,status"
        )
        .eq("id", tournamentId)
        .maybeSingle();

    if (tournamentError) {
      console.error(
        "User results tournament error:",
        tournamentError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load tournament.",
        },
        { status: 500 }
      );
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
    // CHECK USER JOINED TOURNAMENT
    // --------------------------------------------------

    const { data: myEntry, error: myEntryError } =
      await supabaseAdmin
        .from("tournament_entries")
        .select("user_id")
        .eq("tournament_id", tournamentId)
        .eq("user_id", userId)
        .eq("cancelled", false)
        .maybeSingle();

    if (myEntryError) {
      console.error(
        "User results membership error:",
        myEntryError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to verify tournament entry.",
        },
        { status: 500 }
      );
    }

    if (!myEntry) {
      return NextResponse.json(
        {
          success: false,
          error: "You did not join this tournament.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // ALL ACTIVE PARTICIPANTS
    // --------------------------------------------------

    const { data: entries, error: entriesError } =
      await supabaseAdmin
        .from("tournament_entries")
        .select("user_id")
        .eq("tournament_id", tournamentId)
        .eq("cancelled", false);

    if (entriesError) {
      console.error(
        "User results entries error:",
        entriesError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load participants.",
        },
        { status: 500 }
      );
    }

    const userIds = [
      ...new Set(
        (entries || [])
          .map((entry) => entry.user_id)
          .filter(Boolean)
          .map(String)
      ),
    ];

    // --------------------------------------------------
    // USER PROFILES
    // IMPORTANT: LEVEL ADDED HERE
    // --------------------------------------------------

    const { data: users, error: usersError } = userIds.length
      ? await supabaseAdmin
          .from("users")
          .select(
            "id,full_name,game_name,free_fire_uid,level,bio"
          )
          .in("id", userIds)
      : { data: [], error: null };

    if (usersError) {
      console.error(
        "User results users error:",
        usersError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load player details.",
        },
        { status: 500 }
      );
    }

    const userById = new Map(
      (users || []).map((user) => [
        String(user.id),
        user,
      ])
    );

    // --------------------------------------------------
    // ADMIN ENTERED RESULTS
    // --------------------------------------------------

    const { data: resultRows, error: resultsError } =
      await supabaseAdmin
        .from("tournament_results")
        .select(
          `
          id,
          tournament_id,
          match_id,
          user_id,
          rank,
          kills,
          winning_amount,
          created_at,
          updated_at
          `
        )
        .eq("tournament_id", tournamentId);

    if (resultsError) {
      console.error(
        "User results result rows error:",
        resultsError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load tournament results.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // RESULT LOOKUP BY USER
    // --------------------------------------------------

    const resultByUserId = new Map(
      (resultRows || []).map((row) => [
        String(row.user_id),
        row,
      ])
    );

    // --------------------------------------------------
    // BUILD PARTICIPANTS
    // --------------------------------------------------

    const participants = userIds
      .map((participantUserId) => {
        const user = userById.get(participantUserId);
        const result =
          resultByUserId.get(participantUserId);

        return {
          user_id: participantUserId,

          username:
            user?.full_name || null,

          game_name:
            user?.game_name || null,

          uid:
            user?.free_fire_uid || null,

          // FIXED: LEVEL NOW COMES FROM USERS TABLE
          level:
            user?.level != null
              ? Number(user.level)
              : null,

          bio:
            user?.bio || null,

          // FIXED: ADMIN-SAVED RANK
          rank:
            result?.rank != null
              ? Number(result.rank)
              : null,

          kills:
            result?.kills != null
              ? Number(result.kills)
              : 0,

          winning_amount:
            result?.winning_amount != null
              ? Number(result.winning_amount)
              : 0,
        };
      })
      .sort((a, b) => {
        // Players with an assigned rank first
        if (a.rank == null && b.rank == null) {
          return 0;
        }

        if (a.rank == null) {
          return 1;
        }

        if (b.rank == null) {
          return -1;
        }

        return a.rank - b.rank;
      });

    // --------------------------------------------------
    // CURRENT USER RESULT
    // --------------------------------------------------

    const myResult =
      participants.find(
        (participant) =>
          String(participant.user_id) === userId
      ) || null;

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      tournament: {
        id: String(tournament.id),
        title: tournament.title || "",
        game: tournament.game || "Free Fire",
        mode: tournament.mode || "Solo",
        map: tournament.map || null,
        start_time: tournament.start_time || null,
        prize_pool: Number(
          tournament.prize_pool || 0
        ),
      },

      myResult,

      participants,
    });
  } catch (error) {
    console.error(
      "User Results API error:",
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