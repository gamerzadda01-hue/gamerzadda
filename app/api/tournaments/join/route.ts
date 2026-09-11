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

export async function POST(request: Request) {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const tournamentId = String(body?.tournamentId || "").trim();

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
      !gameName ||
      !uid ||
      !Number.isInteger(level) ||
      level < 1 ||
      level > 100
    ) {
      return NextResponse.json(
        { error: "Invalid join details." },
        { status: 400 }
      );
    }

    const { data: tournament, error: tournamentError } =
      await supabaseAdmin
        .from("tournaments")
        .select(
          "id,entry_fee,max_players,status,bonus_usable_percent"
        )
        .eq("id", tournamentId)
        .maybeSingle();

    if (tournamentError) throw tournamentError;

    if (!tournament) {
      return NextResponse.json(
        { error: "Tournament not found." },
        { status: 404 }
      );
    }

    const entryFee = Math.max(
      0,
      Number(tournament.entry_fee || 0)
    );

    const { count } = await supabaseAdmin
      .from("tournament_entries")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("tournament_id", tournamentId)
      .eq("cancelled", false);

    if (
      Number(tournament.max_players || 0) > 0 &&
      (count || 0) >= Number(tournament.max_players)
    ) {
      return NextResponse.json(
        { error: "Tournament is full." },
        { status: 409 }
      );
    }

    // Reuse cancelled entry because tournament_entries
    // has unique (tournament_id, user_id).
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
        {
          error: "You have already joined this tournament.",
        },
        { status: 409 }
      );
    }

    const { data: wallet, error: walletError } =
      await supabaseAdmin
        .from("wallet_balances")
        .select(
          "deposit_balance,bonus_balance,winning_balance"
        )
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
      Math.max(
        0,
        Number(tournament.bonus_usable_percent || 0)
      )
    );

    const bonusUsable =
      (bonus * bonusPercent) / 100;

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

    // Bonus -> Deposit -> Winning
    const bonusCut = Math.min(
      bonusUsable,
      entryFee
    );

    const afterBonus = entryFee - bonusCut;

    const depositCut = Math.min(
      deposit,
      afterBonus
    );

    const winningCut = Math.max(
      0,
      afterBonus - depositCut
    );

    const newDeposit =
      Math.round(
        (deposit - depositCut) * 100
      ) / 100;

    const newBonus =
      Math.round(
        (bonus - bonusCut) * 100
      ) / 100;

    const newWinning =
      Math.round(
        (winning - winningCut) * 100
      ) / 100;

    // Conditional update prevents double charging.
    const {
      data: updatedWallet,
      error: updateError,
    } = await supabaseAdmin
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
      .select(
        "deposit_balance,bonus_balance,winning_balance"
      )
      .maybeSingle();

    if (updateError || !updatedWallet) {
      return NextResponse.json(
        {
          error:
            "Wallet changed. Please try joining again.",
        },
        { status: 409 }
      );
    }

    // Save player's Free Fire details.
    const { error: userUpdateError } =
      await supabaseAdmin
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
          error:
            "Unable to save player details. Wallet was not charged.",
        },
        { status: 500 }
      );
    }

    let entry;
    let entryError;

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
        .select(
          "id,tournament_id,user_id,free_fire_uid,game_name"
        )
        .single();

      entry = result.data;
      entryError = result.error;
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
        .select(
          "id,tournament_id,user_id,free_fire_uid,game_name"
        )
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
            "Unable to create tournament entry.",
        },
        { status: 500 }
      );
    }

    // If rejoining, remove old entry-fee transactions.
    if (existingEntry?.id) {
      const {
        error: oldTransactionsError,
      } = await supabaseAdmin
        .from("wallet_transactions")
        .delete()
        .eq("user_id", userId)
        .eq("reference_id", entry.id)
        .eq("type", "entry_fee");

      if (oldTransactionsError) {
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
              "Unable to reset previous entry transaction. Wallet was not charged.",
          },
          { status: 500 }
        );
      }
    }

    // Record exact wallet deductions.
    const transactionRows = [
      bonusCut > 0
        ? {
            user_id: userId,
            amount: -bonusCut,
            type: "entry_fee",
            description: `Tournament entry fee (bonus) - ${tournamentId}`,
            reference_id: entry.id,
          }
        : null,

      depositCut > 0
        ? {
            user_id: userId,
            amount: -depositCut,
            type: "entry_fee",
            description: `Tournament entry fee (deposit) - ${tournamentId}`,
            reference_id: entry.id,
          }
        : null,

      winningCut > 0
        ? {
            user_id: userId,
            amount: -winningCut,
            type: "entry_fee",
            description: `Tournament entry fee (winning) - ${tournamentId}`,
            reference_id: entry.id,
          }
        : null,
    ].filter(
      (
        transaction
      ): transaction is {
        user_id: string;
        amount: number;
        type: string;
        description: string;
        reference_id: string;
      } => transaction !== null
    );

    const { error: transactionError } =
      await supabaseAdmin
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

    return NextResponse.json({
      success: true,
      entry,
      wallet: {
        deposit: Number(
          updatedWallet.deposit_balance || 0
        ),
        bonus: Number(
          updatedWallet.bonus_balance || 0
        ),
        winning: Number(
          updatedWallet.winning_balance || 0
        ),
        total:
          Number(updatedWallet.deposit_balance || 0) +
          Number(updatedWallet.bonus_balance || 0) +
          Number(updatedWallet.winning_balance || 0),
      },
    });
  } catch (error) {
    console.error("Tournament join API:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}