import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return false;
  }

  const token = authorization.substring(7).trim();

  if (!token) {
    return false;
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return false;
  }

  const { data: admin, error } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return !error && admin?.role === "admin";
}

export async function GET(request: Request) {
  try {
    const isAdmin = await requireAdmin(request);

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    const status = (
      searchParams.get("status") || "pending"
    ).toLowerCase();

    let query = supabaseAdmin
      .from("withdraw_requests")
      .select(`
        id,
        user_id,
        amount,
        upi_id,
        status,
        service_charge,
        net_amount,
        admin_note,
        created_at,
        processed_at,
        users (
          full_name,
          email,
          phone,
          game_name,
          free_fire_uid
        )
      `)
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "Admin withdrawals GET error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      withdrawals: data || [],
    });
  } catch (error: any) {
    console.error(
      "Admin withdrawals GET exception:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Something went wrong.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const isAdmin = await requireAdmin(request);

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const withdrawalId = String(
      body?.withdrawalId || ""
    ).trim();

    const action = String(
      body?.action || ""
    )
      .trim()
      .toLowerCase();

    const note = String(
      body?.note || ""
    ).trim();

    if (!withdrawalId) {
      return NextResponse.json(
        {
          success: false,
          error: "Withdrawal ID required.",
        },
        { status: 400 }
      );
    }

    if (
      action !== "approve" &&
      action !== "reject"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid action.",
        },
        { status: 400 }
      );
    }

    const { data, error } =
      await supabaseAdmin.rpc(
        "admin_process_withdrawal",
        {
          p_withdrawal_id: withdrawalId,
          p_action: action,
          p_note: note || null,
        }
      );

    if (error) {
      console.error(
        "Admin withdrawal RPC error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
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
            "Unable to process withdrawal.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error(
      "Admin withdrawal PATCH exception:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Something went wrong.",
      },
      { status: 500 }
    );
  }
}