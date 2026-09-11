import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get("gamerzadda_session")?.value || "";
  if (!token) return null;

  const tokenHash = hashToken(token);

  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session?.user_id) return null;
  if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) return null;

  return String(session.user_id);
}

function isGame(game: string, ...terms: string[]) {
  const value = game.toLowerCase();
  return terms.some((term) => value.includes(term));
}

export async function GET(_request: NextRequest) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    // All successful/active tournament joins by this user.
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from("tournament_entries")
      .select("id, tournament_id, cancelled")
      .eq("user_id", userId)
      .eq("cancelled", false);

    if (entriesError) {
      console.error("My stats entries:", entriesError);
      return NextResponse.json(
        { success: false, error: "Unable to load games played." },
        { status: 500 }
      );
    }

    const entryRows = entries || [];
    const tournamentIds = [...new Set(
      entryRows.map((e) => e.tournament_id).filter(Boolean).map(String)
    )];

    let tournaments: any[] = [];

    if (tournamentIds.length) {
      const { data, error } = await supabaseAdmin
        .from("tournaments")
        .select("id,title,game,mode,status")
        .in("id", tournamentIds);

      if (error) {
        console.error("My stats tournaments:", error);
        return NextResponse.json(
          { success: false, error: "Unable to load tournament statistics." },
          { status: 500 }
        );
      }

      tournaments = data || [];
    }

    const tournamentMap = new Map(
      tournaments.map((t) => [String(t.id), t])
    );

    const category = {
      freeFire: 0,
      freeFireMax: 0,
      clashSquad: 0,
      loneWolf: 0,
      other: 0,
    };

    for (const entry of entryRows) {
      const tournament = tournamentMap.get(String(entry.tournament_id));
      const game = `${tournament?.game || ""} ${tournament?.mode || ""}`.toLowerCase();

      if (game.includes("free fire max") || game.includes("freefire max") || game.includes("ff max")) {
        category.freeFireMax++;
      } else if (game.includes("clash squad") || game.includes("clashsquad")) {
        category.clashSquad++;
      } else if (game.includes("lone wolf") || game.includes("lonewolf")) {
        category.loneWolf++;
      } else if (game.includes("free fire") || game.includes("freefire")) {
        category.freeFire++;
      } else {
        category.other++;
      }
    }

    // Admin-entered results contain rank, kills and winning amount.
    const { data: results, error: resultsError } = await supabaseAdmin
      .from("tournament_results")
      .select("id,tournament_id,rank,kills,winning_amount,match_id,created_at,updated_at")
      .eq("user_id", userId);

    if (resultsError) {
      console.error("My stats results:", resultsError);
      return NextResponse.json(
        { success: false, error: "Unable to load game results." },
        { status: 500 }
      );
    }

    const resultRows = results || [];
    const totalKills = resultRows.reduce(
      (sum, row) => sum + Math.max(0, Number(row.kills || 0)),
      0
    );

    const totalWinnings = resultRows.reduce(
      (sum, row) => sum + Math.max(0, Number(row.winning_amount || 0)),
      0
    );

    const wins = resultRows.filter(
      (row) => Number(row.rank) === 1 || Number(row.winning_amount || 0) > 0
    ).length;

    const podiumFinishes = resultRows.filter(
      (row) => Number(row.rank) >= 1 && Number(row.rank) <= 3
    ).length;

    const completedGames = resultRows.length;
    const winRate = completedGames
      ? Number(((wins / completedGames) * 100).toFixed(1))
      : 0;

    // Approved withdrawals only count as money actually withdrawn.
    const { data: withdrawals, error: withdrawalsError } = await supabaseAdmin
      .from("withdraw_requests")
      .select("id,amount,net_amount,status,created_at,processed_at")
      .eq("user_id", userId)
      .eq("status", "approved");

    if (withdrawalsError) {
      console.error("My stats withdrawals:", withdrawalsError);
      return NextResponse.json(
        { success: false, error: "Unable to load withdrawal statistics." },
        { status: 500 }
      );
    }

    const withdrawalRows = withdrawals || [];
    const totalWithdrawn = withdrawalRows.reduce(
      (sum, row) =>
        sum + Math.max(
          0,
          Number(row.net_amount ?? row.amount ?? 0)
        ),
      0
    );

    // Best result: highest kill count, then best rank.
    const bestResult = resultRows.reduce<any | null>((best, row) => {
      if (!best) return row;

      const bestKills = Number(best.kills || 0);
      const currentKills = Number(row.kills || 0);
      if (currentKills > bestKills) return row;

      const bestRank = Number(best.rank || 999999);
      const currentRank = Number(row.rank || 999999);
      return currentRank < bestRank ? row : best;
    }, null);

    const bestTournament = bestResult
      ? tournamentMap.get(String(bestResult.tournament_id))
      : null;

    return NextResponse.json({
      success: true,
      stats: {
        totalGames: entryRows.length,
        completedGames,
        wins,
        podiumFinishes,
        totalKills,
        totalWinnings,
        winRate,
        totalWithdrawn,
        withdrawalCount: withdrawalRows.length,
        bestKills: Number(bestResult?.kills || 0),
        bestRank: bestResult?.rank == null ? null : Number(bestResult.rank),
        bestTournamentTitle: bestTournament?.title || null,
        categories: category,
      },
    });
  } catch (error: any) {
    console.error("My Stats API error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error." },
      { status: 500 }
    );
  }
}
