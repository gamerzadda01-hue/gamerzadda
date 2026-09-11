import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hashValue(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

export async function POST() {
  const cookieStore = await cookies();

  const sessionToken =
    cookieStore.get("gamerzadda_session")?.value;

  try {
    if (sessionToken) {
      const tokenHash = hashValue(sessionToken);

      const { error } = await supabaseAdmin
        .from("user_sessions")
        .delete()
        .eq("token_hash", tokenHash);

      if (error) {
        console.error(
          "Logout session delete error:",
          error
        );
      }
    }
  } catch (error) {
    console.error("Logout DB error:", error);
  }

  const response = NextResponse.json({
    success: true,
    redirect: "/login",
  });

  response.cookies.set("gamerzadda_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}