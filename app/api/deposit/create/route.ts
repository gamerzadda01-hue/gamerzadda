import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PAY0_STATUS_URL =
  "https://pay0.shop/api/check-order-status";

export async function POST(request: Request) {
  try {
    // ==========================================
    // READ PAY0 WEBHOOK DATA
    // ==========================================

    const formData = await request.formData();

    const orderId = String(
      formData.get("order_id") || ""
    );

    if (!orderId) {
      return new NextResponse(
        "Missing order_id",
        { status: 400 }
      );
    }

    // ==========================================
    // FIND DEPOSIT ORDER
    // ==========================================

    const {
      data: order,
      error: orderError,
    } = await supabaseAdmin
      .from("deposit_orders")
      .select(
        `
        id,
        user_id,
        order_id,
        amount,
        status,
        bonus_percent,
        bonus_amount
        `
      )
      .eq("order_id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error(
        "Deposit order lookup error:",
        orderError
      );

      return new NextResponse(
        "Database error",
        { status: 500 }
      );
    }

    if (!order) {
      console.error(
        "Unknown Pay0 order:",
        orderId
      );

      return new NextResponse(
        "Order not found",
        { status: 404 }
      );
    }

    // ==========================================
    // ALREADY SUCCESSFUL
    // ==========================================

    if (order.status === "SUCCESS") {
      return new NextResponse(
        "Already processed",
        { status: 200 }
      );
    }

    // ==========================================
    // PAY0 API KEY CHECK
    // ==========================================

    if (!process.env.PAY0_API_KEY) {
      console.error(
        "PAY0_API_KEY missing"
      );

      return new NextResponse(
        "Server configuration error",
        { status: 500 }
      );
    }

    // ==========================================
    // VERIFY PAYMENT DIRECTLY WITH PAY0
    // ==========================================

    const verifyData =
      new URLSearchParams();

    verifyData.append(
      "user_token",
      process.env.PAY0_API_KEY
    );

    verifyData.append(
      "order_id",
      orderId
    );

    const verifyResponse =
      await fetch(
        PAY0_STATUS_URL,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body:
            verifyData.toString(),
          cache: "no-store",
        }
      );

    const verifyResult =
      await verifyResponse.json();

    console.log(
      "Pay0 verification:",
      orderId,
      verifyResult
    );

    // ==========================================
    // VERIFY RESPONSE
    // ==========================================

    if (
      !verifyResponse.ok ||
      !verifyResult?.status ||
      !verifyResult?.result
    ) {
      return new NextResponse(
        "Payment verification failed",
        { status: 400 }
      );
    }

    // ==========================================
    // PAYMENT STATUS
    // ==========================================

    const txnStatus = String(
      verifyResult.result.txnStatus || ""
    ).toUpperCase();

    const paidAmount = Number(
      verifyResult.result.amount || 0
    );

    // ==========================================
    // PAYMENT NOT SUCCESSFUL
    // ==========================================

    if (txnStatus !== "SUCCESS") {
      await supabaseAdmin
        .from("deposit_orders")
        .update({
          status:
            txnStatus || "PENDING",
        })
        .eq("order_id", orderId)
        .neq("status", "SUCCESS");

      return new NextResponse(
        "Payment pending",
        { status: 200 }
      );
    }

    // ==========================================
    // VERIFY PAID AMOUNT
    // ==========================================

    const orderAmount =
      Number(order.amount);

    if (
      !Number.isFinite(paidAmount) ||
      paidAmount !== orderAmount
    ) {
      console.error(
        "Amount mismatch:",
        {
          orderId,
          orderAmount,
          paidAmount,
        }
      );

      await supabaseAdmin
        .from("deposit_orders")
        .update({
          status: "FAILED",
        })
        .eq("order_id", orderId)
        .neq("status", "SUCCESS");

      return new NextResponse(
        "Amount mismatch",
        { status: 400 }
      );
    }

    // ==========================================
    // GET SAVED BONUS
    // ==========================================

    const bonusPercent =
      Number(
        order.bonus_percent || 0
      );

    const savedBonusAmount =
      Number(
        order.bonus_amount || 0
      );

    const bonusAmount =
      Number.isFinite(savedBonusAmount) &&
      savedBonusAmount >= 0
        ? savedBonusAmount
        : 0;

    // ==========================================
    // GET WALLET
    // ==========================================

    const {
      data: wallet,
      error: walletError,
    } = await supabaseAdmin
      .from("wallet_balances")
      .select(
        "deposit_balance, bonus_balance"
      )
      .eq("user_id", order.user_id)
      .maybeSingle();

    if (walletError) {
      console.error(
        "Wallet lookup error:",
        walletError
      );

      return new NextResponse(
        "Wallet lookup failed",
        { status: 500 }
      );
    }

    if (!wallet) {
      console.error(
        "Wallet not found:",
        order.user_id
      );

      return new NextResponse(
        "Wallet not found",
        { status: 500 }
      );
    }

    // ==========================================
    // CALCULATE NEW BALANCES
    // ==========================================

    const currentDepositBalance =
      Number(
        wallet.deposit_balance || 0
      );

    const currentBonusBalance =
      Number(
        wallet.bonus_balance || 0
      );

    const newDepositBalance =
      Math.round(
        (currentDepositBalance +
          orderAmount) *
          100
      ) / 100;

    const newBonusBalance =
      Math.round(
        (currentBonusBalance +
          bonusAmount) *
          100
      ) / 100;

    // ==========================================
    // CREDIT WALLET
    // ==========================================

    const {
      error: balanceError,
    } = await supabaseAdmin
      .from("wallet_balances")
      .update({
        deposit_balance:
          newDepositBalance,

        bonus_balance:
          newBonusBalance,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "user_id",
        order.user_id
      );

    if (balanceError) {
      console.error(
        "Wallet credit error:",
        balanceError
      );

      return new NextResponse(
        "Wallet credit failed",
        { status: 500 }
      );
    }

    // ==========================================
    // SAVE DEPOSIT TRANSACTION
    // ==========================================

    const {
      error: depositTransactionError,
    } = await supabaseAdmin
      .from("wallet_transactions")
      .insert({
        user_id: order.user_id,
        amount: orderAmount,
        type: "deposit",
        description:
          "Wallet deposit",
        reference_id: order.id,
      });

    if (depositTransactionError) {
      console.error(
        "Deposit transaction error:",
        depositTransactionError
      );
    }

    // ==========================================
    // SAVE BONUS TRANSACTION
    // ==========================================

    if (bonusAmount > 0) {
      const {
        error: bonusTransactionError,
      } = await supabaseAdmin
        .from("wallet_transactions")
        .insert({
          user_id: order.user_id,
          amount: bonusAmount,
          type: "bonus",
          description:
            `Deposit bonus (${bonusPercent}%)`,
          reference_id: order.id,
        });

      if (bonusTransactionError) {
        console.error(
          "Bonus transaction error:",
          bonusTransactionError
        );
      }
    }

    // ==========================================
    // MARK ORDER SUCCESS
    // ==========================================

    const {
      error: updateError,
    } = await supabaseAdmin
      .from("deposit_orders")
      .update({
        status: "SUCCESS",

        utr:
          verifyResult.result.utr ||
          null,

        paid_at:
          new Date().toISOString(),
      })
      .eq(
        "order_id",
        orderId
      )
      .neq(
        "status",
        "SUCCESS"
      );

    if (updateError) {
      console.error(
        "Deposit order update error:",
        updateError
      );

      return new NextResponse(
        "Database error",
        { status: 500 }
      );
    }

    // ==========================================
    // SUCCESS
    // ==========================================

    console.log(
      "Deposit credited successfully:",
      {
        orderId,
        userId: order.user_id,
        deposit: orderAmount,
        bonusPercent,
        bonus: bonusAmount,
        total:
          orderAmount +
          bonusAmount,
      }
    );

    return new NextResponse(
      "Payment credited successfully",
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Pay0 webhook error:",
      error
    );

    return new NextResponse(
      "Webhook error",
      { status: 500 }
    );
  }
}