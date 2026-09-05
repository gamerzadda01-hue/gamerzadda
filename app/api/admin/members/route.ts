import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function requireAdmin(request: NextRequest) {
  // 1. Supabase Auth Bearer token
  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";

  if (bearerToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(bearerToken);

    if (!error && data?.user?.id) {
      const { data: admin, error: adminError } = await supabaseAdmin
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!adminError && admin?.role === "admin") {
        return { ok: true, userId: data.user.id };
      }

      return {
        ok: false,
        error: "Access denied. Admin only.",
      };
    }
  }

  // 2. Fallback custom session
  const token = request.cookies.get("gamerzadda_session")?.value;

  if (!token) {
    return {
      ok: false,
      error: "Admin login required.",
    };
  }

  let sessionToken = token;

  try {
    sessionToken = decodeURIComponent(token);
  } catch {}

  const tokenHash = hashValue(sessionToken);

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("user_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sessionError || !session?.user_id) {
    return {
      ok: false,
      error: "Invalid session.",
    };
  }

  if (
    session.expires_at &&
    new Date(session.expires_at) <= new Date()
  ) {
    return {
      ok: false,
      error: "Session expired.",
    };
  }

  const { data: admin, error: adminError } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", session.user_id)
    .maybeSingle();

  if (adminError || admin?.role !== "admin") {
    return {
      ok: false,
      error: "Access denied. Admin only.",
    };
  }

  return {
    ok: true,
    userId: session.user_id,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);

    if (!auth.ok) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error,
        },
        { status: 401 }
      );
    }

    const userId = request.nextUrl.searchParams.get("userId");

    // ============================================================
    // MEMBER DETAIL
    // ============================================================
    if (userId) {
      const [
        memberResult,
        walletResult,
        historyResult,
      ] = await Promise.all([
        supabaseAdmin
          .from("users")
          .select(
            `
            id,
            full_name,
            game_name,
            phone,
            email,
            free_fire_uid,
            role,
            status,
            ip_address,
            created_at,
            updated_at,
            referral_code,
            referred_by,
            bio,
            avatar_url
          `
          )
          .eq("id", userId)
          .maybeSingle(),

        supabaseAdmin
          .from("wallet_balances")
          .select(
            "deposit_balance, bonus_balance, winning_balance"
          )
          .eq("user_id", userId)
          .maybeSingle(),

        supabaseAdmin
          .from("wallet_transactions")
          .select(
            "id, amount, type, description, reference_id, created_at"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (memberResult.error) {
        console.error(
          "Member detail error:",
          memberResult.error
        );

        return NextResponse.json(
          {
            success: false,
            error: "Unable to load member details.",
          },
          { status: 500 }
        );
      }

      if (!memberResult.data) {
        return NextResponse.json(
          {
            success: false,
            error: "Member not found.",
          },
          { status: 404 }
        );
      }

      if (walletResult.error) {
        console.error(
          "Member wallet error:",
          walletResult.error
        );

        return NextResponse.json(
          {
            success: false,
            error: "Unable to load wallet.",
          },
          { status: 500 }
        );
      }

      if (historyResult.error) {
        console.error(
          "Wallet history error:",
          historyResult.error
        );

        return NextResponse.json(
          {
            success: false,
            error: "Unable to load wallet history.",
          },
          { status: 500 }
        );
      }

      const member = memberResult.data;

      // ============================================================
      // REFERRAL INFORMATION
      // ============================================================

      let referrer: any = null;

      // referred_by contains the referral CODE
      if (member.referred_by) {
        const { data: referrerData, error: referrerError } =
          await supabaseAdmin
            .from("users")
            .select(
              `
              id,
              full_name,
              game_name,
              phone,
              email,
              referral_code
            `
            )
            .eq("referral_code", member.referred_by)
            .maybeSingle();

        if (referrerError) {
          console.error(
            "Referrer lookup error:",
            referrerError
          );
        }

        referrer = referrerData || null;
      }

      // ============================================================
      // USERS REFERRED BY THIS MEMBER
      // ============================================================

      let referrals: any[] = [];

      if (member.referral_code) {
        const { data: referralUsers, error: referralError } =
          await supabaseAdmin
            .from("users")
            .select(
              `
              id,
              full_name,
              game_name,
              phone,
              email,
              free_fire_uid,
              status,
              created_at,
              referral_code,
              referred_by
            `
            )
            .eq("referred_by", member.referral_code)
            .order("created_at", { ascending: false });

        if (referralError) {
          console.error(
            "Referral users error:",
            referralError
          );
        }

        referrals = referralUsers || [];
      }

      // ============================================================
      // RETURN MEMBER DETAIL
      // ============================================================

      return NextResponse.json({
        success: true,

        member,

        profile: {
          bio: member.bio || "",
          avatar_url: member.avatar_url || null,
        },

        referral: {
          referral_code: member.referral_code || null,

          referred_by: member.referred_by || null,

          referrer: referrer
            ? {
                id: referrer.id,
                full_name: referrer.full_name,
                game_name: referrer.game_name,
                phone: referrer.phone,
                email: referrer.email,
                referral_code: referrer.referral_code,
              }
            : null,

          total_referrals: referrals.length,

          users: referrals,
        },

        wallet:
          walletResult.data || {
            deposit_balance: 0,
            bonus_balance: 0,
            winning_balance: 0,
          },

        history: historyResult.data || [],
      });
    }

    // ============================================================
    // MEMBER LIST
    // ============================================================

    const { data: users, error: usersError } =
      await supabaseAdmin
        .from("users")
        .select(
          `
          id,
          full_name,
          phone,
          email,
          free_fire_uid,
          role,
          created_at,
          ip_address,
          game_name,
          status,
          referral_code,
          referred_by
        `
        )
        .order("created_at", {
          ascending: false,
        });

    if (usersError) {
      console.error(
        "Members query error:",
        usersError
      );

      return NextResponse.json(
        {
          success: false,
          error: usersError.message,
        },
        { status: 500 }
      );
    }

    const memberRows = users || [];
    const memberIds = memberRows.map(
      (member) => member.id
    );

    const walletMap: Record<string, number> = {};
    const activityMap: Record<
      string,
      string | null
    > = {};

    if (memberIds.length > 0) {
      // Wallet totals
      const {
        data: wallets,
        error: walletError,
      } = await supabaseAdmin
        .from("wallet_balances")
        .select(
          "user_id, deposit_balance, bonus_balance, winning_balance"
        )
        .in("user_id", memberIds);

      if (walletError) {
        console.error(
          "Wallet list error:",
          walletError
        );
      }

      for (const wallet of wallets || []) {
        walletMap[wallet.user_id] =
          Number(wallet.deposit_balance || 0) +
          Number(wallet.bonus_balance || 0) +
          Number(wallet.winning_balance || 0);
      }

      // Last wallet activity
      const {
        data: transactions,
        error: transactionError,
      } = await supabaseAdmin
        .from("wallet_transactions")
        .select("user_id, created_at")
        .in("user_id", memberIds)
        .order("created_at", {
          ascending: false,
        });

      if (transactionError) {
        console.error(
          "Wallet activity error:",
          transactionError
        );
      }

      for (const tx of transactions || []) {
        if (!activityMap[tx.user_id]) {
          activityMap[tx.user_id] =
            tx.created_at;
        }
      }
    }

    const members = memberRows.map(
      (member) => ({
        ...member,

        wallet_total:
          walletMap[member.id] || 0,

        last_wallet_activity:
          activityMap[member.id] || null,
      })
    );

    return NextResponse.json({
      success: true,
      members,
    });
  } catch (error) {
    console.error(
      "Admin members GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest
) {
  try {
    const auth = await requireAdmin(request);

    if (!auth.ok) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error,
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const userId = String(
      body?.userId || ""
    ).trim();

    const walletType = String(
      body?.walletType || ""
    )
      .trim()
      .toLowerCase();

    const amount = Number(body?.amount);

    const note = String(
      body?.note ||
        "Admin wallet adjustment"
    )
      .trim()
      .slice(0, 250);

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Member ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      !["deposit", "bonus", "winning"].includes(
        walletType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid wallet type.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(amount) ||
      amount === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter a valid adjustment amount.",
        },
        { status: 400 }
      );
    }

    if (
      Math.round(amount * 100) / 100 !==
      amount
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Maximum 2 decimal places allowed.",
        },
        { status: 400 }
      );
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        "admin_adjust_wallet",
        {
          p_user_id: userId,
          p_wallet_type: walletType,
          p_amount: amount,
          p_note:
            note ||
            "Admin wallet adjustment",
        }
      );

    if (error) {
      console.error(
        "Admin wallet adjustment RPC error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error.message ||
            "Unable to change wallet.",
        },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            data?.error ||
            "Unable to change wallet.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "Admin members PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Something went wrong.",
      },
      { status: 500 }
    );
  }
}