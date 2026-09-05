import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PAY0_STATUS_URL =
  "https://pay0.shop/api/check-order-status";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const status = String(formData.get("status") || "");
    const orderId = String(formData.get("order_id") || "");
    const amount = Number(formData.get("amount") || 0);

    if (!orderId) {
      return new NextResponse("Missing order_id", { status: 400 });
    }

    // Find our deposit order
    const { data: order, error: orderError } =
      await supabaseAdmin
        .from("deposit_orders")
        .select("id, user_id, order_id, amount, status")
        .eq("order_id", orderId)
        .maybeSingle();

    if (orderError) {
      console.error("Deposit order lookup error:", orderError);
      return new NextResponse("Database error", { status: 500 });
    }

    if (!order) {
      console.error("Unknown Pay0 order:", orderId);
      return new NextResponse("Order not found", { status: 404 });
    }

    // Already credited — prevent duplicate webhook credit
    if (order.status === "SUCCESS") {
      return new NextResponse("Already processed", {
        status: 200,
      });
    }

    // Verify payment directly with Pay0
    if (!process.env.PAY0_API_KEY) {
      console.error("PAY0_API_KEY missing");
      return new NextResponse("Server configuration error", {
        status: 500,
      });
    }

    const verifyData = new URLSearchParams();

    verifyData.append(
      "user_token",
      process.env.PAY0_API_KEY
    );

    verifyData.append(
      "order_id",
      orderId
    );

    const verifyResponse = await fetch(PAY0_STATUS_URL, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: verifyData.toString(),
      cache: "no-store",
    });

    const verifyResult = await verifyResponse.json();

    console.log(
      "Pay0 verification:",
      orderId,
      verifyResult
    );

    if (
      !verifyResponse.ok ||
      !verifyResult?.status ||
      !verifyResult?.result
    ) {
      return new NextResponse("Payment verification failed", {
        status: 400,
      });
    }

    const txnStatus = String(
      verifyResult.result.txnStatus || ""
    ).toUpperCase();

    const paidAmount = Number(
      verifyResult.result.amount || 0
    );

    // Payment is not successful yet
    if (txnStatus !== "SUCCESS") {
      await supabaseAdmin
        .from("deposit_orders")
        .update({
          status: txnStatus || "PENDING",
        })
        .eq("order_id", orderId);

      return new NextResponse("Payment pending", {
        status: 200,
      });
    }

    // Amount must match our order
    if (
      !Number.isFinite(paidAmount) ||
      paidAmount !== Number(order.amount)
    ) {
      console.error(
        "Amount mismatch:",
        order.amount,
        paidAmount
      );

      await supabaseAdmin
        .from("deposit_orders")
        .update({
          status: "FAILED",
        })
        .eq("order_id", orderId);

      return new NextResponse("Amount mismatch", {
        status: 400,
      });
    }

    // Update deposit order
    const { error: updateError } =
      await supabaseAdmin
        .from("deposit_orders")
        .update({
          status: "SUCCESS",
          utr: verifyResult.result.utr || null,
          paid_at: new Date().toISOString(),
        })
        .eq("order_id", orderId)
        .neq("status", "SUCCESS");

    if (updateError) {
      console.error(
        "Deposit order update error:",
        updateError
      );

      return new NextResponse("Database error", {
        status: 500,
      });
    }

    // Credit wallet
    const { data: wallet, error: walletError } =
      await supabaseAdmin
        .from("wallet_balances")
        .select("deposit_balance")
        .eq("user_id", order.user_id)
        .maybeSingle();

    if (walletError || !wallet) {
      console.error(
        "Wallet lookup error:",
        walletError
      );

      return new NextResponse("Wallet not found", {
        status: 500,
      });
    }

    const newDepositBalance =
      Number(wallet.deposit_balance || 0) +
      Number(order.amount);

    const { error: balanceError } =
      await supabaseAdmin
        .from("wallet_balances")
        .update({
          deposit_balance: newDepositBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", order.user_id);

    if (balanceError) {
      console.error(
        "Wallet credit error:",
        balanceError
      );

      return new NextResponse("Wallet credit failed", {
        status: 500,
      });
    }

    // Create wallet transaction
    await supabaseAdmin
      .from("wallet_transactions")
      .insert({
        user_id: order.user_id,
        amount: Number(order.amount),
        type: "deposit",
        description: "Wallet deposit",
        reference_id: order.id,
      });

    return new NextResponse("Payment credited successfully", {
      status: 200,
    });
  } catch (error) {
    console.error("Pay0 webhook error:", error);

    return new NextResponse("Webhook error", {
      status: 500,
    });
  }
}