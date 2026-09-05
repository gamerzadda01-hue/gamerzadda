import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PAY0_STATUS_URL =
  "https://pay0.shop/api/check-order-status";

export async function POST(request: Request) {
  try {
    // ==========================================
    // READ PAY0 WEBHOOK
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
    // FIND ORDER
    // ==========================================

    const { data: order, error: orderError } =
      await supabaseAdmin
        .from("deposit_orders")
        .select(
          `
          id,
          user_id,
          order_id,
          amount,
          status,
          bonus_percent,
          bonus_amount,
          processed_at
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
    // ALREADY PROCESSED
    // ==========================================

    if (
      order.status === "SUCCESS" ||
      order.processed_at
    ) {
      return new NextResponse(
        "Already processed",
        { status: 200 }
      );
    }

    // ==========================================
    // PAY0 API KEY
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
    // VERIFY PAYMENT WITH PAY0
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
    // VERIFY AMOUNT
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
    // ATOMIC WALLET CREDIT
    // ==========================================

    const { data: result, error: processError } =
      await supabaseAdmin.rpc(
        "process_successful_deposit",
        {
          p_order_id: orderId,
          p_utr:
            verifyResult.result.utr ||
            null,
        }
      );

    if (processError) {
      console.error(
        "Deposit processing error:",
        processError
      );

      return new NextResponse(
        "Wallet processing failed",
        { status: 500 }
      );
    }

    console.log(
      "Deposit processed:",
      orderId,
      result
    );

    // ==========================================
    // SUCCESS
    // ==========================================

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