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


async function processFirstTournamentReferralReward(
  userId: string,
  entryId: string,
  tournamentId: string
) {
  try {
    // Find referral relationship for this user.
    const { data: referral, error: referralError } = await supabaseAdmin
      .from("referrals")
      .select("id,referrer_id,referred_user_id")
      .eq("referred_user_id", userId)
      .maybeSingle();

    if (referralError) {
      console.error("Referral lookup error:", referralError);
      return;
    }

    if (!referral) return;

    // One-time milestone: only the first successful tournament join
    // can create this reward.
    const { data: existingReward, error: rewardLookupError } =
      await supabaseAdmin
        .from("referral_rewards")
        .select("id")
        .eq("referral_id", referral.id)
        .eq("reward_type", "first_tournament")
        .maybeSingle();

    if (rewardLookupError) {
      console.error("Referral reward lookup error:", rewardLookupError);
      return;
    }

    if (existingReward) return;

    // Load latest admin settings.
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("referral_settings")
      .select(
        "tournament_reward_min,tournament_reward_max,is_active"
      )
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("Referral settings lookup error:", settingsError);
      return;
    }

    if (!settings?.is_active) return;

    const min = Number(settings.tournament_reward_min || 0);
    const max = Number(settings.tournament_reward_max || 0);

    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
      console.error("Invalid tournament referral reward settings.");
      return;
    }

    // Random reward between admin-configured min and max, rounded to ₹1.
    const rewardAmount =
      Math.floor(Math.random() * (max - min + 1)) + min;

    if (rewardAmount <= 0) return;

    // Insert the milestone first. The UNIQUE(referral_id,reward_type)
    // constraint prevents duplicate rewards from concurrent requests.
    const { data: rewardRow, error: insertRewardError } =
      await supabaseAdmin
        .from("referral_rewards")
        .insert({
          referral_id: referral.id,
          referrer_id: referral.referrer_id,
          referred_user_id: referral.referred_user_id,
          reward_type: "first_tournament",
          referrer_amount: rewardAmount,
          referred_amount: rewardAmount,
          referrer_wallet: "bonus",
          referred_wallet: "bonus",
          reference_id: entryId,
        })
        .select("id")
        .single();

    if (insertRewardError || !rewardRow) {
      // Unique constraint means another request already awarded it.
      if (insertRewardError?.code === "23505") return;

      console.error(
        "First tournament referral reward record error:",
        insertRewardError
      );
      return;
    }

    // Credit both users' bonus wallets.
    const { data: referrerWallet } = await supabaseAdmin
      .from("wallet_balances")
      .select("bonus_balance")
      .eq("user_id", referral.referrer_id)
      .maybeSingle();

    const { data: referredWallet } = await supabaseAdmin
      .from("wallet_balances")
      .select("bonus_balance")
      .eq("user_id", referral.referred_user_id)
      .maybeSingle();

    if (!referrerWallet || !referredWallet) {
      await supabaseAdmin
        .from("referral_rewards")
        .delete()
        .eq("id", rewardRow.id);

      console.error("Referral reward wallet not found.");
      return;
    }

    const newReferrerBonus =
      Math.round((Number(referrerWallet.bonus_balance || 0) + rewardAmount) * 100) /
      100;

    const newReferredBonus =
      Math.round((Number(referredWallet.bonus_balance || 0) + rewardAmount) * 100) /
      100;

    const { data: updatedReferrer } = await supabaseAdmin
      .from("wallet_balances")
      .update({
        bonus_balance: newReferrerBonus,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", referral.referrer_id)
      .select("user_id")
      .maybeSingle();

    const { data: updatedReferred } = await supabaseAdmin
      .from("wallet_balances")
      .update({
        bonus_balance: newReferredBonus,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", referral.referred_user_id)
      .select("user_id")
      .maybeSingle();

    if (!updatedReferrer || !updatedReferred) {
      // Best-effort rollback. A DB RPC/transaction can make this fully atomic.
      if (updatedReferrer) {
        await supabaseAdmin
          .from("wallet_balances")
          .update({
            bonus_balance: Number(referrerWallet.bonus_balance || 0),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", referral.referrer_id);
      }

      if (updatedReferred) {
        await supabaseAdmin
          .from("wallet_balances")
          .update({
            bonus_balance: Number(referredWallet.bonus_balance || 0),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", referral.referred_user_id);
      }

      await supabaseAdmin
        .from("referral_rewards")
        .delete()
        .eq("id", rewardRow.id);

      console.error("First tournament referral wallet credit failed.");
      return;
    }

    // Wallet transaction history for both credits.
    const { error: txError } = await supabaseAdmin
      .from("wallet_transactions")
      .insert([
        {
          user_id: referral.referrer_id,
          amount: rewardAmount,
          type: "referral_reward",
          description: `Referral reward • First tournament join`,
          reference_id: rewardRow.id,
        },
        {
          user_id: referral.referred_user_id,
          amount: rewardAmount,
          type: "referral_reward",
          description: `Referral reward • First tournament join`,
          reference_id: rewardRow.id,
        },
      ]);

    if (txError) {
      console.error("Referral reward transaction history error:", txError);
      // Do not reverse the wallet credit here; the reward itself was
      // successfully applied and the history failure is logged for repair.
    }
  } catch (error) {
    // Referral reward failure must never cancel a successful tournament join.
    console.error("First tournament referral reward error:", error);
  }
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
          "id,title,game,mode,entry_fee,max_players,status,bonus_usable_percent"
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

    // =========================================================
    // ACCOUNT STATUS + DAILY MATCH LIMIT ENFORCEMENT
    // =========================================================
    // Limits are stored per user:
    // NULL = unlimited, 0 = no joins, positive number = max
    // successful joins for that game type during the current
    // India calendar day.
    const { data: currentUser, error: currentUserError } =
      await supabaseAdmin
        .from("users")
        .select(
          "status,status_reason,restricted_until,daily_free_fire_limit,daily_free_fire_max_limit,daily_clash_squad_limit,daily_lone_wolf_limit"
        )
        .eq("id", userId)
        .maybeSingle();

    if (currentUserError) throw currentUserError;

    if (!currentUser) {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    // Automatically restore an expired restriction.
    if (
      String(currentUser.status || "").toLowerCase() === "restricted" &&
      currentUser.restricted_until &&
      new Date(currentUser.restricted_until).getTime() <= Date.now()
    ) {
      await supabaseAdmin
        .from("users")
        .update({
          status: "active",
          status_reason: null,
          status_updated_at: new Date().toISOString(),
          restricted_until: null,
        })
        .eq("id", userId);

      currentUser.status = "active";
      currentUser.status_reason = null;
      currentUser.restricted_until = null;
    }

    if (String(currentUser.status || "").toLowerCase() === "blocked") {
      return NextResponse.json(
        {
          error: "Your account is blocked.",
          code: "ACCOUNT_BLOCKED",
        },
        { status: 403 }
      );
    }

    if (String(currentUser.status || "").toLowerCase() === "restricted") {
      return NextResponse.json(
        {
          error:
            currentUser.status_reason ||
            "Your account is restricted and cannot join tournaments.",
          code: "ACCOUNT_RESTRICTED",
          restrictedUntil: currentUser.restricted_until || null,
        },
        { status: 403 }
      );
    }

    const normalizedGame = String(tournament.game || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ");

    const normalizedMode = String(tournament.mode || "")
      .trim()
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ");

    let dailyLimit: number | null = null;
    let dailyGameLabel = "";

    if (
      normalizedGame === "free fire max" ||
      normalizedGame === "freefire max" ||
      normalizedGame === "ff max" ||
      normalizedGame === "ffmax"
    ) {
      dailyLimit =
        currentUser.daily_free_fire_max_limit == null
          ? null
          : Number(currentUser.daily_free_fire_max_limit);
      dailyGameLabel = "Free Fire MAX";
    } else if (
      normalizedMode.includes("clash squad") ||
      normalizedGame.includes("clash squad")
    ) {
      dailyLimit =
        currentUser.daily_clash_squad_limit == null
          ? null
          : Number(currentUser.daily_clash_squad_limit);
      dailyGameLabel = "Clash Squad";
    } else if (
      normalizedMode.includes("lone wolf") ||
      normalizedGame.includes("lone wolf") ||
      normalizedGame === "lonewolf"
    ) {
      dailyLimit =
        currentUser.daily_lone_wolf_limit == null
          ? null
          : Number(currentUser.daily_lone_wolf_limit);
      dailyGameLabel = "Lone Wolf";
    } else {
      dailyLimit =
        currentUser.daily_free_fire_limit == null
          ? null
          : Number(currentUser.daily_free_fire_limit);
      dailyGameLabel = "Free Fire";
    }

    if (dailyLimit !== null) {
      if (!Number.isFinite(dailyLimit) || dailyLimit < 0) {
        throw new Error("Invalid daily match limit configuration.");
      }

      // Daily reset is automatic: no cron/job is required.
      // The counter is calculated from successful, non-cancelled
      // tournament entries created during today's India calendar day.
      const now = new Date();
      const indiaDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);

      const dayStart = new Date(`${indiaDate}T00:00:00+05:30`);
      const dayEnd = new Date(`${indiaDate}T00:00:00+05:30`);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const { count: todaySuccessfulJoins, error: dailyCountError } =
        await supabaseAdmin
          .from("tournament_entries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("cancelled", false)
          .gte("created_at", dayStart.toISOString())
          .lt("created_at", dayEnd.toISOString());

      if (dailyCountError) throw dailyCountError;

      const usedToday = Number(todaySuccessfulJoins || 0);

      if (usedToday >= dailyLimit) {
        return NextResponse.json(
          {
            success: false,
            code: "DAILY_MATCH_LIMIT_REACHED",
            error: `Daily ${dailyGameLabel} tournament limit reached. You can join again tomorrow.`,
            limit: dailyLimit,
            used: usedToday,
            remaining: 0,
          },
          { status: 429 }
        );
      }
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
          created_at: new Date().toISOString(),
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

    // First successful tournament join referral milestone.
    // This is intentionally after the entry + wallet transaction succeed.
    await processFirstTournamentReferralReward(
      userId,
      entry.id,
      tournamentId
    );

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