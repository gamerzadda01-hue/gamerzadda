import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PAY0_STATUS_URL = "https://pay0.shop/api/check-order-status";

export async function POST(request: Request) {
  try {
    console.log("PAY0 WEBHOOK: START");

    // 1. Read webhook body
    const rawBody = await request.text();

    console.log("PAY0 WEBHOOK BODY:", rawBody.slice(0, 1000));

    let orderId = "";

    // Pay0 normally sends form-urlencoded
    try {
      const params = new URLSearchParams(rawBody);
      orderId = String(params.get("order_id") || "").trim();
    } catch (e) {
      console.error("FORM PARSE ERROR:", e);
    }

    // Fallback: JSON body
    if (!orderId) {
      try {
        const json = JSON.parse(rawBody);
        orderId = String(json?.order_id || "").trim();
      } catch {
        // Not JSON
      }
    }

    console.log("PAY0 WEBHOOK ORDER ID:", orderId);

    if (!orderId) {
      return new NextResponse("Missing order_id", { status: 400 });
    }

    // 2. Find deposit order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("deposit_orders")
      .select(
        "id,user_id,order_id,amount,status,bonus_percent,bonus_amount,processed_at"
      )
      .eq("order_id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error("ORDER QUERY ERROR:", orderError);
      return new NextResponse("Database error", { status: 500 });
    }

    if (!order) {
      console.error("ORDER NOT FOUND:", orderId);
      return new NextResponse("Order not found", { status: 404 });
    }

    console.log("PAY0 WEBHOOK ORDER FOUND:", order);

    // 3. Duplicate protection
    if (order.status === "SUCCESS" || order.processed_at) {
      console.log("PAY0 WEBHOOK: ALREADY PROCESSED");
      return new NextResponse("Already processed", { status: 200 });
    }

    // 4. Pay0 API key
    const pay0ApiKey = process.env.PAY0_API_KEY;

    if (!pay0ApiKey) {
      console.error("PAY0_API_KEY MISSING");
      return new NextResponse("Server configuration error", {
        status: 500,
      });
    }

    // 5. Verify directly with Pay0
    const verifyData = new URLSearchParams();
    verifyData.set("user_token", pay0ApiKey);
    verifyData.set("order_id", orderId);

    console.log("PAY0 VERIFICATION: CALLING API");

    const verifyResponse = await fetch(PAY0_STATUS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: verifyData.toString(),
      cache: "no-store",
    });

    const responseText = await verifyResponse.text();

    console.log(
      "PAY0 VERIFICATION HTTP:",
      verifyResponse.status
    );

    console.log(
      "PAY0 VERIFICATION RAW:",
      responseText.slice(0, 2000)
    );

    // 6. Parse Pay0 response safely
    let verifyResult: any = null;

    try {
      verifyResult = JSON.parse(responseText);
    } catch (error) {
      console.error("PAY0 RESPONSE IS NOT JSON:", error);

      return new NextResponse(
        "Pay0 verification service unavailable",
        { status: 502 }
      );
    }

    console.log("PAY0 VERIFICATION RESULT:", verifyResult);

    // 7. Validate Pay0 response
    if (
      !verifyResponse.ok ||
      verifyResult?.status !== true ||
      !verifyResult?.result
    ) {
      console.error(
        "PAY0 VERIFICATION FAILED:",
        verifyResult
      );

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

    const utr = verifyResult.result.utr
      ? String(verifyResult.result.utr)
      : null;

    console.log("PAY0 PAYMENT DETAILS:", {
      orderId,
      txnStatus,
      paidAmount,
      orderAmount: Number(order.amount),
      utr,
    });

    // 8. Payment not successful
    if (txnStatus !== "SUCCESS") {
      console.log(
        "PAY0 PAYMENT NOT SUCCESS:",
        txnStatus
      );

      await supabaseAdmin
        .from("deposit_orders")
        .update({
          status: txnStatus || "PENDING",
        })
        .eq("order_id", orderId)
        .neq("status", "SUCCESS");

      return new NextResponse("Payment pending", {
        status: 200,
      });
    }

    // 9. Amount verification
    const orderAmount = Number(order.amount);

    const paidAmountCents = Math.round(
      paidAmount * 100
    );

    const orderAmountCents = Math.round(
      orderAmount * 100
    );

    if (
      !Number.isFinite(paidAmount) ||
      paidAmountCents !== orderAmountCents
    ) {
      console.error("AMOUNT MISMATCH:", {
        orderId,
        paidAmount,
        orderAmount,
      });

      await supabaseAdmin
        .from("deposit_orders")
        .update({
          status: "FAILED",
        })
        .eq("order_id", orderId)
        .neq("status", "SUCCESS");

      return new NextResponse("Amount mismatch", {
        status: 400,
      });
    }

    console.log(
      "PAY0 WEBHOOK: PAYMENT VERIFIED SUCCESSFULLY"
    );

    // 10. Process deposit + bonus atomically
    const { data: result, error: processError } =
      await supabaseAdmin.rpc(
        "process_successful_deposit",
        {
          p_order_id: orderId,
          p_utr: utr,
        }
      );

    console.log("DEPOSIT RPC RESULT:", {
      result,
      processError,
    });

    if (processError) {
      console.error(
        "DEPOSIT RPC ERROR:",
        processError
      );

      return new NextResponse(
        "Wallet processing failed",
        { status: 500 }
      );
    }

    console.log(
      "PAY0 WEBHOOK: DEPOSIT CREDITED:",
      result
    );

    return new NextResponse(
      "Payment credited successfully",
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "PAY0 WEBHOOK FINAL ERROR:",
      error
    );

    return new NextResponse("Webhook error", {
      status: 500,
    });
  }
}