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

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // AUTH
    // --------------------------------------------------
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Please login again.",
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // BODY
    // --------------------------------------------------
    const body = await request.json();

    const tournamentId = String(body?.tournamentId || "").trim();

    const teamCode = String(body?.teamCode || "")
      .replace(/\D/g, "")
      .slice(0, 6);

    const gameName = String(body?.gameName || "")
      .trim()
      .toUpperCase()
      .slice(0, 20);

    const uid = String(body?.uid || "")
      .replace(/\D/g, "")
      .slice(0, 15);

    const level = Number(body?.level);

    if (
      !tournamentId ||
      !/^\d{6}$/.test(teamCode) ||
      !gameName ||
      !uid ||
      !Number.isInteger(level) ||
      level < 1 ||
      level > 100
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Duo team details.",
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
          "id,entry_fee,max_players,status,bonus_usable_percent,mode"
        )
        .eq("id", tournamentId)
        .maybeSingle();

    if (tournamentError) {
      console.error("Duo join tournament error:", tournamentError);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load tournament.",
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

    // Only Duo tournament
    if (
      String(tournament.mode || "")
        .trim()
        .toLowerCase() !== "duo"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This tournament is not a Duo tournament.",
        },
        { status: 400 }
      );
    }

    // Tournament must be upcoming
    if (
      String(tournament.status || "")
        .trim()
        .toLowerCase() !== "upcoming"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Tournament is not open for joining.",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // FIND TEAM
    // --------------------------------------------------
    const { data: team, error: teamError } = await supabaseAdmin
      .from("duo_teams")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("team_code", teamCode)
      .neq("status", "cancelled")
      .maybeSingle();

    if (teamError) {
      console.error("Duo team lookup error:", teamError);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to find Duo team.",
        },
        { status: 500 }
      );
    }

    if (!team) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid team code. Duo team not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // TEAM MUST STILL BE WAITING
    // --------------------------------------------------
    if (
      String(team.status || "")
        .trim()
        .toLowerCase() !== "waiting"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This Duo team is already full.",
        },
        { status: 409 }
      );
    }

    // Extra safety check
    if (team.member_user_id) {
      return NextResponse.json(
        {
          success: false,
          error: "This Duo team already has two players.",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // CREATOR CANNOT JOIN HIS OWN TEAM
    // --------------------------------------------------
    if (
      String(team.creator_user_id).trim() ===
      String(userId).trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You are already the creator of this Duo team.",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // CHECK CREATOR ENTRY IS ACTIVE
    // --------------------------------------------------
    const { data: creatorEntry, error: creatorEntryError } =
      await supabaseAdmin
        .from("tournament_entries")
        .select("id,user_id,cancelled")
        .eq("tournament_id", tournamentId)
        .eq("user_id", team.creator_user_id)
        .eq("cancelled", false)
        .maybeSingle();

    if (creatorEntryError) {
      console.error(
        "Duo creator entry lookup error:",
        creatorEntryError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify team creator.",
        },
        { status: 500 }
      );
    }

    if (!creatorEntry) {
      return NextResponse.json(
        {
          success: false,
          error: "This Duo team is no longer active.",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // USER MUST NOT ALREADY BE IN THIS TOURNAMENT
    // --------------------------------------------------
    const { data: existingEntry, error: existingEntryError } =
      await supabaseAdmin
        .from("tournament_entries")
        .select("id,cancelled")
        .eq("tournament_id", tournamentId)
        .eq("user_id", userId)
        .maybeSingle();

    if (existingEntryError) {
      console.error(
        "Duo existing entry error:",
        existingEntryError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify your tournament entry.",
        },
        { status: 500 }
      );
    }

    if (existingEntry && !existingEntry.cancelled) {
      return NextResponse.json(
        {
          success: false,
          error: "You have already joined this tournament.",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // CHECK USER IS NOT MEMBER OF ANOTHER DUO TEAM
    // --------------------------------------------------
    const { data: existingCreatedTeam, error: createdTeamError } =
      await supabaseAdmin
        .from("duo_teams")
        .select("id,team_code,status")
        .eq("tournament_id", tournamentId)
        .eq("creator_user_id", userId)
        .neq("status", "cancelled")
        .maybeSingle();

    if (createdTeamError) {
      console.error(
        "Existing created Duo team error:",
        createdTeamError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify your Duo team.",
        },
        { status: 500 }
      );
    }

    if (existingCreatedTeam) {
      return NextResponse.json(
        {
          success: false,
          error: `You already created Duo team ${existingCreatedTeam.team_code}.`,
        },
        { status: 409 }
      );
    }

    const { data: existingMemberTeam, error: memberTeamError } =
      await supabaseAdmin
        .from("duo_teams")
        .select("id,team_code,status")
        .eq("tournament_id", tournamentId)
        .eq("member_user_id", userId)
        .neq("status", "cancelled")
        .maybeSingle();

    if (memberTeamError) {
      console.error(
        "Existing member Duo team error:",
        memberTeamError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify your Duo membership.",
        },
        { status: 500 }
      );
    }

    if (existingMemberTeam) {
      return NextResponse.json(
        {
          success: false,
          error: `You are already a member of Duo team ${existingMemberTeam.team_code}.`,
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // SAVE PLAYER DETAILS
    // --------------------------------------------------
    const { error: userUpdateError } = await supabaseAdmin
      .from("users")
      .update({
        game_name: gameName,
        free_fire_uid: uid,
        level,
      })
      .eq("id", userId);

    if (userUpdateError) {
      console.error(
        "Duo join user update error:",
        userUpdateError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to save player details.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // CREATE / RESTORE TOURNAMENT ENTRY
    // --------------------------------------------------
    let entry: any = null;

    if (existingEntry?.id) {
      const { data, error } = await supabaseAdmin
        .from("tournament_entries")
        .update({
          free_fire_uid: uid,
          game_name: gameName,
          cancelled: false,
        })
        .eq("id", existingEntry.id)
        .eq("tournament_id", tournamentId)
        .eq("user_id", userId)
        .select(
          "id,tournament_id,user_id,free_fire_uid,game_name,cancelled"
        )
        .single();

      if (error || !data) {
        console.error("Duo entry restore error:", error);

        return NextResponse.json(
          {
            success: false,
            error: "Unable to create tournament entry.",
          },
          { status: 500 }
        );
      }

      entry = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("tournament_entries")
        .insert({
          tournament_id: tournamentId,
          user_id: userId,
          free_fire_uid: uid,
          game_name: gameName,
          cancelled: false,
        })
        .select(
          "id,tournament_id,user_id,free_fire_uid,game_name,cancelled"
        )
        .single();

      if (error || !data) {
        console.error("Duo entry create error:", error);

        return NextResponse.json(
          {
            success: false,
            error: "Unable to create tournament entry.",
          },
          { status: 500 }
        );
      }

      entry = data;
    }

    // --------------------------------------------------
    // ADD SECOND PLAYER TO TEAM
    //
    // IMPORTANT:
    // We only update if member_user_id is STILL NULL.
    // This prevents two users joining the same team
    // at the same time.
    // --------------------------------------------------
    const { data: updatedTeam, error: updateTeamError } =
      await supabaseAdmin
        .from("duo_teams")
        .update({
          member_user_id: userId,
          member_ign: gameName,
          member_uid: uid,
          member_level: level,
          status: "full",
        })
        .eq("id", team.id)
        .eq("tournament_id", tournamentId)
        .eq("team_code", teamCode)
        .eq("status", "waiting")
        .is("member_user_id", null)
        .select("*")
        .maybeSingle();

    if (updateTeamError || !updatedTeam) {
      console.error(
        "Duo team member update error:",
        updateTeamError
      );

      // Roll back the entry created/restored above.
      if (existingEntry?.id) {
        await supabaseAdmin
          .from("tournament_entries")
          .update({
            cancelled: true,
          })
          .eq("id", entry.id);
      } else {
        await supabaseAdmin
          .from("tournament_entries")
          .delete()
          .eq("id", entry.id);
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "This Duo team was just joined by another player. Please use another team code.",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------
    return NextResponse.json({
      success: true,

      message: "You joined the Duo team successfully.",

      teamCode: updatedTeam.team_code,

      team: updatedTeam,

      entry,

      // Joining the teammate is FREE.
      // Creator already paid the tournament entry fee.
      wallet: null,
    });
  } catch (error) {
    console.error("Duo team join API:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error.",
      },
      { status: 500 }
    );
  }
}