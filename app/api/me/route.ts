import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hashValue(value: string) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

export async function GET() {
  try {
    const cookieStore = await cookies();

    const sessionToken = cookieStore.get(
      "gamerzadda_session"
    )?.value;

    // No session
    if (!sessionToken) {
      return NextResponse.json(
        {
          authenticated: false,
        },
        { status: 401 }
      );
    }

    const tokenHash = hashValue(sessionToken);

    // Check session
    const { data: session, error: sessionError } =
      await supabaseAdmin
        .from("user_sessions")
        .select("user_id, expires_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json(
        {
          authenticated: false,
        },
        { status: 401 }
      );
    }

    // Session expired
    if (
      session.expires_at &&
      new Date(session.expires_at).getTime() <= Date.now()
    ) {
      await supabaseAdmin
        .from("user_sessions")
        .delete()
        .eq("token_hash", tokenHash);

      return NextResponse.json(
        {
          authenticated: false,
        },
        { status: 401 }
      );
    }

    // Get user status
    const { data: user, error: userError } =
      await supabaseAdmin
        .from("users")
        .select(
          "id, status, status_reason, status_updated_at, restricted_until"
        )
        .eq("id", session.user_id)
        .maybeSingle();

    if (userError || !user) {
      await supabaseAdmin
        .from("user_sessions")
        .delete()
        .eq("token_hash", tokenHash);

      return NextResponse.json(
        {
          authenticated: false,
        },
        { status: 401 }
      );
    }

    let status = String(
      user.status || "active"
    ).toLowerCase();

    // Auto-unrestrict when restriction expires
    if (
      status === "restricted" &&
      user.restricted_until &&
      new Date(user.restricted_until).getTime() <=
        Date.now()
    ) {
      const nowIso = new Date().toISOString();

      const { error: updateError } =
        await supabaseAdmin
          .from("users")
          .update({
            status: "active",
            status_reason: null,
            status_updated_at: nowIso,
            restricted_until: null,
          })
          .eq("id", user.id);

      if (!updateError) {
        status = "active";
      }
    }

    // BLOCKED
    if (status === "blocked") {
      await supabaseAdmin
        .from("user_sessions")
        .delete()
        .eq("user_id", session.user_id);

      return NextResponse.json(
        {
          authenticated: false,
          blocked: true,
          code: "ACCOUNT_BLOCKED",
          message: "Your account is blocked.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        }
      );
    }

    // RESTRICTED
    if (status === "restricted") {
      return NextResponse.json(
        {
          authenticated: true,
          userId: session.user_id,
          status: "restricted",
          restricted: true,
          statusReason:
            user.status_reason || null,
          statusUpdatedAt:
            user.status_updated_at || null,
          restrictedUntil:
            user.restricted_until || null,
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        }
      );
    }

    // ACTIVE
    return NextResponse.json(
      {
        authenticated: true,
        userId: session.user_id,
        status: "active",
        restricted: false,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("ME API ERROR:", error);

    return NextResponse.json(
      {
        authenticated: false,
      },
      { status: 401 }
    );
  }
}