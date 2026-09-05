import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

async function requireAdmin(request: Request) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return null;

  const { data: authData } = await supabaseAdmin.auth.getUser(token);
  const user = authData.user;
  if (!user) return null;

  const { data: admin } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (admin?.role !== "admin") return null;

  return user.id;
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";

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
          email,
          game_name,
          free_fire_uid
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Admin withdrawals GET:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, withdrawals: data || [] });
  } catch (error: any) {
    console.error("Admin withdrawals GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Something went wrong." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const withdrawalId = String(body?.withdrawalId || "");
    const action = String(body?.action || "").toLowerCase();
    const note = String(body?.note || "").trim();

    if (!withdrawalId) {
      return NextResponse.json({ error: "Withdrawal ID required." }, { status: 400 });
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc(
      "admin_process_withdrawal",
      {
        p_withdrawal_id: withdrawalId,
        p_action: action,
        p_note: note || null,
      }
    );

    if (error) {
      console.error("Admin withdrawal RPC:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data?.success) {
      return NextResponse.json(
        { error: data?.error || "Unable to process withdrawal." },
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Admin withdrawal PATCH:", error);
    return NextResponse.json(
      { error: error?.message || "Something went wrong." },
      { status: 500 }
    );
  }
}
