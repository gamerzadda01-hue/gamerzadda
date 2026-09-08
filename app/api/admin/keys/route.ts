import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function findAdminByUserId(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, email, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("LIVE KEYS USER ROLE ERROR:", error);
    return null;
  }

  return data;
}

async function findAdminByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, email, role")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error("LIVE KEYS EMAIL ROLE ERROR:", error);
    return null;
  }

  return data;
}

async function requireAdmin(request: NextRequest) {
  // --------------------------------------------------
  // 1. TRY SUPABASE AUTH BEARER TOKEN
  // --------------------------------------------------
  const authorization = request.headers.get("authorization") || "";

  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (bearerToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(bearerToken);

    if (!error && data?.user?.id) {
      let admin = await findAdminByUserId(data.user.id);

      // Some Gamerzadda installations use the public users table ID
      // independently from the Supabase Auth user ID. In that case,
      // match the admin account by its verified Supabase Auth email.
      if (admin?.role !== "admin" && data.user.email) {
        admin = await findAdminByEmail(data.user.email);
      }

      if (admin?.role === "admin") {
        return {
          ok: true as const,
          userId: admin.id,
        };
      }
    } else {
      console.error("LIVE KEYS BEARER ERROR:", error);
    }
  }

  // --------------------------------------------------
  // 2. TRY GAMERZADDA SESSION COOKIE
  // --------------------------------------------------
  const token = request.cookies.get("gamerzadda_session")?.value;

  if (!token) {
    return {
      ok: false as const,
      error: "Admin login required.",
    };
  }

  let sessionToken = token;

  try {
    sessionToken = decodeURIComponent(token);
  } catch {
    // Use original token if it is not URI encoded.
  }

  const tokenHash = hashValue(sessionToken);

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sessionError || !session?.user_id) {
    console.error("LIVE KEYS SESSION ERROR:", sessionError);

    return {
      ok: false as const,
      error: "Invalid session.",
    };
  }

  if (
    session.expires_at &&
    new Date(session.expires_at) <= new Date()
  ) {
    return {
      ok: false as const,
      error: "Session expired.",
    };
  }

  // --------------------------------------------------
  // 3. VERIFY ADMIN ROLE
  // --------------------------------------------------
  const admin = await findAdminByUserId(session.user_id);

  if (admin?.role !== "admin") {
    console.error("LIVE KEYS ADMIN ERROR: user is not admin", {
      userId: session.user_id,
      role: admin?.role ?? null,
    });

    return {
      ok: false as const,
      error: "Access denied. Admin only.",
    };
  }

  return {
    ok: true as const,
    userId: session.user_id,
  };
}

export async function POST(request: NextRequest) {
  try {
    // --------------------------------------------------
    // 1. ADMIN AUTHENTICATION
    // --------------------------------------------------
    const auth = await requireAdmin(request);

    if (!auth.ok) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error,
        },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. READ BODY
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

    console.log("LIVE KEYS REQUEST:", {
      adminUserId: auth.userId,
      tournamentId,
      roomId,
    });

    // --------------------------------------------------
    // 3. CHECK TOURNAMENT
    // --------------------------------------------------
    const { data: tournament, error: tournamentFindError } =
      await supabaseAdmin
        .from("tournaments")
        .select("id, status")
        .eq("id", tournamentId)
        .maybeSingle();

    if (tournamentFindError) {
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
    // 4. FIND MATCH
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
        throw matchUpdateError;
      }
    }

    // --------------------------------------------------
    // 6. CREATE MATCH IF NOT FOUND
    // --------------------------------------------------
    else {
      const { data: newMatch, error: insertError } = await supabaseAdmin
        .from("matches")
        .insert({
          tournament_id: tournamentId,
          room_id: roomId,
          room_password: roomPassword,
          status: "live",
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      if (!newMatch?.id) {
        throw new Error("Match was created but ID was not returned.");
      }

      matchId = newMatch.id;
    }

    // --------------------------------------------------
    // 7. MAKE TOURNAMENT LIVE
    // --------------------------------------------------
    const { error: tournamentUpdateError } = await supabaseAdmin
      .from("tournaments")
      .update({
        status: "live",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tournamentId);

    if (tournamentUpdateError) {
      throw tournamentUpdateError;
    }

    // --------------------------------------------------
    // 8. VERIFY MATCH
    // --------------------------------------------------
    const { data: verifiedMatch, error: verifyMatchError } =
      await supabaseAdmin
        .from("matches")
        .select("id, tournament_id, room_id, room_password, status")
        .eq("id", matchId)
        .maybeSingle();

    if (verifyMatchError) {
      throw verifyMatchError;
    }

    if (!verifiedMatch) {
      throw new Error("Match could not be verified.");
    }

    if (String(verifiedMatch.status).toLowerCase() !== "live") {
      throw new Error(
        `Match status verification failed. Database status is "${verifiedMatch.status}".`
      );
    }

    // --------------------------------------------------
    // 9. VERIFY TOURNAMENT
    // --------------------------------------------------
    const { data: verifiedTournament, error: verifyTournamentError } =
      await supabaseAdmin
        .from("tournaments")
        .select("id, status")
        .eq("id", tournamentId)
        .maybeSingle();

    if (verifyTournamentError) {
      throw verifyTournamentError;
    }

    if (!verifiedTournament) {
      throw new Error("Tournament could not be verified.");
    }

    if (String(verifiedTournament.status).toLowerCase() !== "live") {
      throw new Error(
        `Tournament status verification failed. Database status is "${verifiedTournament.status}".`
      );
    }

    // --------------------------------------------------
    // 10. SUCCESS
    // --------------------------------------------------
    console.log("LIVE KEYS SUCCESS:", {
      adminUserId: auth.userId,
      tournamentId,
      matchId,
      tournamentStatus: verifiedTournament.status,
      matchStatus: verifiedMatch.status,
    });

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
    console.error("LIVE KEYS API ERROR:", error);

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
