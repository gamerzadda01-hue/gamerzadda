import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PAY0_STATUS_URL =
  "https://pay0.shop/api/check-order-status";

export async function POST(request: Request) {
  try {
    console.log("WEBHOOK STEP 1: START");

    const formData = await request.formData();

    console.log("WEBHOOK STEP 2: FORMDATA READ");

    const orderId = String(
      formData.get("order_id") || ""
    ).trim();

    console.log("WEBHOOK STEP 3: ORDER ID:", orderId);

    if (!orderId) {
      return new NextResponse("Missing order_id", {
        status: 400,
      });
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

    console.log("WEBHOOK STEP 4: ORDER QUERY DONE");

    if (orderError) {
      console.error(
        "ORDER QUERY ERROR:",
        orderError
      );

      return new NextResponse("Database error", {
        status: 500,
      });
    }

    if (!order) {
      console.error(
        "ORDER NOT FOUND:",
        orderId
      );

      return new NextResponse("Order not found", {
        status: 404,
      });
    }

    console.log(
      "WEBHOOK STEP 5: ORDER FOUND:",
      {
        orderId: order.order_id,
        amount: order.amount,
        status: order.status,
        bonusPercent: order.bonus_percent,
        bonusAmount: order.bonus_amount,
      }
    );

    // ==========================================
    // ALREADY PROCESSED
    // ==========================================

    if (
      order.status === "SUCCESS" ||
      order.processed_at
    ) {
      console.log(
        "WEBHOOK STEP 6: ALREADY PROCESSED"
      );

      return new NextResponse(
        "Already processed",
        { status: 200 }
      );
    }

    // ==========================================
    // PAY0 KEY
    // ==========================================

    const pay0ApiKey =
      process.env.PAY0_API_KEY;

    if (!pay0ApiKey) {
      console.error(
        "WEBHOOK STEP 6: PAY0_API_KEY MISSING"
      );

      return new NextResponse(
        "Server configuration error",
        { status: 500 }
      );
    }

    console.log(
      "WEBHOOK STEP 6: PAY0 KEY FOUND"
    );

    // ==========================================
    // VERIFY PAYMENT
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

    console.log(
      "WEBHOOK STEP 7: CALLING PAY0"
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

    console.log(
      "WEBHOOK STEP 8: PAY0 HTTP:",
      verifyResponse.status
    );

    const responseText =
      await verifyResponse.text();

    console.log(
      "WEBHOOK STEP 9: PAY0 RESPONSE RECEIVED"
    );

    let verifyResult: any;

    try {
      verifyResult =
        JSON.parse(responseText);
    } catch (jsonError) {
      console.error(
        "WEBHOOK STEP 10: JSON PARSE ERROR:",
        jsonError
      );

      console.error(
        "PAY0 RAW RESPONSE:",
        responseText.slice(0, 1000)
      );

      return new NextResponse(
        "Pay0 verification service unavailable",
        { status: 502 }
      );
    }

    console.log(
      "WEBHOOK STEP 10: PAY0 JSON OK:",
      verifyResult
    );

    // ==========================================
    // VERIFY PAY0 RESULT
    // ==========================================

    if (
      !verifyResponse.ok ||
      !verifyResult?.status ||
      !verifyResult?.result
    ) {
      console.error(
        "WEBHOOK STEP 11: PAY0 VERIFICATION FAILED:",
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

    console.log(
      "WEBHOOK STEP 12: PAYMENT DETAILS:",
      {
        orderId,
        txnStatus,
        paidAmount,
        orderAmount: Number(order.amount),
        utr,
      }
    );

    // ==========================================
    // PAYMENT NOT SUCCESS
    // ==========================================

    if (txnStatus !== "SUCCESS") {
      console.log(
        "WEBHOOK STEP 13: PAYMENT NOT SUCCESS:",
        txnStatus
      );

      const { error } =
        await supabaseAdmin
          .from("deposit_orders")
          .update({
            status:
              txnStatus || "PENDING",
          })
          .eq("order_id", orderId)
          .neq("status", "SUCCESS");

      if (error) {
        console.error(
          "STATUS UPDATE ERROR:",
          error
        );
      }

      return new NextResponse(
        "Payment pending",
        { status: 200 }
      );
    }

    console.log(
      "WEBHOOK STEP 13: PAYMENT SUCCESS"
    );

    // ==========================================
    // AMOUNT CHECK
    // ==========================================

    const orderAmount =
      Number(order.amount);

    const paidAmountCents =
      Math.round(paidAmount * 100);

    const orderAmountCents =
      Math.round(orderAmount * 100);

    console.log(
      "WEBHOOK STEP 14: AMOUNT CHECK:",
      {
        paidAmountCents,
        orderAmountCents,
      }
    );

    if (
      !Number.isFinite(paidAmount) ||
      paidAmountCents !== orderAmountCents
    ) {
      console.error(
        "WEBHOOK STEP 15: AMOUNT MISMATCH"
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

    console.log(
      "WEBHOOK STEP 15: AMOUNT VERIFIED"
    );

    // ==========================================
    // RPC START
    // ==========================================

    console.log(
      "WEBHOOK STEP 16: RPC START:",
      {
        orderId,
        userId: order.user_id,
        depositAmount: orderAmount,
        bonusPercent: order.bonus_percent,
        bonusAmount: order.bonus_amount,
        utr,
      }
    );

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

    // ==========================================
    // RPC RESULT
    // ==========================================

    console.log(
      "WEBHOOK STEP 17: RPC RESPONSE:",
      {
        orderId,
        result,
        processError,
      }
    );

    if (processError) {
      console.error(
        "WEBHOOK STEP 18: RPC ERROR:",
        processError
      );

      return new NextResponse(
        "Wallet processing failed",
        { status: 500 }
      );
    }

    console.log(
      "WEBHOOK STEP 19: DEPOSIT PROCESSED SUCCESSFULLY:",
      {
        orderId,
        result,
      }
    );

    return new NextResponse(
      "Payment credited successfully",
      { status: 200 }
    );

  } catch (error) {
    console.error(
      "WEBHOOK FINAL ERROR:",
      error
    );

    return new NextResponse(
      "Webhook error",
      { status: 500 }
    );
  }
}