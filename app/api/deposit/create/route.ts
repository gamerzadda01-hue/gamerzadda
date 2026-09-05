import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PAY0_CREATE_ORDER_URL =
  "https://pay0.shop/api/create-order";

export async function POST(request: Request) {
  try {
    // ==========================================
    // AUTHENTICATE USER
    // ==========================================

    const cookieHeader = request.headers.get("cookie") || "";

    const sessionMatch = cookieHeader.match(
      /(?:^|;\s*)gamerzadda_session=([^;]+)/
    );

    if (!sessionMatch) {
      return NextResponse.json(
        {
          success: false,
          message: "Please login first",
        },
        { status: 401 }
      );
    }

    const sessionToken = decodeURIComponent(sessionMatch[1]);

    const tokenHash = crypto
      .createHash("sha256")
      .update(sessionToken)
      .digest("hex");

    const { data: session, error: sessionError } =
      await supabaseAdmin
        .from("user_sessions")
        .select("user_id, expires_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();

    if (sessionError) {
      console.error("Session lookup error:", sessionError);

      return NextResponse.json(
        {
          success: false,
          message: "Authentication failed",
        },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid session",
        },
        { status: 401 }
      );
    }

    if (
      session.expires_at &&
      new Date(session.expires_at) <= new Date()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Session expired",
        },
        { status: 401 }
      );
    }

    const userId = session.user_id;

    // ==========================================
    // READ REQUEST
    // ==========================================

    const body = await request.json();
    const amount = Number(body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid deposit amount",
        },
        { status: 400 }
      );
    }

    // Maximum 2 decimal places
    if (Math.round(amount * 100) / 100 !== amount) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Amount can have maximum 2 decimal places",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // LOAD ADMIN WALLET SETTINGS
    // ==========================================

    const { data: settings, error: settingsError } =
      await supabaseAdmin
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "min_deposit_amount",
          "deposit_bonus_percent",
        ]);

    if (settingsError) {
      console.error(
        "Wallet settings error:",
        settingsError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to load deposit settings",
        },
        { status: 500 }
      );
    }

    let minDeposit = 10;
    let bonusPercent = 10;

    for (const setting of settings || []) {
      if (setting.key === "min_deposit_amount") {
        const value = Number(setting.value);

        if (Number.isFinite(value) && value > 0) {
          minDeposit = value;
        }
      }

      if (setting.key === "deposit_bonus_percent") {
        const value = Number(setting.value);

        if (
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 100
        ) {
          bonusPercent = value;
        }
      }
    }

    // ==========================================
    // MINIMUM DEPOSIT CHECK
    // ==========================================

    if (amount < minDeposit) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Minimum deposit amount is ₹${minDeposit}`,
        },
        { status: 400 }
      );
    }

    // ==========================================
    // CALCULATE BONUS
    // ==========================================

    const bonusAmount =
      Math.round(
        ((amount * bonusPercent) / 100) * 100
      ) / 100;

    // ==========================================
    // PAY0 API KEY
    // ==========================================

    if (!process.env.PAY0_API_KEY) {
      console.error("PAY0_API_KEY missing");

      return NextResponse.json(
        {
          success: false,
          message:
            "Payment gateway configuration error",
        },
        { status: 500 }
      );
    }

    // ==========================================
    // APP URL
    // ==========================================

    const appUrl = process.env.APP_URL;

    if (!appUrl) {
      console.error("APP_URL missing");

      return NextResponse.json(
        {
          success: false,
          message:
            "Application URL is not configured",
        },
        { status: 500 }
      );
    }

    // ==========================================
    // CREATE UNIQUE ORDER ID
    // ==========================================

    const orderId =
      `GA${Date.now()}${crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;

    // ==========================================
    // SAVE PENDING DEPOSIT ORDER
    // ==========================================

    const { data: depositOrder, error: orderError } =
      await supabaseAdmin
        .from("deposit_orders")
        .insert({
          user_id: userId,
          order_id: orderId,
          amount: amount,
          status: "PENDING",
          bonus_percent: bonusPercent,
          bonus_amount: bonusAmount,
        })
        .select("id, order_id")
        .single();

    if (orderError || !depositOrder) {
      console.error(
        "Deposit order creation error:",
        orderError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to create deposit order",
        },
        { status: 500 }
      );
    }

    // ==========================================
    // CREATE PAY0 ORDER
    // ==========================================

    const pay0Data = new URLSearchParams();

    pay0Data.append(
      "user_token",
      process.env.PAY0_API_KEY
    );

    pay0Data.append(
      "amount",
      amount.toFixed(2)
    );

    pay0Data.append(
      "order_id",
      orderId
    );

    pay0Data.append(
      "redirect_url",
      `${appUrl}/wallet`
    );

    pay0Data.append(
      "remark1",
      userId
    );

    pay0Data.append(
      "remark2",
      "GamerzAdda Deposit"
    );

    const pay0Response = await fetch(
      PAY0_CREATE_ORDER_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: pay0Data.toString(),
        cache: "no-store",
      }
    );

    const pay0Text = await pay0Response.text();

    let pay0Result: any = null;

    try {
      pay0Result = JSON.parse(pay0Text);
    } catch {
      console.error(
        "Pay0 returned non-JSON response:",
        pay0Text
      );
    }

    console.log(
      "Pay0 create order response:",
      orderId,
      pay0Result
    );

    // ==========================================
    // PAY0 ERROR
    // ==========================================

    if (!pay0Response.ok || !pay0Result) {
      await supabaseAdmin
        .from("deposit_orders")
        .update({
          status: "FAILED",
        })
        .eq("order_id", orderId);

      return NextResponse.json(
        {
          success: false,
          message: "Payment gateway error",
        },
        { status: 502 }
      );
    }

    // ==========================================
    // GET PAYMENT URL
    // ==========================================

    const paymentUrl =
      pay0Result?.result?.payment_url ||
      pay0Result?.result?.paymentUrl ||
      pay0Result?.payment_url ||
      pay0Result?.paymentUrl ||
      pay0Result?.url ||
      null;

    if (!paymentUrl) {
      console.error(
        "Pay0 payment URL missing:",
        pay0Result
      );

      await supabaseAdmin
        .from("deposit_orders")
        .update({
          status: "FAILED",
        })
        .eq("order_id", orderId);

      return NextResponse.json(
        {
          success: false,
          message:
            "Payment gateway did not return payment URL",
        },
        { status: 502 }
      );
    }

    // ==========================================
    // SUCCESS
    // ==========================================

    return NextResponse.json({
      success: true,
      orderId,
      paymentUrl,
      amount,
      bonusPercent,
      bonusAmount,
      totalCredit:
        Math.round(
          (amount + bonusAmount) * 100
        ) / 100,
    });
  } catch (error) {
    console.error(
      "Deposit create error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong",
      },
      { status: 500 }
    );
  }
}