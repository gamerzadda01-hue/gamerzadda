import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SESSION_COOKIE = "gamerzadda_session";
const REFUND_PERCENT = 0.70;

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function getUserId(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  let sessionToken = token;

  try {
    sessionToken = decodeURIComponent(token);
  } catch {}

  const tokenHash = hashValue(sessionToken);

  const { data: session } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session?.user_id) return null;

  if (
    session.expires_at &&
    new Date(session.expires_at) <= new Date()
  ) {
    return null;
  }

  return String(session.user_id);
}

type RefundTransaction = {
  user_id: string;
  amount: number;
  type: string;
  description: string;
  reference_id: string;
};

export async function POST(request: NextRequest) {
  try {
    // ---------------------------------------------------------
    // AUTH
    // ---------------------------------------------------------

    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // REQUEST DATA
    // ---------------------------------------------------------

    const body = await request.json().catch(() => null);

    const tournamentId = String(
      body?.tournamentId || ""
    ).trim();

    const entryId = String(
      body?.entryId || ""
    ).trim();

    if (!tournamentId || !entryId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tournament ID and entry ID are required.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // GET TOURNAMENT
    // ---------------------------------------------------------

    const {
      data: tournament,
      error: tournamentError,
    } = await supabaseAdmin
      .from("tournaments")
      .select("id,start_time,status")
      .eq("id", tournamentId)
      .maybeSingle();

    if (tournamentError) {
      throw tournamentError;
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

    // ---------------------------------------------------------
    // 2 HOUR CANCELLATION LOCK
    // ---------------------------------------------------------

    const startMs = tournament.start_time
      ? new Date(tournament.start_time).getTime()
      : NaN;

    if (
      !Number.isFinite(startMs) ||
      Date.now() >=
        startMs - 2 * 60 * 60 * 1000
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cancellation is LOCKED. Entries cannot be cancelled within 2 hours of match time.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // TOURNAMENT STATUS
    // ---------------------------------------------------------

    const status = String(
      tournament.status || ""
    ).toLowerCase();

    if (
      [
        "cancelled",
        "completed",
        "live",
      ].includes(status)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tournament entry cannot be cancelled now.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // GET ONLY THIS USER'S ENTRY
    // ---------------------------------------------------------

    const {
      data: entry,
      error: entryError,
    } = await supabaseAdmin
      .from("tournament_entries")
      .select(
        "id,user_id,cancelled"
      )
      .eq("id", entryId)
      .eq("tournament_id", tournamentId)
      .eq("user_id", userId)
      .maybeSingle();

    if (entryError) {
      throw entryError;
    }

    if (!entry) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tournament entry not found.",
        },
        { status: 404 }
      );
    }

    // Already cancelled
    if (entry.cancelled) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This tournament entry is already cancelled.",
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // GET ORIGINAL ENTRY FEE TRANSACTIONS
    // ---------------------------------------------------------

    const {
      data: feeTransactions,
      error: transactionReadError,
    } = await supabaseAdmin
      .from("wallet_transactions")
      .select(
        "id,amount,description"
      )
      .eq("user_id", userId)
      .eq("reference_id", entryId)
      .eq("type", "entry_fee");

    if (transactionReadError) {
      throw transactionReadError;
    }

    // ---------------------------------------------------------
    // CALCULATE SAME-BUCKET REFUND
    // ---------------------------------------------------------

    let bonusRefund = 0;
    let depositRefund = 0;
    let winningRefund = 0;

    for (const tx of feeTransactions || []) {
      const deducted = Math.max(
        0,
        -Number(tx.amount || 0)
      );

      const refund =
        Math.round(
          deducted *
            REFUND_PERCENT *
            100
        ) / 100;

      const description = String(
        tx.description || ""
      ).toLowerCase();

      if (
        description.includes("(bonus)")
      ) {
        bonusRefund += refund;
      } else if (
        description.includes("(deposit)")
      ) {
        depositRefund += refund;
      } else if (
        description.includes("(winning)")
      ) {
        winningRefund += refund;
      }
    }

    bonusRefund =
      Math.round(
        bonusRefund * 100
      ) / 100;

    depositRefund =
      Math.round(
        depositRefund * 100
      ) / 100;

    winningRefund =
      Math.round(
        winningRefund * 100
      ) / 100;

    const totalRefund =
      Math.round(
        (
          bonusRefund +
          depositRefund +
          winningRefund
        ) * 100
      ) / 100;

    // ---------------------------------------------------------
    // SAFETY CHECK
    // ---------------------------------------------------------

    if (
      !feeTransactions?.length ||
      totalRefund <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Original tournament fee transaction was not found. Refund was not processed.",
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // GET WALLET
    // ---------------------------------------------------------

    const {
      data: wallet,
      error: walletError,
    } = await supabaseAdmin
      .from("wallet_balances")
      .select(
        "deposit_balance,bonus_balance,winning_balance"
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (walletError) {
      throw walletError;
    }

    if (!wallet) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet not found.",
        },
        { status: 404 }
      );
    }

    const deposit = Number(
      wallet.deposit_balance || 0
    );

    const bonus = Number(
      wallet.bonus_balance || 0
    );

    const winning = Number(
      wallet.winning_balance || 0
    );

    // ---------------------------------------------------------
    // NEW WALLET BALANCES
    // ---------------------------------------------------------

    const newDeposit =
      Math.round(
        (
          deposit +
          depositRefund
        ) * 100
      ) / 100;

    const newBonus =
      Math.round(
        (
          bonus +
          bonusRefund
        ) * 100
      ) / 100;

    const newWinning =
      Math.round(
        (
          winning +
          winningRefund
        ) * 100
      ) / 100;

    // ---------------------------------------------------------
    // UPDATE WALLET
    // ---------------------------------------------------------

    const {
      data: updatedWallet,
      error: walletUpdateError,
    } = await supabaseAdmin
      .from("wallet_balances")
      .update({
        deposit_balance: newDeposit,
        bonus_balance: newBonus,
        winning_balance: newWinning,
        updated_at:
          new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq(
        "deposit_balance",
        deposit
      )
      .eq(
        "bonus_balance",
        bonus
      )
      .eq(
        "winning_balance",
        winning
      )
      .select(
        "deposit_balance,bonus_balance,winning_balance"
      )
      .maybeSingle();

    if (
      walletUpdateError ||
      !updatedWallet
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Wallet changed. Please try cancelling again.",
        },
        { status: 409 }
      );
    }

    // ---------------------------------------------------------
    // CANCEL ONLY USER ENTRY
    // ---------------------------------------------------------

    const {
      data: cancelledEntry,
      error: cancelError,
    } = await supabaseAdmin
      .from("tournament_entries")
      .update({
        cancelled: true,
      })
      .eq("id", entryId)
      .eq(
        "tournament_id",
        tournamentId
      )
      .eq(
        "user_id",
        userId
      )
      .eq(
        "cancelled",
        false
      )
      .select(
        "id,cancelled"
      )
      .maybeSingle();

    // ---------------------------------------------------------
    // ROLLBACK WALLET IF ENTRY CANCEL FAILED
    // ---------------------------------------------------------

    if (
      cancelError ||
      !cancelledEntry
    ) {
      await supabaseAdmin
        .from("wallet_balances")
        .update({
          deposit_balance:
            deposit,
          bonus_balance:
            bonus,
          winning_balance:
            winning,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "user_id",
          userId
        );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to cancel tournament entry. Refund was rolled back.",
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // REFUND TRANSACTION HISTORY
    // ---------------------------------------------------------

    const refundRows: RefundTransaction[] =
      [
        bonusRefund > 0
          ? {
              user_id:
                userId,
              amount:
                bonusRefund,
              type:
                "entry_fee_refund",
              description:
                `70% tournament cancellation refund (bonus) - ${tournamentId}`,
              reference_id:
                entryId,
            }
          : null,

        depositRefund > 0
          ? {
              user_id:
                userId,
              amount:
                depositRefund,
              type:
                "entry_fee_refund",
              description:
                `70% tournament cancellation refund (deposit) - ${tournamentId}`,
              reference_id:
                entryId,
            }
          : null,

        winningRefund > 0
          ? {
              user_id:
                userId,
              amount:
                winningRefund,
              type:
                "entry_fee_refund",
              description:
                `70% tournament cancellation refund (winning) - ${tournamentId}`,
              reference_id:
                entryId,
            }
          : null,
      ].filter(
        (
          row
        ): row is RefundTransaction =>
          row !== null
      );

    if (
      refundRows.length > 0
    ) {
      const {
        error:
          refundTransactionError,
      } = await supabaseAdmin
        .from(
          "wallet_transactions"
        )
        .insert(
          refundRows
        );

      if (
        refundTransactionError
      ) {
        console.error(
          "Refund transaction logging failed:",
          refundTransactionError
        );
      }
    }

    // ---------------------------------------------------------
    // SUCCESS RESPONSE
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,
      cancelled: true,
      refundPercent: 70,

      refund: {
        total: totalRefund,
        bonus: bonusRefund,
        deposit:
          depositRefund,
        winning:
          winningRefund,
      },

      wallet: {
        deposit: Number(
          updatedWallet.deposit_balance ||
            0
        ),
        bonus: Number(
          updatedWallet.bonus_balance ||
            0
        ),
        winning: Number(
          updatedWallet.winning_balance ||
            0
        ),
      },
    });
  } catch (error) {
    console.error(
      "cancel tournament entry error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to cancel tournament entry.",
      },
      { status: 500 }
    );
  }
}