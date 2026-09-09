import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) return null;

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("users")
    .select("id, role, status")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (adminError || admin?.role !== "admin" || admin?.status === "blocked") return null;
  return authData.user.id;
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) return jsonError("Unauthorized.", 401);

    const { id: tournamentId } = await context.params;
    if (!tournamentId) return jsonError("Tournament ID is required.", 400);

    const { data: tournament, error: tournamentError } = await supabaseAdmin
      .from("tournaments")
      .select("id, title, game, mode, map, start_time, prize_pool, status")
      .eq("id", tournamentId)
      .maybeSingle();

    if (tournamentError) return jsonError(tournamentError.message);
    if (!tournament) return jsonError("Tournament not found.", 404);

    const { data: match, error: matchError } = await supabaseAdmin
      .from("matches")
      .select("id, status, room_id, room_password, start_time")
      .eq("tournament_id", tournamentId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (matchError) return jsonError(matchError.message);

    const { data: entries, error: entriesError } = await supabaseAdmin
      .from("tournament_entries")
      .select("user_id, game_name, free_fire_uid, cancelled")
      .eq("tournament_id", tournamentId)
      .eq("cancelled", false);

    if (entriesError) return jsonError(entriesError.message);

    const userIds = Array.from(new Set((entries || []).map((entry) => entry.user_id).filter(Boolean)));

    const { data: users, error: usersError } = userIds.length
      ? await supabaseAdmin.from("users").select("id, full_name, game_name, free_fire_uid, bio").in("id", userIds)
      : { data: [], error: null };

    if (usersError) return jsonError(usersError.message);

    const { data: resultRows, error: resultError } = await supabaseAdmin
      .from("tournament_results")
      .select("id, tournament_id, match_id, user_id, rank, kills, winning_amount")
      .eq("tournament_id", tournamentId);

    if (resultError) return jsonError(resultError.message);

    const userMap = new Map((users || []).map((user) => [String(user.id), user]));
    const entryMap = new Map((entries || []).map((entry) => [String(entry.user_id), entry]));
    const resultMap = new Map((resultRows || []).map((result) => [String(result.user_id), result]));

    const participants = userIds.map((userId) => {
      const uid = String(userId);
      const user = userMap.get(uid);
      const entry = entryMap.get(uid);
      const result = resultMap.get(uid);
      return {
        user_id: uid,
        username: user?.full_name ?? null,
        game_name: entry?.game_name ?? user?.game_name ?? null,
        uid: entry?.free_fire_uid ?? user?.free_fire_uid ?? null,
        bio: user?.bio ?? null,
        rank: result?.rank ?? null,
        kills: Number(result?.kills ?? 0),
        winning_amount: Number(result?.winning_amount ?? 0),
      };
    });

    participants.sort((a, b) => {
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
      if (a.rank !== null) return -1;
      if (b.rank !== null) return 1;
      return 0;
    });

    return NextResponse.json({ success: true, tournament, match: match || null, participants });
  } catch (error: any) {
    console.error("Admin Results GET error:", error);
    return jsonError(error?.message || "Unable to load results.");
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) return jsonError("Unauthorized.", 401);

    const { id: tournamentId } = await context.params;
    if (!tournamentId) return jsonError("Tournament ID is required.", 400);

    const body = await request.json().catch(() => null);
    const incoming = Array.isArray(body?.results) ? body.results : null;
    if (!incoming) return jsonError("Results array is required.", 400);

    const { data: tournament, error: tournamentError } = await supabaseAdmin
      .from("tournaments")
      .select("id, title, status")
      .eq("id", tournamentId)
      .maybeSingle();

    if (tournamentError) return jsonError(tournamentError.message);
    if (!tournament) return jsonError("Tournament not found.", 404);

    // HARD LOCK: a completed tournament can never publish/overwrite results again.
    if (String(tournament.status || "").toLowerCase() === "completed") {
      return jsonError("Results are locked. This completed tournament cannot be changed.", 409);
    }

    // HARD LOCK: if results already exist, they cannot be overwritten by another publish.
    const { data: existingResults, error: existingResultsError } = await supabaseAdmin
      .from("tournament_results")
      .select("id")
      .eq("tournament_id", tournamentId)
      .limit(1);

    if (existingResultsError) return jsonError(existingResultsError.message);
    if ((existingResults || []).length > 0) {
      return jsonError("Results are locked. Published results cannot be changed.", 409);
    }

    const { data: match, error: matchError } = await supabaseAdmin
      .from("matches")
      .select("id, tournament_id, status")
      .eq("tournament_id", tournamentId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (matchError) return jsonError(matchError.message);
    if (!match) return jsonError("Match not found. Create the match before saving results.", 400);

    if (String(match.status || "").toLowerCase() === "completed") {
      return jsonError("Results are locked. This match is already completed.", 409);
    }

    const { data: entries, error: entriesError } = await supabaseAdmin
      .from("tournament_entries")
      .select("user_id")
      .eq("tournament_id", tournamentId)
      .eq("cancelled", false);

    if (entriesError) return jsonError(entriesError.message);

    const validUserIds = new Set((entries || []).map((entry) => String(entry.user_id)).filter(Boolean));

    const rows = incoming
      .map((item: any) => {
        const userId = String(item?.user_id || "").trim();
        if (!userId || !validUserIds.has(userId)) return null;

        const rawRank = item?.rank;
        const rank = rawRank === null || rawRank === undefined || rawRank === ""
          ? null
          : Math.max(1, Number(rawRank) || 1);

        return {
          tournament_id: tournamentId,
          match_id: match.id,
          user_id: userId,
          rank,
          kills: Math.max(0, Number(item?.kills) || 0),
          winning_amount: Math.max(0, Number(item?.winning_amount) || 0),
          updated_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (rows.length === 0 && validUserIds.size > 0) return jsonError("No valid participant results were provided.", 400);

    if (rows.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from("tournament_results")
        .upsert(rows, { onConflict: "tournament_id,user_id" });
      if (upsertError) return jsonError(upsertError.message);
    }

    const { data: completedMatch, error: completeError } = await supabaseAdmin
      .from("matches")
      .update({ status: "completed" })
      .eq("id", match.id)
      .select("id, tournament_id, status")
      .single();

    if (completeError || !completedMatch) {
      return jsonError(completeError?.message || "Results saved, but match could not be marked completed.");
    }

    const { error: tournamentStatusError } = await supabaseAdmin
      .from("tournaments")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", tournamentId);

    if (tournamentStatusError) return jsonError(tournamentStatusError.message);

    const { data: savedResults } = await supabaseAdmin
      .from("tournament_results")
      .select("id, tournament_id, match_id, user_id, rank, kills, winning_amount")
      .eq("tournament_id", tournamentId)
      .order("rank", { ascending: true, nullsFirst: false });

    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, full_name, game_name, free_fire_uid, bio")
      .in("id", validUserIds.size ? Array.from(validUserIds) : ["00000000-0000-0000-0000-000000000000"]);

    const userMap = new Map((users || []).map((user) => [String(user.id), user]));
    const participants = (savedResults || []).map((result) => {
      const user = userMap.get(String(result.user_id));
      return {
        user_id: String(result.user_id),
        username: user?.full_name ?? null,
        game_name: user?.game_name ?? null,
        uid: user?.free_fire_uid ?? null,
        bio: user?.bio ?? null,
        rank: result.rank ?? null,
        kills: Number(result.kills || 0),
        winning_amount: Number(result.winning_amount || 0),
      };
    });

    return NextResponse.json({ success: true, status: "completed", match: completedMatch, participants });
  } catch (error: any) {
    console.error("Admin Results POST error:", error);
    return jsonError(error?.message || "Unable to save results.");
  }
}
