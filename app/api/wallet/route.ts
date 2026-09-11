import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SESSION_COOKIE = "gamerzadda_session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session) return null;

  if (new Date(session.expires_at) <= new Date()) {
    await supabaseAdmin
      .from("user_sessions")
      .delete()
      .eq("token_hash", tokenHash);
    return null;
  }

  return session.user_id;
}

export async function GET() {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallet_balances")
      .select("deposit_balance, bonus_balance, winning_balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError) {
      console.error("Wallet balance error:", walletError);
      return NextResponse.json(
        { error: "Failed to load wallet." },
        { status: 500 }
      );
    }

    const deposit = Number(wallet?.deposit_balance || 0);
    const bonus = Number(wallet?.bonus_balance || 0);
    const winning = Number(wallet?.winning_balance || 0);

    const { data: transactions, error: transactionError } =
      await supabaseAdmin
        .from("wallet_transactions")
        .select("id, amount, type, description, reference_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (transactionError) {
      console.error("Transaction history error:", transactionError);
    }

    const rawTransactions = transactions || [];

    const referenceIds = [
      ...new Set(
        rawTransactions
          .map((t) => t.reference_id)
          .filter(
            (id): id is string =>
              typeof id === "string" && id.trim().length > 0
          )
      ),
    ];

    const tournamentTitleMap = new Map<string, string>();

    if (referenceIds.length > 0) {
      const { data: entries, error: entriesError } = await supabaseAdmin
        .from("tournament_entries")
        .select("id, tournament_id")
        .in("id", referenceIds);

      if (entriesError) {
        console.error("Tournament entries lookup error:", entriesError);
      }

      const entryTournamentMap = new Map<string, string>();

      for (const entry of entries || []) {
        if (entry.id && entry.tournament_id) {
          entryTournamentMap.set(String(entry.id), String(entry.tournament_id));
        }
      }

      const tournamentIds = [
        ...new Set(Array.from(entryTournamentMap.values()).filter(Boolean)),
      ];

      if (tournamentIds.length > 0) {
        const { data: tournaments, error: tournamentsError } =
          await supabaseAdmin
            .from("tournaments")
            .select("id, title")
            .in("id", tournamentIds);

        if (tournamentsError) {
          console.error("Tournament title lookup error:", tournamentsError);
        }

        const titleMap = new Map<string, string>();

        for (const tournament of tournaments || []) {
          if (tournament.id && tournament.title) {
            titleMap.set(String(tournament.id), String(tournament.title));
          }
        }

        for (const [entryId, tournamentId] of entryTournamentMap) {
          const title = titleMap.get(tournamentId);
          if (title) tournamentTitleMap.set(entryId, title);
        }
      }

      // Fallback for older transactions where reference_id itself is tournament_id.
      const unresolvedIds = referenceIds.filter(
        (id) => !tournamentTitleMap.has(id)
      );

      if (unresolvedIds.length > 0) {
        const { data: directTournaments, error: directError } =
          await supabaseAdmin
            .from("tournaments")
            .select("id, title")
            .in("id", unresolvedIds);

        if (directError) {
          console.error("Direct tournament lookup error:", directError);
        }

        for (const tournament of directTournaments || []) {
          if (tournament.id && tournament.title) {
            tournamentTitleMap.set(
              String(tournament.id),
              String(tournament.title)
            );
          }
        }
      }
    }

    const enrichedTransactions = rawTransactions.map((transaction) => ({
      id: transaction.id,
      amount: Number(transaction.amount || 0),
      type: transaction.type,
      description: transaction.description,
      reference_id: transaction.reference_id,
      created_at: transaction.created_at,
      tournament_title: transaction.reference_id
        ? tournamentTitleMap.get(String(transaction.reference_id)) || null
        : null,
    }));

    const { data: withdrawals, error: withdrawalError } =
      await supabaseAdmin
        .from("withdraw_requests")
        .select(
          "id, amount, upi_id, status, admin_note, created_at, processed_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

    if (withdrawalError) {
      console.error("Withdrawal history error:", withdrawalError);
    }

    return NextResponse.json({
      success: true,
      wallet: {
        deposit,
        bonus,
        winning,
        total: deposit + bonus + winning,
      },
      transactions: enrichedTransactions,
      withdrawals: withdrawals || [],
    });
  } catch (error) {
    console.error("Wallet API error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
