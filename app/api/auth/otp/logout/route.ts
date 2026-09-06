import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("gamerzadda_session")?.value;

    if (sessionToken) {
      const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex");
      await supabaseAdmin.from("user_sessions").delete().eq("token_hash", tokenHash);
    }

    cookieStore.set("gamerzadda_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ success: false, message: "Logout failed" }, { status: 500 });
  }
}
