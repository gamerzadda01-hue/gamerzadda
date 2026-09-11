"use client";

import { useEffect, useRef } from "react";

const CHECK_INTERVAL = 5000;

export default function SessionWatcher() {
  const checkingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      if (!mounted || checkingRef.current) return;

      checkingRef.current = true;

      try {
        const response = await fetch("/api/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
          },
        });

        if (response.status === 401) {
          try {
            localStorage.removeItem("gamerzadda_device_id");
          } catch {}

          if (window.location.pathname !== "/login") {
            window.location.replace("/login");
          }
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        checkingRef.current = false;
      }
    }

    checkSession();

    const timer = window.setInterval(
      checkSession,
      CHECK_INTERVAL
    );

    const handleFocus = () => {
      checkSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkSession();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      mounted = false;

      window.clearInterval(timer);

      window.removeEventListener("focus", handleFocus);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  return null;
}