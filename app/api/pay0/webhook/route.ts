import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PAY0_STATUS_URL = "https://pay0.shop/api/check-order-status";

async function processFirstDepositReferralReward(
  userId: string,
  depositOrderId: string,
  orderId: string,
  depositAmount: number
) {
  try {
    const { data: referral, error: referralError } = await supabaseAdmin
      .from("referrals")
      .select("id,referrer_id,referred_user_id")
      .eq("referred_user_id", userId)
      .maybeSingle();

    if (referralError) {
      console.error("Deposit referral lookup error:", referralError);
      return;
    }

    if (!referral) return;

    const { data: existingReward, error: rewardLookupError } =
      await supabaseAdmin
        .from("referral_rewards")
        .select("id")
        .eq("referral_id", referral.id)
        .eq("reward_type", "first_deposit")
        .maybeSingle();

    if (rewardLookupError) {
      console.error("Deposit referral reward lookup error:", rewardLookupError);
      return;
    }

    if (existingReward) return;

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("referral_settings")
      .select("first_deposit_percent,is_active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error("Deposit referral settings error:", settingsError);
      return;
    }

    if (!settings?.is_active) return;

    const percent = Number(settings.first_deposit_percent || 0);

    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      console.error("Invalid first deposit referral percentage.");
      return;
    }

    const rewardAmount =
      Math.round(((depositAmount * percent) / 100) * 100) / 100;

    if (rewardAmount <= 0) return;

    const { data: rewardRow, error: insertRewardError } =
      await supabaseAdmin
        .from("referral_rewards")
        .insert({
          referral_id: referral.id,
          referrer_id: referral.referrer_id,
          referred_user_id: referral.referred_user_id,
          reward_type: "first_deposit",
          referrer_amount: rewardAmount,
          referred_amount: rewardAmount,
          referrer_wallet: "deposit",
          referred_wallet: "bonus",
          reference_id: depositOrderId,
        })
        .select("id")
        .single();

    if (insertRewardError || !rewardRow) {
      if (insertRewardError?.code === "23505") return;

      console.error(
        "First deposit referral reward record error:",
        insertRewardError
      );
      return;
    }

    const { data: referrerWallet } = await supabaseAdmin
      .from("wallet_balances")
      .select("deposit_balance")
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

      console.error("Deposit referral wallet not found.");
      return;
    }

    const oldReferrerDeposit = Number(referrerWallet.deposit_balance || 0);
    const oldReferredBonus = Number(referredWallet.bonus_balance || 0);

    const newReferrerDeposit =
      Math.round((oldReferrerDeposit + rewardAmount) * 100) / 100;

    const newReferredBonus =
      Math.round((oldReferredBonus + rewardAmount) * 100) / 100;

    const { data: updatedReferrer } = await supabaseAdmin
      .from("wallet_balances")
      .update({
        deposit_balance: newReferrerDeposit,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", referral.referrer_id)
      .eq("deposit_balance", oldReferrerDeposit)
      .select("user_id")
      .maybeSingle();

    if (!updatedReferrer) {
      await supabaseAdmin
        .from("referral_rewards")
        .delete()
        .eq("id", rewardRow.id);

      console.error("Referrer deposit wallet changed during reward.");
      return;
    }

    const { data: updatedReferred } = await supabaseAdmin
      .from("wallet_balances")
      .update({
        bonus_balance: newReferredBonus,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", referral.referred_user_id)
      .eq("bonus_balance", oldReferredBonus)
      .select("user_id")
      .maybeSingle();

    if (!updatedReferred) {
      await supabaseAdmin
        .from("wallet_balances")
        .update({
          deposit_balance: oldReferrerDeposit,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", referral.referrer_id)
        .eq("deposit_balance", newReferrerDeposit);

      await supabaseAdmin
        .from("referral_rewards")
        .delete()
        .eq("id", rewardRow.id);

      console.error("Referred user bonus wallet changed during reward.");
      return;
    }

    const { error: transactionError } = await supabaseAdmin
      .from("wallet_transactions")
      .insert([
        {
          user_id: referral.referrer_id,
          amount: rewardAmount,
          type: "referral_reward",
          description: `Referral reward • First deposit (${percent}%) • Deposit wallet`,
          reference_id: rewardRow.id,
        },
        {
          user_id: referral.referred_user_id,
          amount: rewardAmount,
          type: "referral_reward",
          description: `Referral reward • First deposit (${percent}%) • Bonus wallet`,
          reference_id: rewardRow.id,
        },
      ]);

    if (transactionError) {
      console.error("First deposit referral transaction history error:", transactionError);
    }

    console.log("FIRST DEPOSIT REFERRAL REWARD:", {
      orderId,
      userId,
      referrerId: referral.referrer_id,
      amount: rewardAmount,
      percent,
    });
  } catch (error) {
    console.error("First deposit referral reward error:", error);
  }
}

export async function POST(request: Request) {
  try {
    console.log("PAY0 WEBHOOK: START");

    const rawBody = await request.text();
    console.log("PAY0 WEBHOOK BODY:", rawBody.slice(0, 1000));

    let orderId = "";

    try {
      const params = new URLSearchParams(rawBody);
      orderId = String(params.get("order_id") || "").trim();
    } catch (e) {
      console.error("FORM PARSE ERROR:", e);
    }

    if (!orderId) {
      try {
        const json = JSON.parse(rawBody);
        orderId = String(json?.order_id || "").trim();
      } catch {}
    }

    console.log("PAY0 WEBHOOK ORDER ID:", orderId);

    if (!orderId) {
      return new NextResponse("Missing order_id", { status: 400 });
    }

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

    if (order.status === "SUCCESS" || order.processed_at) {
      console.log("PAY0 WEBHOOK: ALREADY PROCESSED");
      return new NextResponse("Already processed", { status: 200 });
    }

    const pay0ApiKey = process.env.PAY0_API_KEY;

    if (!pay0ApiKey) {
      console.error("PAY0_API_KEY MISSING");
      return new NextResponse("Server configuration error", { status: 500 });
    }

    const verifyData = new URLSearchParams();
    verifyData.set("user_token", pay0ApiKey);
    verifyData.set("order_id", orderId);

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

    console.log("PAY0 VERIFICATION HTTP:", verifyResponse.status);
    console.log("PAY0 VERIFICATION RAW:", responseText.slice(0, 2000));

    let verifyResult: any = null;

    try {
      verifyResult = JSON.parse(responseText);
    } catch (error) {
      console.error("PAY0 RESPONSE IS NOT JSON:", error);
      return new NextResponse("Pay0 verification service unavailable", {
        status: 502,
      });
    }

    if (
      !verifyResponse.ok ||
      verifyResult?.status !== true ||
      !verifyResult?.result
    ) {
      console.error("PAY0 VERIFICATION FAILED:", verifyResult);
      return new NextResponse("Payment verification failed", { status: 400 });
    }

    const txnStatus = String(
      verifyResult.result.txnStatus || ""
    ).toUpperCase();

    const paidAmount = Number(verifyResult.result.amount || 0);

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

    if (txnStatus !== "SUCCESS") {
      await supabaseAdmin
        .from("deposit_orders")
        .update({
          status: txnStatus || "PENDING",
        })
        .eq("order_id", orderId)
        .neq("status", "SUCCESS");

      return new NextResponse("Payment pending", { status: 200 });
    }

    const orderAmount = Number(order.amount);

    const paidAmountCents = Math.round(paidAmount * 100);
    const orderAmountCents = Math.round(orderAmount * 100);

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

      return new NextResponse("Amount mismatch", { status: 400 });
    }

    console.log("PAY0 WEBHOOK: PAYMENT VERIFIED SUCCESSFULLY");

    const { data: result, error: processError } =
      await supabaseAdmin.rpc("process_successful_deposit", {
        p_order_id: orderId,
        p_utr: utr,
      });

    console.log("DEPOSIT RPC RESULT:", { result, processError });

    if (processError) {
      console.error("DEPOSIT RPC ERROR:", processError);
      return new NextResponse("Wallet processing failed", { status: 500 });
    }

    // IMPORTANT:
    // Referral reward is processed ONLY after the deposit RPC succeeds.
    // Therefore a pending/failed payment cannot trigger this reward.
    await processFirstDepositReferralReward(
      order.user_id,
      order.id,
      orderId,
      orderAmount
    );

    console.log("PAY0 WEBHOOK: DEPOSIT CREDITED:", result);

    return new NextResponse("Payment credited successfully", { status: 200 });
  } catch (error) {
    console.error("PAY0 WEBHOOK FINAL ERROR:", error);
    return new NextResponse("Webhook error", { status: 500 });
  }
}
