"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");

  const [otp, setOtp] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /*
   * Fill phone automatically when coming
   * from Login with ?phone=XXXXXXXXXX
   */
  useEffect(() => {
    const queryPhone =
      searchParams.get("phone");

    if (queryPhone) {
      setPhone(
        queryPhone
          .replace(/\D/g, "")
          .slice(0, 10)
      );
    }
  }, [searchParams]);

  /*
   * Resend countdown
   */
  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendSeconds((value) =>
        value > 0 ? value - 1 : 0
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  function formatTime(seconds: number) {
    const minutes = Math.floor(
      seconds / 60
    );

    const remaining = seconds % 60;

    return `${minutes}:${remaining
      .toString()
      .padStart(2, "0")}`;
  }

  function updateOtp(
    index: number,
    value: string
  ) {
    const digit = value
      .replace(/\D/g, "")
      .slice(-1);

    const updated = [...otp];

    updated[index] = digit;

    setOtp(updated);

    if (digit && index < 5) {
      document
        .getElementById(
          `signup-otp-${index + 1}`
        )
        ?.focus();
    }
  }

  function handleOtpKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (
      e.key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      document
        .getElementById(
          `signup-otp-${index - 1}`
        )
        ?.focus();
    }
  }

  async function sendSignupOtp() {
    setError("");
    setSuccess("");

    const cleanName =
      name.trim();

    const cleanEmail =
      email.trim().toLowerCase();

    const cleanPhone =
      phone
        .replace(/\D/g, "")
        .slice(0, 10);

    const cleanReferral =
      referralCode
        .trim()
        .toUpperCase();

    /*
     * Validate name
     */

    if (!cleanName) {
      setError(
        "Please enter your name."
      );
      return;
    }

    if (cleanName.length > 15) {
      setError(
        "Name must be maximum 15 characters."
      );
      return;
    }

    if (
      !/^[a-zA-Z0-9 ]+$/.test(
        cleanName
      )
    ) {
      setError(
        "Name can contain only letters, numbers and spaces."
      );
      return;
    }

    /*
     * Validate email
     */

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {
      setError(
        "Please enter a valid email address."
      );
      return;
    }

    /*
     * Validate phone
     */

    if (
      !/^[6-9]\d{9}$/.test(
        cleanPhone
      )
    ) {
      setError(
        "Please enter a valid 10-digit mobile number."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/otp",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            phone: cleanPhone,
            action: "send",
            flow: "signup",
            fullName: cleanName,
            email: cleanEmail,
            referralCode:
              cleanReferral || null,
          }),
        }
      );

      const data =
        await response.json();

      /*
       * Account already exists
       */

      if (
        data.code ===
        "USER_EXISTS"
      ) {
        router.push(
          data.redirect ||
            "/login"
        );

        return;
      }

      /*
       * Blocked
       */

      if (
        data.code ===
        "ACCOUNT_BLOCKED"
      ) {
        setError(
          "Your account is blocked. OTP cannot be sent."
        );
        return;
      }

      /*
       * Email already registered
       */

      if (
        data.code ===
        "EMAIL_EXISTS"
      ) {
        setError(
          "This email is already registered."
        );
        return;
      }

      /*
       * Cooldown
       */

      if (
        data.code ===
        "OTP_COOLDOWN"
      ) {
        setResendSeconds(
          data.retryAfterSeconds ||
            60
        );

        setError(
          data.message ||
            "Please wait before requesting another OTP."
        );

        return;
      }

      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.message ||
            "Unable to send OTP."
        );
        return;
      }

      /*
       * OTP successfully sent
       */

      setOtpSent(true);

      setOtp([
        "",
        "",
        "",
        "",
        "",
        "",
      ]);

      /*
       * Initial OTP does not have
       * a resend cooldown.
       */
      setResendSeconds(0);

      setSuccess(
        "OTP sent successfully."
      );
    } catch (error) {
      console.error(error);

      setError(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifySignupOtp() {
    setError("");
    setSuccess("");

    const cleanPhone =
      phone
        .replace(/\D/g, "")
        .slice(0, 10);

    const enteredOtp =
      otp.join("");

    if (
      !/^[6-9]\d{9}$/.test(
        cleanPhone
      )
    ) {
      setError(
        "Invalid mobile number."
      );
      return;
    }

    if (
      !/^\d{6}$/.test(
        enteredOtp
      )
    ) {
      setError(
        "Please enter the complete 6-digit OTP."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/auth/otp",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            phone: cleanPhone,
            otp: enteredOtp,
            action: "verify",
            flow: "signup",
          }),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        setError(
          data.message ||
            "Invalid OTP."
        );
        return;
      }

      /*
       * Server has:
       * 1. Created users account
       * 2. Created session
       * 3. Set HttpOnly cookie
       */

      setSuccess(
        "Account created successfully. Redirecting..."
      );

      router.replace(
        data.redirect || "/"
      );
    } catch (error) {
      console.error(error);

      setError(
        "Unable to verify OTP. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (
      resendSeconds > 0 ||
      loading
    ) {
      return;
    }

    await sendSignupOtp();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #241010 0%, #0b0b0f 45%, #050507 100%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
        color: "white",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#111116",
          border:
            "1px solid #29292f",
          borderRadius: "22px",
          padding: "30px",
          boxShadow:
            "0 20px 60px rgba(0,0,0,.5)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              fontSize: "36px",
              marginBottom: "8px",
            }}
          >
            🎮
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 900,
              letterSpacing: "1px",
            }}
          >
            GAMERZADDA
          </h1>

          <p
            style={{
              color: "#999",
              marginTop: "8px",
              fontSize: "14px",
            }}
          >
            Create your gaming account
          </p>
        </div>

        {!otpSent ? (
          <>
            <label style={labelStyle}>
              Full Name
            </label>

            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              maxLength={15}
              onChange={(e) => {
                const value =
                  e.target.value
                    .replace(
                      /[^a-zA-Z0-9 ]/g,
                      ""
                    )
                    .slice(0, 15);

                setName(value);
              }}
              style={inputStyle}
            />

            <label
              style={{
                ...labelStyle,
                marginTop: "18px",
              }}
            >
              Email Address
            </label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              style={inputStyle}
            />

            <label
              style={{
                ...labelStyle,
                marginTop: "18px",
              }}
            >
              Mobile Number
            </label>

            <div
              style={{
                display: "flex",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "65px",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  background: "#19191f",
                  border:
                    "1px solid #303038",
                  borderRadius: "12px",
                  color: "#ddd",
                  fontWeight: 700,
                }}
              >
                +91
              </div>

              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="9876543210"
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10)
                  )
                }
                style={{
                  ...inputStyle,
                  flex: 1,
                }}
              />
            </div>

            <label
              style={{
                ...labelStyle,
                marginTop: "18px",
              }}
            >
              Referral Code{" "}
              <span
                style={{
                  color: "#777",
                  fontWeight: 400,
                }}
              >
                (Optional)
              </span>
            </label>

            <input
              type="text"
              placeholder="Enter referral code"
              value={referralCode}
              onChange={(e) =>
                setReferralCode(
                  e.target.value
                    .replace(
                      /[^a-zA-Z0-9]/g,
                      ""
                    )
                    .toUpperCase()
                )
              }
              style={inputStyle}
            />

            {error && (
              <ErrorBox text={error} />
            )}

            {success && (
              <SuccessBox
                text={success}
              />
            )}

            <button
              type="button"
              onClick={
                sendSignupOtp
              }
              disabled={loading}
              style={{
                ...buttonStyle,
                marginTop: "24px",
                background: loading
                  ? "#555"
                  : "#e53935",
              }}
            >
              {loading
                ? "SENDING OTP..."
                : "CONTINUE →"}
            </button>

            <div
              style={{
                textAlign: "center",
                marginTop: "22px",
                color: "#888",
                fontSize: "13px",
              }}
            >
              Already have an account?{" "}
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/login"
                  )
                }
                style={
                  linkButtonStyle
                }
              >
                Login
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                textAlign: "center",
                marginBottom: "22px",
              }}
            >
              <div
                style={{
                  color: "#aaa",
                  fontSize: "14px",
                }}
              >
                OTP sent to
              </div>

              <div
                style={{
                  fontWeight: 800,
                  marginTop: "5px",
                }}
              >
                +91 {phone}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent:
                  "center",
              }}
            >
              {otp.map(
                (digit, index) => (
                  <input
                    key={index}
                    id={`signup-otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) =>
                      updateOtp(
                        index,
                        e.target.value
                      )
                    }
                    onKeyDown={(e) =>
                      handleOtpKeyDown(
                        index,
                        e
                      )
                    }
                    style={
                      otpInputStyle
                    }
                  />
                )
              )}
            </div>

            {error && (
              <ErrorBox text={error} />
            )}

            {success && (
              <SuccessBox
                text={success}
              />
            )}

            <button
              type="button"
              onClick={
                verifySignupOtp
              }
              disabled={loading}
              style={{
                ...buttonStyle,
                marginTop: "22px",
                background: loading
                  ? "#555"
                  : "#e53935",
              }}
            >
              {loading
                ? "CREATING ACCOUNT..."
                : "VERIFY & SIGN UP"}
            </button>

            <div
              style={{
                textAlign: "center",
                marginTop: "18px",
                fontSize: "13px",
              }}
            >
              {resendSeconds > 0 ? (
                <span
                  style={{
                    color: "#888",
                  }}
                >
                  Resend OTP in{" "}
                  <b
                    style={{
                      color: "#fff",
                    }}
                  >
                    {formatTime(
                      resendSeconds
                    )}
                  </b>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={loading}
                  style={
                    linkButtonStyle
                  }
                >
                  Resend OTP
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setOtp([
                  "",
                  "",
                  "",
                  "",
                  "",
                  "",
                ]);
                setError("");
                setSuccess("");
              }}
              style={{
                width: "100%",
                marginTop: "16px",
                border: "none",
                background:
                  "transparent",
                color: "#777",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              ← Edit Details
            </button>
          </>
        )}
      </div>
    </main>
  );
}

function ErrorBox({
  text,
}: {
  text: string;
}) {
  return (
    <div
      style={{
        marginTop: "16px",
        padding: "12px",
        borderRadius: "10px",
        background: "#2a1010",
        border: "1px solid #5b2020",
        color: "#ff7777",
        fontSize: "13px",
      }}
    >
      {text}
    </div>
  );
}

function SuccessBox({
  text,
}: {
  text: string;
}) {
  return (
    <div
      style={{
        marginTop: "16px",
        padding: "12px",
        borderRadius: "10px",
        background: "#102a18",
        border: "1px solid #205b32",
        color: "#72e69a",
        fontSize: "13px",
      }}
    >
      {text}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 700,
  marginBottom: "8px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px",
  background: "#19191f",
  border: "1px solid #303038",
  borderRadius: "12px",
  color: "white",
  outline: "none",
  fontSize: "14px",
};

const otpInputStyle: React.CSSProperties = {
  width: "48px",
  height: "55px",
  boxSizing: "border-box",
  textAlign: "center",
  background: "#19191f",
  border: "1px solid #303038",
  borderRadius: "12px",
  color: "white",
  outline: "none",
  fontSize: "22px",
  fontWeight: 800,
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "15px",
  border: "none",
  borderRadius: "12px",
  color: "white",
  fontSize: "15px",
  fontWeight: 900,
  cursor: "pointer",
};

const linkButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#ff5252",
  fontWeight: 800,
  cursor: "pointer",
};

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#050507",
            color: "white",
            fontSize: "16px",
          }}
        >
          Loading...
        </main>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}
