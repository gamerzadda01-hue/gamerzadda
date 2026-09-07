import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SESSION_COOKIE = "gamerzadda_session";

async function getUserId() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

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

export async function GET() {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("game_name,free_fire_uid,level")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Player details GET:", error);
      return NextResponse.json(
        { success: false, error: "Unable to load player details." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      gameName: user?.game_name ?? "",
      uid: user?.free_fire_uid ?? "",
      level: user?.level ?? null,
    });
  } catch (error) {
    console.error("Player details GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
