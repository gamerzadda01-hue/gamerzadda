import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const OTP_EXPIRY_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const SESSION_DAYS = 30;

// Initial send = resend_count 0
// 1st resend = 1 min
// 2nd resend = 3 min
// 3rd resend = 5 min
// 4th resend = 1 hour
// 5th resend = 24 hours
const COOLDOWNS = [60, 180, 300, 3600, 86400];

function normalizePhone(phone: string): string | null {
  const cleaned = String(phone || "").replace(/\D/g, "");

  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  if (
    cleaned.length === 12 &&
    cleaned.startsWith("91") &&
    /^[6-9]\d{9}$/.test(cleaned.slice(2))
  ) {
    return cleaned.slice(2);
  }

  return null;
}

function hashValue(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function generateOTP(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateReferralCode(): string {
  return (
    "GZ" +
    crypto
      .randomBytes(5)
      .toString("hex")
      .toUpperCase()
  );
}

async function createSession(userId: string) {
  const token = generateSessionToken();
  const tokenHash = hashValue(token);

  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  );

  const { error } = await supabaseAdmin
    .from("user_sessions")
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    console.error("Session insert error:", error);
    throw new Error("SESSION_CREATE_FAILED");
  }

  const cookieStore = await cookies();

  cookieStore.set("gamerzadda_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

async function sendSMS(phone: string, otp: string) {
  const username = process.env.HSP_SMS_USERNAME;
  const apiKey = process.env.HSP_SMS_API_KEY;
  const sender = process.env.HSP_SMS_SENDER;

  if (!username || !apiKey || !sender) {
    throw new Error("SMS_CONFIG_MISSING");
  }

  const message =
    `${otp} is the OTP for Gamerzadda. ` +
    `Please do not share this OTP with anyone. ` +
    `This SMS has been sent from GuestRAR.`;

  const params = new URLSearchParams({
    username,
    message,
    sendername: sender,
    smstype: "TRANS",
    numbers: phone,
    apikey: apiKey,
  });

  const response = await fetch(
    `https://sms.hspsms.com/sendSMS?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const result = await response.text();

  console.log("HSP SMS Response:", result);

  if (!response.ok) {
    throw new Error("SMS_PROVIDER_ERROR");
  }

  const normalizedResult = result.trim().toUpperCase();

  if (
    normalizedResult.includes("INVALID_KEY") ||
    normalizedResult.includes("ERROR") ||
    normalizedResult.includes("FAILED")
  ) {
    throw new Error("SMS_PROVIDER_ERROR");
  }

  return true;
}

async function verifyOTP(
  phone: string,
  enteredOtp: string
) {
  const { data: otpRecord, error } =
    await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("phone", phone)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (error) {
    console.error("OTP lookup error:", error);

    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Unable to verify OTP",
        },
        { status: 500 }
      ),
    };
  }

  if (!otpRecord) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          code: "OTP_NOT_FOUND",
          message:
            "OTP not found. Please request a new OTP.",
        },
        { status: 400 }
      ),
    };
  }

  const now = new Date();

  // OTP already used
  if (otpRecord.verified_at) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          code: "OTP_ALREADY_USED",
          message:
            "This OTP has already been used. Please request a new OTP.",
        },
        { status: 400 }
      ),
    };
  }

  // Wrong-attempt temporary block
  if (
    otpRecord.blocked_until &&
    new Date(otpRecord.blocked_until) > now
  ) {
    const remainingSeconds = Math.ceil(
      (new Date(otpRecord.blocked_until).getTime() -
        now.getTime()) /
        1000
    );

    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          code: "OTP_COOLDOWN",
          message:
            "Too many incorrect attempts. Please wait before trying again.",
          retryAfterSeconds: remainingSeconds,
        },
        { status: 429 }
      ),
    };
  }

  // OTP expired
  if (new Date(otpRecord.expires_at) < now) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          code: "OTP_EXPIRED",
          message:
            "OTP has expired. Please request a new OTP.",
        },
        { status: 400 }
      ),
    };
  }

  // Maximum attempts reached
  if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          code: "TOO_MANY_ATTEMPTS",
          message:
            "Too many incorrect attempts. Please request a new OTP.",
        },
        { status: 429 }
      ),
    };
  }

  const enteredHash = hashValue(enteredOtp);

  // Wrong OTP
  if (enteredHash !== otpRecord.otp_hash) {
    const newAttempts = otpRecord.attempts + 1;

    const updateData: {
      attempts: number;
      blocked_until?: string;
    } = {
      attempts: newAttempts,
    };

    if (newAttempts >= MAX_OTP_ATTEMPTS) {
      updateData.blocked_until = new Date(
        Date.now() + 5 * 60 * 1000
      ).toISOString();
    }

    await supabaseAdmin
      .from("otp_verifications")
      .update(updateData)
      .eq("id", otpRecord.id);

    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          code: "WRONG_OTP",
          message:
            newAttempts >= MAX_OTP_ATTEMPTS
              ? "Too many incorrect attempts. Please request a new OTP."
              : "Incorrect OTP",
          attemptsRemaining: Math.max(
            0,
            MAX_OTP_ATTEMPTS - newAttempts
          ),
        },
        { status: 400 }
      ),
    };
  }

  // Mark OTP as verified.
  // IMPORTANT:
  // Do NOT delete the record.
  // This keeps the resend cooldown information.
  const { error: verifyUpdateError } =
    await supabaseAdmin
      .from("otp_verifications")
      .update({
        verified_at: now.toISOString(),
      })
      .eq("id", otpRecord.id);

  if (verifyUpdateError) {
    console.error(
      "OTP verification update error:",
      verifyUpdateError
    );

    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message:
            "Unable to complete OTP verification.",
        },
        { status: 500 }
      ),
    };
  }

  return {
    success: true,
    response: null,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const phone = normalizePhone(body.phone);

    const action = body.action || "send";
    const flow = body.flow || "login";

    // Validate flow
    if (flow !== "login" && flow !== "signup") {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_FLOW",
          message: "Invalid authentication flow",
        },
        { status: 400 }
      );
    }

    // Validate phone
    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_PHONE",
          message: "Invalid mobile number",
        },
        { status: 400 }
      );
    }

    /*
     * ==========================================
     * VERIFY OTP
     * ==========================================
     */

    if (action === "verify") {
      const enteredOtp = String(body.otp || "").trim();

      if (!/^\d{6}$/.test(enteredOtp)) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_OTP",
            message: "Enter a valid 6-digit OTP",
          },
          { status: 400 }
        );
      }

      const verification = await verifyOTP(
        phone,
        enteredOtp
      );

      if (!verification.success) {
        return verification.response;
      }

      /*
       * ==========================================
       * LOGIN VERIFY
       * ==========================================
       */

      if (flow === "login") {
        const { data: user, error } =
          await supabaseAdmin
            .from("users")
            .select(
              "id, phone, status, phone_verified"
            )
            .eq("phone", phone)
            .maybeSingle();

        if (error) {
          console.error(
            "Login user lookup error:",
            error
          );

          return NextResponse.json(
            {
              success: false,
              message: "Unable to login",
            },
            { status: 500 }
          );
        }

        if (!user) {
          return NextResponse.json(
            {
              success: false,
              code: "USER_NOT_FOUND",
              message:
                "Account not found. Please signup.",
              redirect: `/signup?phone=${encodeURIComponent(
                phone
              )}`,
            },
            { status: 404 }
          );
        }

        if (user.status === "blocked") {
          return NextResponse.json(
            {
              success: false,
              code: "ACCOUNT_BLOCKED",
              message: "Your account is blocked.",
            },
            { status: 403 }
          );
        }

        if (!user.phone_verified) {
          const { error: updateError } =
            await supabaseAdmin
              .from("users")
              .update({
                phone_verified: true,
                updated_at: new Date().toISOString(),
              })
              .eq("id", user.id);

          if (updateError) {
            console.error(
              "Phone verification update error:",
              updateError
            );

            return NextResponse.json(
              {
                success: false,
                message:
                  "Unable to update account.",
              },
              { status: 500 }
            );
          }
        }

        await createSession(user.id);

        return NextResponse.json({
          success: true,
          code: "LOGIN_SUCCESS",
          message: "Login successful",
          redirect: "/",
        });
      }

      /*
       * ==========================================
       * SIGNUP VERIFY
       * ==========================================
       */

      if (flow === "signup") {
        const {
          data: pendingSignup,
          error,
        } = await supabaseAdmin
          .from("pending_signups")
          .select("*")
          .eq("phone", phone)
          .maybeSingle();

        if (error) {
          console.error(
            "Pending signup lookup error:",
            error
          );

          return NextResponse.json(
            {
              success: false,
              message:
                "Unable to complete signup",
            },
            { status: 500 }
          );
        }

        if (!pendingSignup) {
          return NextResponse.json(
            {
              success: false,
              code: "SIGNUP_NOT_FOUND",
              message:
                "Signup request expired. Please signup again.",
            },
            { status: 400 }
          );
        }

        if (
          new Date(pendingSignup.expires_at) <
          new Date()
        ) {
          await supabaseAdmin
            .from("pending_signups")
            .delete()
            .eq("phone", phone);

          return NextResponse.json(
            {
              success: false,
              code: "SIGNUP_EXPIRED",
              message:
                "Signup request expired. Please signup again.",
            },
            { status: 400 }
          );
        }

        // Check if account already exists
        const {
          data: existingUser,
        } = await supabaseAdmin
          .from("users")
          .select("id, status")
          .eq("phone", phone)
          .maybeSingle();

        if (existingUser) {
          await supabaseAdmin
            .from("pending_signups")
            .delete()
            .eq("phone", phone);

          if (
            existingUser.status === "blocked"
          ) {
            return NextResponse.json(
              {
                success: false,
                code: "ACCOUNT_BLOCKED",
                message: "Your account is blocked.",
              },
              { status: 403 }
            );
          }

          await createSession(existingUser.id);

          return NextResponse.json({
            success: true,
            code: "LOGIN_SUCCESS",
            message: "Login successful",
            redirect: "/",
          });
        }

        // Check email uniqueness
        const {
          data: emailUser,
        } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("email", pendingSignup.email)
          .maybeSingle();

        if (emailUser) {
          return NextResponse.json(
            {
              success: false,
              code: "EMAIL_EXISTS",
              message:
                "This email is already registered.",
            },
            { status: 409 }
          );
        }

        // Generate unique referral code
        let ownReferralCode = "";

        for (let i = 0; i < 5; i++) {
          const candidate =
            generateReferralCode();

          const {
            data: existingCode,
          } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq(
              "referral_code",
              candidate
            )
            .maybeSingle();

          if (!existingCode) {
            ownReferralCode = candidate;
            break;
          }
        }

        if (!ownReferralCode) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Unable to create account. Please try again.",
            },
            { status: 500 }
          );
        }

        /*
         * Create actual user.
         */

        const nowIso = new Date().toISOString();

        const {
          data: newUser,
          error: createError,
        } = await supabaseAdmin
          .from("users")
          .insert({
            id: crypto.randomUUID(),
            email: pendingSignup.email,
            full_name: pendingSignup.full_name,
            phone,
            phone_verified: true,
            status: "active",
            role: "user",
            wallet_balance: 0,
            referral_code: ownReferralCode,
            referred_by:
              pendingSignup.referral_code || null,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select("id")
          .single();

        if (createError || !newUser) {
          console.error(
            "User creation error:",
            createError
          );

          return NextResponse.json(
            {
              success: false,
              message:
                "Unable to create account",
            },
            { status: 500 }
          );
        }

        // Delete pending signup
        await supabaseAdmin
          .from("pending_signups")
          .delete()
          .eq("phone", phone);

        // Create proper login session
        await createSession(newUser.id);

        return NextResponse.json({
          success: true,
          code: "SIGNUP_SUCCESS",
          message:
            "Account created successfully",
          redirect: "/",
        });
      }
    }

    /*
     * ==========================================
     * SEND OTP
     * ==========================================
     */

    if (action !== "send") {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_ACTION",
          message: "Invalid OTP action",
        },
        { status: 400 }
      );
    }

    /*
     * ==========================================
     * LOGIN SEND
     * ==========================================
     */

    if (flow === "login") {
      const {
        data: user,
        error,
      } = await supabaseAdmin
        .from("users")
        .select("id, phone, status")
        .eq("phone", phone)
        .maybeSingle();

      if (error) {
        console.error(
          "User lookup error:",
          error
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "Unable to check account",
          },
          { status: 500 }
        );
      }

      /*
       * Unknown number:
       * DO NOT send login OTP.
       */

      if (!user) {
        return NextResponse.json(
          {
            success: false,
            code: "USER_NOT_FOUND",
            message:
              "Account not found. Please signup.",
            redirect: `/signup?phone=${encodeURIComponent(
              phone
            )}`,
          },
          { status: 404 }
        );
      }

      /*
       * Blocked user:
       * DO NOT send OTP.
       */

      if (user.status === "blocked") {
        return NextResponse.json(
          {
            success: false,
            code: "ACCOUNT_BLOCKED",
            message:
              "Your account is blocked. OTP cannot be sent.",
          },
          { status: 403 }
        );
      }
    }

    /*
     * ==========================================
     * SIGNUP SEND
     * ==========================================
     */

    if (flow === "signup") {
      const {
        data: existingUser,
      } = await supabaseAdmin
        .from("users")
        .select("id, phone, status")
        .eq("phone", phone)
        .maybeSingle();

      if (existingUser) {
        if (
          existingUser.status === "blocked"
        ) {
          return NextResponse.json(
            {
              success: false,
              code: "ACCOUNT_BLOCKED",
              message:
                "Your account is blocked. OTP cannot be sent.",
            },
            { status: 403 }
          );
        }

        return NextResponse.json(
          {
            success: false,
            code: "USER_EXISTS",
            message:
              "Account already exists. Please login.",
            redirect: `/login?phone=${encodeURIComponent(
              phone
            )}`,
          },
          { status: 409 }
        );
      }

      const fullName = String(
        body.fullName || ""
      ).trim();

      const email = String(
        body.email || ""
      )
        .trim()
        .toLowerCase();

      const referralCode =
        String(
          body.referralCode || ""
        )
          .trim()
          .toUpperCase() || null;

      // Name validation
      if (!fullName) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_NAME",
            message:
              "Please enter your name.",
          },
          { status: 400 }
        );
      }

      if (fullName.length > 15) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_NAME",
            message:
              "Name must be maximum 15 characters.",
          },
          { status: 400 }
        );
      }

      if (
        !/^[a-zA-Z0-9 ]+$/.test(fullName)
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_NAME",
            message:
              "Name can contain only letters, numbers and spaces.",
          },
          { status: 400 }
        );
      }

      // Email validation
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            code: "INVALID_EMAIL",
            message:
              "Please enter a valid email address.",
          },
          { status: 400 }
        );
      }

      // Email uniqueness
      const {
        data: emailUser,
      } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (emailUser) {
        return NextResponse.json(
          {
            success: false,
            code: "EMAIL_EXISTS",
            message:
              "This email is already registered.",
          },
          { status: 409 }
        );
      }

      /*
       * Save/update pending signup.
       */

      const {
        error: pendingError,
      } = await supabaseAdmin
        .from("pending_signups")
        .upsert(
          {
            phone,
            full_name: fullName,
            email,
            referral_code: referralCode,
            expires_at: new Date(
              Date.now() + 15 * 60 * 1000
            ).toISOString(),
          },
          {
            onConflict: "phone",
          }
        );

      if (pendingError) {
        console.error(
          "Pending signup error:",
          pendingError
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "Unable to save signup details.",
          },
          { status: 500 }
        );
      }
    }

    /*
     * ==========================================
     * CENTRAL OTP COOLDOWN
     * ==========================================
     */

    let {
      data: existingOtp,
      error: existingOtpError,
    } = await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("phone", phone)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (existingOtpError) {
      console.error(
        "Existing OTP lookup error:",
        existingOtpError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to process OTP request",
        },
        { status: 500 }
      );
    }

    const now = new Date();

    /*
     * ==========================================
     * 24-HOUR LIMIT
     * ==========================================
     */

    if (
      existingOtp &&
      existingOtp.resend_count >= 5
    ) {
      const lastSent = new Date(
        existingOtp.last_sent_at
      );

      const elapsed =
        (now.getTime() -
          lastSent.getTime()) /
        1000;

      if (elapsed < 86400) {
        const remaining = Math.ceil(
          86400 - elapsed
        );

        return NextResponse.json(
          {
            success: false,
            code: "OTP_COOLDOWN",
            message:
              "OTP limit reached. Please try again after 24 hours.",
            retryAfterSeconds: remaining,
          },
          { status: 429 }
        );
      }

      /*
       * New 24-hour cycle.
       */

      await supabaseAdmin
        .from("otp_verifications")
        .delete()
        .eq("id", existingOtp.id);

      existingOtp = null;
    }

    /*
     * ==========================================
     * RESEND COOLDOWN
     * ==========================================
     */

    if (existingOtp) {
      const resendCount =
        existingOtp.resend_count || 0;

      const cooldown =
        COOLDOWNS[resendCount];

      if (cooldown) {
        const lastSent = new Date(
          existingOtp.last_sent_at
        );

        const elapsed =
          (now.getTime() -
            lastSent.getTime()) /
          1000;

        if (elapsed < cooldown) {
          const remaining = Math.ceil(
            cooldown - elapsed
          );

          return NextResponse.json(
            {
              success: false,
              code: "OTP_COOLDOWN",
              message:
                "Please wait before requesting another OTP.",
              retryAfterSeconds:
                remaining,
            },
            { status: 429 }
          );
        }
      }
    }

    /*
     * ==========================================
     * GENERATE NEW OTP
     * ==========================================
     *
     * New OTP automatically invalidates
     * the previous OTP.
     */

    const otp = generateOTP();
    const otpHash = hashValue(otp);

    const expiresAt = new Date(
      now.getTime() +
        OTP_EXPIRY_MINUTES * 60 * 1000
    );

    await supabaseAdmin
      .from("otp_verifications")
      .delete()
      .eq("phone", phone);

    const newResendCount = existingOtp
      ? Math.min(
          (existingOtp.resend_count || 0) + 1,
          5
        )
      : 0;

    const {
      error: insertError,
    } = await supabaseAdmin
      .from("otp_verifications")
      .insert({
        phone,
        otp_hash: otpHash,
        expires_at:
          expiresAt.toISOString(),
        attempts: 0,
        resend_count:
          newResendCount,
        last_sent_at:
          now.toISOString(),
        verified_at: null,
      });

    if (insertError) {
      console.error(
        "OTP insert error:",
        insertError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to create OTP",
        },
        { status: 500 }
      );
    }

    /*
     * ==========================================
     * SEND SMS
     * ==========================================
     */

    try {
      await sendSMS(phone, otp);
    } catch (smsError) {
      console.error(
        "SMS error:",
        smsError
      );

      // Remove OTP if SMS failed
      await supabaseAdmin
        .from("otp_verifications")
        .delete()
        .eq("phone", phone);

      /*
       * Signup pending data remains saved.
       * User can retry OTP.
       */

      return NextResponse.json(
        {
          success: false,
          code: "SMS_FAILED",
          message:
            "Unable to send OTP. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      code: existingOtp
        ? "OTP_RESENT"
        : "OTP_SENT",
      message: existingOtp
        ? "OTP resent successfully"
        : "OTP sent successfully",
      expiresInSeconds:
        OTP_EXPIRY_MINUTES * 60,
      resendCount:
        newResendCount,
    });
  } catch (error) {
    console.error(
      "OTP Route Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Failed to process OTP request",
      },
      { status: 500 }
    );
  }
}