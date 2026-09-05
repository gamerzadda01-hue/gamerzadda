import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SESSION_COOKIE = "gamerzadda_session";
const PAY0_API_URL = "https://pay0.shop/api/create-order";

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
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const amount = Number(body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Enter a valid amount." },
        { status: 400 }
      );
    }

    if (amount < 10) {
      return NextResponse.json(
        { error: "Minimum deposit amount is ₹10." },
        { status: 400 }
      );
    }

    if (Math.round(amount * 100) !== amount * 100) {
      return NextResponse.json(
        { error: "Amount can have maximum 2 decimal places." },
        { status: 400 }
      );
    }

    if (!process.env.PAY0_API_KEY) {
      console.error("PAY0_API_KEY is missing.");

      return NextResponse.json(
        { error: "Payment gateway is not configured." },
        { status: 500 }
      );
    }

    // Get user information
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, full_name, phone")
      .eq("id", userId)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    // Generate unique order ID
    const orderId = `GA${Date.now()}${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

    // Save order as pending BEFORE payment
    const { error: insertError } = await supabaseAdmin
      .from("deposit_orders")
      .insert({
        user_id: userId,
        order_id: orderId,
        amount: amount,
        status: "PENDING",
      });

    if (insertError) {
      console.error("Deposit order insert error:", insertError);

      return NextResponse.json(
        { error: "Unable to create deposit order." },
        { status: 500 }
      );
    }

    // Pay0 expects form-urlencoded data
    const formData = new URLSearchParams();

    formData.append(
      "customer_mobile",
      String(user.phone || "")
    );

    formData.append(
      "customer_name",
      String(user.full_name || "GamerzAdda User")
    );

    formData.append(
      "user_token",
      process.env.PAY0_API_KEY
    );

    formData.append(
      "amount",
      amount.toFixed(2)
    );

    formData.append(
      "order_id",
      orderId
    );

    // After payment, return the user to the GamerzAdda wallet page.
    formData.append(
      "redirect_url",
      `${process.env.NEXT_PUBLIC_APP_URL}/wallet`
    );

    formData.append(
      "remark1",
      userId
    );

    formData.append(
      "remark2",
      "GamerzAdda Deposit"
    );

    const pay0Response = await fetch(PAY0_API_URL, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
      cache: "no-store",
    });

    const pay0Data = await pay0Response.json();

    console.log("Pay0 response:", pay0Data);

    if (
      !pay0Response.ok ||
      !pay0Data?.status ||
      !pay0Data?.result?.payment_url
    ) {
      await supabaseAdmin
        .from("deposit_orders")
        .update({
          status: "FAILED",
        })
        .eq("order_id", orderId);

      return NextResponse.json(
        {
          error:
            pay0Data?.message ||
            "Unable to create payment.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      paymentUrl: pay0Data.result.payment_url,
    });
  } catch (error) {
    console.error("Create deposit error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
