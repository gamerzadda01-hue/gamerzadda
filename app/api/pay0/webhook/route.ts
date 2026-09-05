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
    ).trim();

    if (!orderId) {
      console.error("Pay0 webhook: Missing order_id");

      return new NextResponse("Missing order_id", {
        status: 400,
      });
    }

    console.log("Pay0 webhook received:", orderId);

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

      return new NextResponse("Database error", {
        status: 500,
      });
    }

    if (!order) {
      console.error(
        "Unknown Pay0 order:",
        orderId
      );

      return new NextResponse("Order not found", {
        status: 404,
      });
    }

    // ==========================================
    // ALREADY PROCESSED
    // ==========================================

    if (
      order.status === "SUCCESS" ||
      order.processed_at
    ) {
      console.log(
        "Deposit already processed:",
        orderId
      );

      return new NextResponse("Already processed", {
        status: 200,
      });
    }

    // ==========================================
    // PAY0 API KEY
    // ==========================================

    const pay0ApiKey =
      process.env.PAY0_API_KEY;

    if (!pay0ApiKey) {
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
      pay0ApiKey
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
            Accept: "application/json",
          },
          body:
            verifyData.toString(),
          cache: "no-store",
        }
      );

    // ==========================================
    // READ RESPONSE SAFELY
    // ==========================================

    const responseText =
      await verifyResponse.text();

    console.log(
      "Pay0 verification HTTP status:",
      verifyResponse.status
    );

    // Pay0/Cloudflare may return HTML instead of JSON
    let verifyResult: any = null;

    try {
      verifyResult =
        JSON.parse(responseText);
    } catch {
      console.error(
        "Pay0 returned non-JSON response:",
        responseText.slice(0, 1000)
      );

      return new NextResponse(
        "Pay0 verification service unavailable",
        { status: 502 }
      );
    }

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
      console.error(
        "Pay0 verification failed:",
        verifyResult
      );

      return new NextResponse(
        "Payment verification failed",
        { status: 400 }
      );
    }

    const txnStatus =
      String(
        verifyResult.result.txnStatus || ""
      ).toUpperCase();

    const paidAmount =
      Number(
        verifyResult.result.amount || 0
      );

    const utr =
      verifyResult.result.utr ||
      null;

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

      console.log(
        "Payment not successful:",
        orderId,
        txnStatus
      );

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
      Math.round(paidAmount * 100) !==
        Math.round(orderAmount * 100)
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

    const {
      data: result,
      error: processError,
    } = await supabaseAdmin.rpc(
      "process_successful_deposit",
      {
        p_order_id: orderId,
        p_utr: utr,
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
      "Deposit processed successfully:",
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