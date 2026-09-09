import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SESSION_COOKIE = "gamerzadda_session";

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

function generateTeamCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const tournamentId = String(body?.tournamentId || "").trim();
    const teamName = String(body?.teamName || "").trim().slice(0, 30);
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
      !teamName ||
      !gameName ||
      !uid ||
      !Number.isInteger(level) ||
      level < 1 ||
      level > 100
    ) {
      return NextResponse.json(
        { error: "Invalid Duo team details." },
        { status: 400 }
      );
    }

    // Only Duo tournaments can use this endpoint.
    const { data: tournament, error: tournamentError } = await supabaseAdmin
      .from("tournaments")
      .select("id,entry_fee,max_players,status,bonus_usable_percent,mode")
      .eq("id", tournamentId)
      .maybeSingle();

    if (tournamentError) throw tournamentError;

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found." },
        { status: 404 }
      );
    }

    if (String(tournament.mode || "").trim().toLowerCase() !== "duo") {
      return NextResponse.json(
        { error: "This tournament is not a Duo tournament." },
        { status: 400 }
      );
    }

    if (String(tournament.status || "").toLowerCase() !== "upcoming") {
      return NextResponse.json(
        { error: "Tournament is not open for joining." },
        { status: 409 }
      );
    }

    /*
     * Duo = 24 teams maximum.
     * We count only active/non-cancelled teams.
     */
    const { count: teamCount, error: teamCountError } = await supabaseAdmin
      .from("duo_teams")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId)
      .neq("status", "cancelled");

    if (teamCountError) throw teamCountError;

    const maxTeams = 24;

    if ((teamCount || 0) >= maxTeams) {
      return NextResponse.json(
        { error: "Duo tournament is full. All 24 teams are already filled." },
        { status: 409 }
      );
    }

    // One user cannot create another active team in the same tournament.
    const { data: existingTeam, error: existingTeamError } = await supabaseAdmin
      .from("duo_teams")
      .select("id,status,team_code")
      .eq("tournament_id", tournamentId)
      .eq("creator_user_id", userId)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existingTeamError) throw existingTeamError;

    if (existingTeam) {
      return NextResponse.json(
        {
          error: `You already created a Duo team (${existingTeam.team_code}).`,
        },
        { status: 409 }
      );
    }

    // A user cannot already be an active participant in this tournament.
    const { data: existingEntry, error: existingEntryError } =
      await supabaseAdmin
        .from("tournament_entries")
        .select("id,cancelled")
        .eq("tournament_id", tournamentId)
        .eq("user_id", userId)
        .maybeSingle();

    if (existingEntryError) throw existingEntryError;

    if (existingEntry && !existingEntry.cancelled) {
      return NextResponse.json(
        { error: "You have already joined this tournament." },
        { status: 409 }
      );
    }

    const entryFee = Math.max(0, Number(tournament.entry_fee || 0));

    // Existing Gamerzadda wallet deduction rules:
    // Bonus -> Deposit -> Winning.
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallet_balances")
      .select("deposit_balance,bonus_balance,winning_balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError) throw walletError;

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found." },
        { status: 404 }
      );
    }

    const deposit = Number(wallet.deposit_balance || 0);
    const bonus = Number(wallet.bonus_balance || 0);
    const winning = Number(wallet.winning_balance || 0);

    const bonusPercent = Math.min(
      100,
      Math.max(0, Number(tournament.bonus_usable_percent || 0))
    );

    const bonusUsable = (bonus * bonusPercent) / 100;

    if (deposit + winning + bonusUsable < entryFee) {
      return NextResponse.json(
        {
          success: false,
          code: "INSUFFICIENT_BALANCE",
          error:
            "Insufficient wallet balance. Please add money to your wallet.",
        },
        { status: 402 }
      );
    }

    const bonusCut = Math.min(bonusUsable, entryFee);
    const afterBonus = entryFee - bonusCut;
    const depositCut = Math.min(deposit, afterBonus);
    const winningCut = Math.max(0, afterBonus - depositCut);

    const newDeposit =
      Math.round((deposit - depositCut) * 100) / 100;
    const newBonus =
      Math.round((bonus - bonusCut) * 100) / 100;
    const newWinning =
      Math.round((winning - winningCut) * 100) / 100;

    // Optimistic wallet update prevents charging an already-changed wallet.
    const { data: updatedWallet, error: updateWalletError } =
      await supabaseAdmin
        .from("wallet_balances")
        .update({
          deposit_balance: newDeposit,
          bonus_balance: newBonus,
          winning_balance: newWinning,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("deposit_balance", deposit)
        .eq("bonus_balance", bonus)
        .eq("winning_balance", winning)
        .select("deposit_balance,bonus_balance,winning_balance")
        .maybeSingle();

    if (updateWalletError || !updatedWallet) {
      return NextResponse.json(
        { error: "Wallet changed. Please try again." },
        { status: 409 }
      );
    }

    // Save the creator's game details in the existing users table.
    const { error: userUpdateError } = await supabaseAdmin
      .from("users")
      .update({
        game_name: gameName,
        free_fire_uid: uid,
        level,
      })
      .eq("id", userId);

    if (userUpdateError) {
      await supabaseAdmin
        .from("wallet_balances")
        .update({
          deposit_balance: deposit,
          bonus_balance: bonus,
          winning_balance: winning,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return NextResponse.json(
        {
          error: "Unable to save player details. Wallet was not charged.",
        },
        { status: 500 }
      );
    }

    // Reuse a cancelled tournament entry if one exists.
    let entry: any = null;
    let entryError: any = null;

    if (existingEntry?.id) {
      const result = await supabaseAdmin
        .from("tournament_entries")
        .update({
          free_fire_uid: uid,
          game_name: gameName,
          cancelled: false,
        })
        .eq("id", existingEntry.id)
        .eq("tournament_id", tournamentId)
        .eq("user_id", userId)
        .select("id,tournament_id,user_id,free_fire_uid,game_name,cancelled")
        .single();

      entry = result.data;
      entryError = result.error;

      // Remove previous entry-fee records because this is a fresh join.
      if (entry && !entryError) {
        const { error: oldTransactionsError } = await supabaseAdmin
          .from("wallet_transactions")
          .delete()
          .eq("user_id", userId)
          .eq("reference_id", entry.id)
          .eq("type", "entry_fee");

        if (oldTransactionsError) {
          entryError = oldTransactionsError;
        }
      }
    } else {
      const result = await supabaseAdmin
        .from("tournament_entries")
        .insert({
          tournament_id: tournamentId,
          user_id: userId,
          free_fire_uid: uid,
          game_name: gameName,
          cancelled: false,
        })
        .select("id,tournament_id,user_id,free_fire_uid,game_name,cancelled")
        .single();

      entry = result.data;
      entryError = result.error;
    }

    if (entryError || !entry) {
      await supabaseAdmin
        .from("wallet_balances")
        .update({
          deposit_balance: deposit,
          bonus_balance: bonus,
          winning_balance: winning,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return NextResponse.json(
        {
          error:
            entryError?.message ||
            "Unable to create tournament entry. Wallet was not charged.",
        },
        { status: 500 }
      );
    }

    // Store exact bucket deductions for future 70% creator refund.
    const transactionRows = [
      bonusCut > 0
        ? {
            user_id: userId,
            amount: -bonusCut,
            type: "entry_fee",
            description: `Duo tournament entry fee (bonus) - ${tournamentId}`,
            reference_id: entry.id,
          }
        : null,
      depositCut > 0
        ? {
            user_id: userId,
            amount: -depositCut,
            type: "entry_fee",
            description: `Duo tournament entry fee (deposit) - ${tournamentId}`,
            reference_id: entry.id,
          }
        : null,
      winningCut > 0
        ? {
            user_id: userId,
            amount: -winningCut,
            type: "entry_fee",
            description: `Duo tournament entry fee (winning) - ${tournamentId}`,
            reference_id: entry.id,
          }
        : null,
    ].filter((row): row is NonNullable<typeof row> => row !== null);

    const { error: transactionError } = await supabaseAdmin
      .from("wallet_transactions")
      .insert(transactionRows);

    if (transactionError) {
      await supabaseAdmin
        .from("tournament_entries")
        .delete()
        .eq("id", entry.id);

      await supabaseAdmin
        .from("wallet_balances")
        .update({
          deposit_balance: deposit,
          bonus_balance: bonus,
          winning_balance: winning,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return NextResponse.json(
        {
          error:
            "Unable to record wallet transaction. Wallet was not charged.",
        },
        { status: 500 }
      );
    }

    // Generate a unique 6-digit numeric team code.
    let team: any = null;
    let teamError: any = null;

    for (let attempt = 0; attempt < 10; attempt++) {
      const teamCode = generateTeamCode();

      const result = await supabaseAdmin
        .from("duo_teams")
        .insert({
          tournament_id: tournamentId,
          team_code: teamCode,
          team_name: teamName,
          creator_user_id: userId,
          creator_ign: gameName,
          creator_uid: uid,
          creator_level: level,
          status: "waiting",
        })
        .select("*")
        .single();

      if (!result.error && result.data) {
        team = result.data;
        teamError = null;
        break;
      }

      teamError = result.error;

      // team_code collision: try another code.
      if (!String(result.error?.message || "").toLowerCase().includes("team_code")) {
        break;
      }
    }

    if (!team) {
      // Roll back entry + wallet if the team cannot be created.
      await supabaseAdmin
        .from("wallet_transactions")
        .delete()
        .eq("user_id", userId)
        .eq("reference_id", entry.id)
        .eq("type", "entry_fee");

      await supabaseAdmin
        .from("tournament_entries")
        .update({ cancelled: true })
        .eq("id", entry.id);

      await supabaseAdmin
        .from("wallet_balances")
        .update({
          deposit_balance: deposit,
          bonus_balance: bonus,
          winning_balance: winning,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return NextResponse.json(
        {
          error:
            teamError?.message ||
            "Unable to create Duo team. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      teamCode: team.team_code,
      team,
      entry,
      wallet: {
        deposit: Number(updatedWallet.deposit_balance || 0),
        bonus: Number(updatedWallet.bonus_balance || 0),
        winning: Number(updatedWallet.winning_balance || 0),
        total:
          Number(updatedWallet.deposit_balance || 0) +
          Number(updatedWallet.bonus_balance || 0) +
          Number(updatedWallet.winning_balance || 0),
      },
    });
  } catch (error) {
    console.error("Duo team create API:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
