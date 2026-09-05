import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SESSION_COOKIE = "gamerzadda_session";
const MAX_FILE_SIZE = 2 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

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
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Profile picture is required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: "Only JPG, PNG or WebP images are allowed.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "Profile picture must be 2 MB or smaller.",
        },
        { status: 400 }
      );
    }

    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
        ? "webp"
        : "jpg";

    const filePath = `${userId}/profile.${extension}`;

    /*
      Remove old profile pictures first.
      This prevents multiple profile images for the same user.
    */
    const { data: oldFiles } = await supabaseAdmin.storage
      .from("profile-pictures")
      .list(userId);

    if (oldFiles && oldFiles.length > 0) {
      const oldPaths = oldFiles
        .filter((file) => file.name.startsWith("profile."))
        .map((file) => `${userId}/${file.name}`);

      if (oldPaths.length > 0) {
        await supabaseAdmin.storage
          .from("profile-pictures")
          .remove(oldPaths);
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from("profile-pictures")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);

      return NextResponse.json(
        { error: "Failed to upload profile picture." },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("profile-pictures")
      .getPublicUrl(filePath);

    const avatarUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        avatar_url: avatarUrl,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Avatar database error:", updateError);

      return NextResponse.json(
        { error: "Picture uploaded but profile update failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      avatarUrl,
    });
  } catch (error) {
    console.error("Avatar API error:", error);

    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}