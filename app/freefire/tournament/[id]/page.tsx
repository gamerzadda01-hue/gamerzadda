"use client";

import { useRouter } from "next/navigation";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const BANNER_URL = "/banner.png";

export default function TournamentPage() {
  const router = useRouter();
  const [popup, setPopup] = useState<"how" | "rules" | "join" | null>(null);
  const [gameName, setGameName] = useState("");
  const [uid, setUid] = useState("");
  const [level, setLevel] = useState("");
  const [walletOpen, setWalletOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [insufficientBalanceOpen, setInsufficientBalanceOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  const [slideValue, setSlideValue] = useState(0);
  const [joining, setJoining] = useState(false);
  const [duoAction, setDuoAction] = useState<"create" | "join">("create");
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [duoLoading, setDuoLoading] = useState(false);
  const [createdTeamCode, setCreatedTeamCode] = useState("");
  const [showJoinedTeamCode, setShowJoinedTeamCode] = useState(false);
  const [teamCodeCopied, setTeamCodeCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelModal, setCancelModal] = useState<"notice" | "success" | "error" | null>(null);
  const [cancelModalMessage, setCancelModalMessage] = useState("");
  const [pendingCancelEntryId, setPendingCancelEntryId] = useState<string | null>(null);

  useEffect(() => {
    if (cancelModal !== "success") return;
    const timer = window.setTimeout(() => setCancelModal(null), 3000);
    return () => window.clearTimeout(timer);
  }, [cancelModal]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [cancelTick, setCancelTick] = useState(Date.now());
  const sliderRef = useRef<HTMLDivElement>(null);

  type TournamentData = {
    id: string;
    title: string;
    game: string | null;
    mode: string | null;
    entry_fee: number | string | null;
    prize_pool: number | string | null;
    kill_reward: number | string | null;
    max_players: number | null;
    start_time: string | null;
    map: string | null;
    rules: string[] | null;
    status: string | null;
    bonus_usable_percent: number | string | null;
  };

  type PrizeData = {
    id: string;
    rank: number;
    label: string;
    amount: number | string;
  };

  type ParticipantData = {
    id: string;
    user_id: string;
    free_fire_uid: string | null;
    game_name: string | null;
    cancelled: boolean | null;
    users: {
      full_name: string | null;
      level: number | null;
      bio: string | null;
      avatar_url: string | null;
    } | null;
  };

  type WalletData = {
    deposit_balance: number | null;
    bonus_balance: number | null;
    winning_balance: number | null;
  };

  const [tournament, setTournament] = useState<TournamentData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [prizes, setPrizes] = useState<PrizeData[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [joinedPlayers, setJoinedPlayers] = useState(0);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantsError, setParticipantsError] = useState("");

  const depositBalance = Number(wallet?.deposit_balance ?? 0);
  const bonusBalance = Number(wallet?.bonus_balance ?? 0);
  const winningBalance = Number(wallet?.winning_balance ?? 0);
  const totalWalletBalance = Math.max(
    0,
    depositBalance + bonusBalance + winningBalance
  );
  const entryFee = Number(tournament?.entry_fee ?? 0);

  // Duo UI must render ONLY for tournaments whose mode is exactly "Duo".
  // Solo keeps the original Join Tournament UI.
  const isDuoTournament =
    String(tournament?.mode ?? "").trim().toLowerCase() === "duo";

  const getDuoTeamStorageKey = (tournamentId: string) =>
    `gamerzadda:duo-team-code:${String(tournamentId).trim()}`;

  const saveDuoTeamCodeLocally = (tournamentId: string, code: string) => {
    const cleanCode = String(code || "").trim();
    if (!tournamentId || !/^\d{6}$/.test(cleanCode)) return;
    try {
      window.localStorage.setItem(getDuoTeamStorageKey(tournamentId), cleanCode);
    } catch (error) {
      console.warn("Unable to save Duo team code locally:", error);
    }
  };

  const getDuoTeamCodeLocally = (tournamentId: string) => {
    if (!tournamentId) return "";
    try {
      const code = String(
        window.localStorage.getItem(getDuoTeamStorageKey(tournamentId)) || ""
      ).trim();
      return /^\d{6}$/.test(code) ? code : "";
    } catch {
      return "";
    }
  };

  const removeDuoTeamCodeLocally = (tournamentId: string) => {
    if (!tournamentId) return;
    try {
      window.localStorage.removeItem(getDuoTeamStorageKey(tournamentId));
    } catch {
      // Ignore storage errors.
    }
  };

  const copyDuoTeamCode = async () => {
    if (!createdTeamCode) return;
    try {
      await navigator.clipboard.writeText(createdTeamCode);
      setTeamCodeCopied(true);
      window.setTimeout(() => setTeamCodeCopied(false), 1800);
    } catch {
      setJoinError("Unable to copy team code. Please copy it manually.");
    }
  };

  const shareDuoTeamOnWhatsApp = () => {
    if (!createdTeamCode) return;

    const tournamentTitle = String(tournament?.title || "GAMERZADDA Duo Tournament");
    const message = [
      "🎮 GAMERZADDA DUO TEAM INVITE",
      "",
      `🏆 Tournament: ${tournamentTitle}`,
      `🔢 Team Code: ${createdTeamCode}`,
      "",
      "HOW TO JOIN:",
      "1. Open GAMERZADDA",
      "2. Open the same Duo tournament",
      "3. Tap JOIN NOW",
      "4. Select JOIN",
      "5. Enter the 6-digit Team Code",
      "6. Enter your IGN, UID and Level",
      "7. Join the team — no entry fee is charged",
      "",
      "🔥 Join my team and let's win!",
    ].join("\n");

    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const bonusUsablePercent = Math.min(
    100,
    Math.max(0, Number(tournament?.bonus_usable_percent ?? 0))
  );

  const bonusUsable = Math.max(
    0,
    bonusBalance * (bonusUsablePercent / 100)
  );

  const tournamentUsableBalance =
    depositBalance + winningBalance + bonusUsable;

  const bonusCut = Math.min(bonusUsable, entryFee);
  const remainingAfterBonus = Math.max(0, entryFee - bonusCut);

  const depositCut = Math.min(depositBalance, remainingAfterBonus);
  const remainingAfterDeposit = Math.max(
    0,
    remainingAfterBonus - depositCut
  );

  const winningCut = Math.min(winningBalance, remainingAfterDeposit);

  const totalDeduction = bonusCut + depositCut + winningCut;

  const balanceAfterJoin = Math.max(
    0,
    totalWalletBalance - totalDeduction
  );

  const loadCurrentUserForCancel = async () => {
    if (!tournament?.id) return;

    try {
      const response = await fetch(
        `/api/tournaments/my-entry?tournamentId=${encodeURIComponent(tournament.id)}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const result = await response.json().catch(() => null);

      if (response.ok && result?.success && result?.userId) {
        setCurrentUserId(String(result.userId).trim());
        setCurrentEntryId(
          result.entryId ? String(result.entryId).trim() : null
        );
      }
    } catch (error) {
      console.error("Current user for cancel:", error);
    }
  };

  async function loadParticipants() {
    if (!tournament) return;

    setParticipantsLoading(true);
    setParticipantsError("");

    try {
      const { data, error } = await supabase
        .from("tournament_entries")
        .select(`
          id,
          user_id,
          free_fire_uid,
          game_name,
          cancelled,
          users (
            full_name,
            level,
            bio,
            avatar_url
          )
        `)
        .eq("tournament_id", tournament.id)
        .eq("cancelled", false)
        .order("id", { ascending: true });

      if (error) throw error;

      // Supabase returns the related users row as an array here.
      // Normalize it to the single-user shape used by the UI.
      const normalizedParticipants: ParticipantData[] = (data || []).map((item) => {
        const relatedUser = Array.isArray(item.users)
          ? item.users[0] ?? null
          : item.users ?? null;

        return {
          id: item.id,
          user_id: item.user_id,
          free_fire_uid: item.free_fire_uid ?? null,
          game_name: item.game_name ?? null,
          cancelled: Boolean(item.cancelled),
          users: relatedUser
            ? {
                full_name: relatedUser.full_name ?? null,
                level:
                  relatedUser.level === null || relatedUser.level === undefined
                    ? null
                    : Number(relatedUser.level),
                bio: relatedUser.bio ?? null,
                avatar_url: relatedUser.avatar_url ?? null,
              }
            : null,
        };
      });

      setParticipants(normalizedParticipants);
    } catch (error) {
      console.error("Participants:", error);
      setParticipants([]);
      setParticipantsError(
        error instanceof Error ? error.message : "Unable to load participants."
      );
    } finally {
      setParticipantsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadSavedPlayerDetails() {
      try {
        const response = await fetch("/api/profile/player-details", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const result = await response.json().catch(() => null);

        if (!active || !response.ok || !result?.success) return;

        setGameName(String(result.gameName || "").toUpperCase().slice(0, 20));
        setUid(String(result.uid || "").replace(/\\D/g, "").slice(0, 15));

        const savedLevel = Number(result.level);
        setLevel(
          Number.isInteger(savedLevel) && savedLevel >= 1 && savedLevel <= 100
            ? String(savedLevel)
            : ""
        );
      } catch (error) {
        console.error("Saved player details:", error);
      }
    }

    loadSavedPlayerDetails();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    async function loadTournament() {
      const id = window.location.pathname.split("/").filter(Boolean).pop();

      if (!id) {
        setPageError("Tournament ID is missing.");
        setPageLoading(false);
        return;
      }

      setPageLoading(true);
      setPageError("");

      try {
        const { data, error } = await supabase
          .from("tournaments")
          .select(
            "id,title,game,mode,entry_fee,prize_pool,kill_reward,max_players,start_time,map,rules,status,bonus_usable_percent"
          )
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          setPageError("Tournament not found.");
          setTournament(null);
          return;
        }

        setTournament(data as TournamentData);

        const { count: entryCount, error: entriesError } = await supabase
          .from("tournament_entries")
          .select("id", { count: "exact", head: true })
          .eq("tournament_id", id)
          .eq("cancelled", false);

        if (entriesError) {
          console.error("Tournament entries:", entriesError);
          setJoinedPlayers(0);
        } else {
          setJoinedPlayers(entryCount ?? 0);
        }

        const { data: prizeData, error: prizeError } = await supabase
          .from("tournament_prizes")
          .select("id,rank,label,amount")
          .eq("tournament_id", id)
          .order("rank", { ascending: true });

        if (prizeError) {
          console.error("Tournament prizes:", prizeError);
          setPrizes([]);
        } else {
          setPrizes((prizeData || []) as PrizeData[]);
        }
      } catch (error) {
        console.error("Tournament detail:", error);
        setPageError(
          error instanceof Error ? error.message : "Unable to load tournament."
        );
        setTournament(null);
      } finally {
        setPageLoading(false);
      }
    }

    loadTournament();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWallet() {
      setWalletLoading(true);

      try {
        const response = await fetch("/api/wallet", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const walletData = await response.json();

        if (!response.ok) {
          throw new Error(walletData?.error || "Failed to load wallet.");
        }

        if (!cancelled) {
          setWallet({
            deposit_balance: Number(walletData?.wallet?.deposit ?? 0),
            bonus_balance: Number(walletData?.wallet?.bonus ?? 0),
            winning_balance: Number(walletData?.wallet?.winning ?? 0),
          });
        }
      } catch (error) {
        console.error("Wallet:", error);
        setWallet(null);
      } finally {
        if (!cancelled) setWalletLoading(false);
      }
    }

    loadWallet();

    return () => {
      cancelled = true;
    };
  }, []);

  const openJoinPopup = async () => {
    setPopup("join");
    setWalletOpen(false);
    setJoinError("");
    setSlideValue(0);
    setDuoAction("create");
    setTeamName("");
    setTeamCode("");
    setTeamCodeCopied(false);

    // Refresh the latest account-wise player details before showing the form.
    try {
      const profileResponse = await fetch("/api/profile/player-details", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const profileResult = await profileResponse.json().catch(() => null);

      if (profileResponse.ok && profileResult?.success) {
        setGameName(String(profileResult.gameName || "").toUpperCase().slice(0, 20));
        setUid(String(profileResult.uid || "").replace(/\\D/g, "").slice(0, 15));

        const savedLevel = Number(profileResult.level);
        setLevel(
          Number.isInteger(savedLevel) && savedLevel >= 1 && savedLevel <= 100
            ? String(savedLevel)
            : ""
        );
      }
    } catch (error) {
      console.error("Refresh saved player details:", error);
    }

    // Always verify the current active entry from the server.
    if (!tournament?.id) {
      setJoined(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/tournaments/my-entry?tournamentId=${encodeURIComponent(
          tournament.id
        )}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const result = await response.json().catch(() => null);

      if (response.ok && result?.success && result?.joined) {
        setJoined(true);
        setCurrentUserId(
          result.userId ? String(result.userId).trim() : null
        );
        setCurrentEntryId(
          result.entryId ? String(result.entryId).trim() : null
        );
      } else {
        setJoined(false);
        setCurrentEntryId(null);
      }
    } catch (error) {
      console.error("Join popup entry check:", error);
      // Do not incorrectly show Already Joined if the check fails.
      setJoined(false);
      setCurrentEntryId(null);
    }
  };

  const closePopup = () => {
    setPopup(null);
    setWalletOpen(false);
    setJoinError("");
  };

  const handleGameNameChange = (value: string) => {
    setGameName(
      value
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .toUpperCase()
        .slice(0, 20)
    );
    setJoinError("");
  };

  const handleUidChange = (value: string) => {
    setUid(value.replace(/\D/g, "").slice(0, 15));
    setJoinError("");
  };

  const handleLevelChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 3);
    if (!digits) {
      setLevel("");
    } else {
      setLevel(String(Math.min(100, Math.max(1, Number(digits)))));
    }
    setJoinError("");
  };

  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMyEntry() {
      if (!tournament?.id) {
        setCurrentUserId(null);
        setCurrentEntryId(null);
        return;
      }

      try {
        const response = await fetch(
          `/api/tournaments/my-entry?tournamentId=${encodeURIComponent(tournament.id)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        const result = await response.json().catch(() => null);
        if (!active) return;

        if (response.ok && result?.success && result?.joined) {
          setCurrentUserId(result.userId ? String(result.userId).trim() : null);
          setCurrentEntryId(result.entryId ? String(result.entryId).trim() : null);
        } else {
          setCurrentUserId(null);
          setCurrentEntryId(null);
        }
      } catch (error) {
        console.error("My tournament entry:", error);
        if (active) {
          setCurrentUserId(null);
          setCurrentEntryId(null);
        }
      }
    }

    loadMyEntry();

    return () => {
      active = false;
    };
  }, [tournament?.id]);

  // Recover the creator's active Duo team code from the database every time
  // the tournament page loads. This makes the code persistent even if the
  // user closed the popup or did not copy it when the team was created.
  useEffect(() => {
    let active = true;

    async function loadMyDuoTeam() {
      if (!tournament?.id || !isDuoTournament) return;

      // Give the tournament state a moment to settle, then check the server.
      // The server is the source of truth, so the popup also works after a
      // refresh, browser restart, logout/login, or reopening the same page.
      const tournamentId = String(tournament.id).trim();
      if (!tournamentId) return;

      // Restore immediately from browser storage so the Team Code is still
      // visible after Next.js back/forward navigation even if the API is slow.
      const locallySavedCode = getDuoTeamCodeLocally(tournamentId);
      if (/^\d{6}$/.test(locallySavedCode)) {
        setCreatedTeamCode(locallySavedCode);
        setShowJoinedTeamCode(true);
        setJoined(true);
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        if (!active) return;

        try {
          const response = await fetch(
            `/api/tournaments/duo/my-team?tournamentId=${encodeURIComponent(tournamentId)}`,
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
              headers: {
                Accept: "application/json",
              },
            }
          );

          const result = await response.json().catch(() => null);
          if (!active) return;

          const recoveredTeamCode = String(
            result?.teamCode ?? result?.team?.team_code ?? ""
          ).trim();

          if (response.ok && result?.success === true && /^\d{6}$/.test(recoveredTeamCode)) {
            // IMPORTANT: creator already has an active Duo team.
            // Open the team-code popup automatically on every page open.
            setCreatedTeamCode(recoveredTeamCode);
            saveDuoTeamCodeLocally(tournamentId, recoveredTeamCode);
            setShowJoinedTeamCode(true);
            setJoined(true);
            setDuoAction("create");
            setPopup("join");
            setJoinError("");
            setWalletOpen(false);
            setTeamCodeCopied(false);
            return;
          }

          // Server confirms there is no active Duo team.
          // Clear stale local state so CANCEL returns to JOIN NOW.
          removeDuoTeamCodeLocally(tournamentId);
          setCreatedTeamCode("");
          setShowJoinedTeamCode(false);
          setJoined(false);
          setCurrentEntryId(null);
          return;
        } catch (error) {
          console.error(`My Duo team check (attempt ${attempt + 1}):`, error);
        }

        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
        }
      }
    }

    loadMyDuoTeam();

    return () => {
      active = false;
    };
  }, [tournament?.id, tournament?.mode, isDuoTournament]);

  // Refresh the creator Team Code whenever this page becomes visible again.
  // This handles browser back/forward navigation and cached pages (bfcache).
  useEffect(() => {
    const refreshMyDuoTeamCode = async () => {
      if (!tournament?.id || !isDuoTournament) return;

      try {
        const tournamentId = String(tournament.id).trim();
        if (!tournamentId) return;

        const locallySavedCode = getDuoTeamCodeLocally(tournamentId);
        if (/^\d{6}$/.test(locallySavedCode)) {
          setCreatedTeamCode(locallySavedCode);
          setShowJoinedTeamCode(true);
          setJoined(true);
        }

        const response = await fetch(
          `/api/tournaments/duo/my-team?tournamentId=${encodeURIComponent(tournamentId)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" },
          }
        );

        const result = await response.json().catch(() => null);
        const recoveredTeamCode = String(
          result?.teamCode ?? result?.team?.team_code ?? ""
        ).trim();

        if (response.ok && result?.success === true && /^\d{6}$/.test(recoveredTeamCode)) {
          setCreatedTeamCode(recoveredTeamCode);
          saveDuoTeamCodeLocally(tournamentId, recoveredTeamCode);
          setShowJoinedTeamCode(true);
          setJoined(true);
        } else if (response.ok && result?.success === true) {
          removeDuoTeamCodeLocally(tournamentId);
          setCreatedTeamCode("");
          setShowJoinedTeamCode(false);
          setJoined(false);
          setCurrentEntryId(null);
        }
      } catch (error) {
        console.error("Refresh Duo Team Code:", error);
      }
    };

    const handlePageShow = () => {
      void refreshMyDuoTeamCode();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshMyDuoTeamCode();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [tournament?.id, isDuoTournament]);

  useEffect(() => {
    const timer = window.setInterval(() => setCancelTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const tournamentStartMs = tournament?.start_time
    ? new Date(tournament.start_time).getTime()
    : NaN;
  const cancelDeadlineMs = Number.isFinite(tournamentStartMs)
    ? tournamentStartMs - 2 * 60 * 60 * 1000
    : NaN;
  const canCancelTournament =
    Number.isFinite(cancelDeadlineMs) &&
    cancelTick < cancelDeadlineMs &&
    !["cancelled", "completed", "live"].includes(
      String(tournament?.status || "").toLowerCase()
    );

  const isOwnParticipant = (participant: ParticipantData) => {
    if (
      currentEntryId &&
      String(currentEntryId).trim() === String(participant.id).trim()
    ) {
      return true;
    }

    if (!currentUserId || participant.user_id === null || participant.user_id === undefined) {
      return false;
    }

    return String(currentUserId).trim() === String(participant.user_id).trim();
  };

  const handleCancelTournament = async (
    entryId: string,
    participantUserId: string
  ) => {
    if (!tournament || cancelling) return;

    if (
      !currentUserId ||
      String(currentUserId).trim() !== String(participantUserId).trim()
    ) {
      setCancelModalMessage("You can cancel only your own tournament entry.");
      setCancelModal("error");
      return;
    }

    const startMs = tournament.start_time
      ? new Date(tournament.start_time).getTime()
      : NaN;

    const cancelDeadlineMs = Number.isFinite(startMs)
      ? startMs - 2 * 60 * 60 * 1000
      : NaN;

    if (!Number.isFinite(cancelDeadlineMs)) {
      setCancelModalMessage("Cancellation time could not be verified. Please try again.");
      setCancelModal("error");
      return;
    }

    if (Date.now() >= cancelDeadlineMs) {
      setCancelTick(Date.now());
      setCancelModalMessage(
        "Cancellation is LOCKED. Tournament entries cannot be cancelled within 2 hours of match time."
      );
      setCancelModal("error");
      return;
    }

    // First custom popup.
    setCancelModal("notice");

    // Store the entry id for the second confirmation.
    setPendingCancelEntryId(entryId);
  };

  const confirmCancelTournament = async () => {
    if (!tournament || !pendingCancelEntryId || cancelling) return;

    const entryId = pendingCancelEntryId;
    setCancelling(true);
    setCancelModal(null);

    try {
      const response = await fetch("/api/tournaments/cancel", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: tournament.id,
          entryId,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to cancel tournament entry.");
      }

      // Remove cancelled player from the current UI immediately.
      setParticipants((prev) =>
        prev.filter((player) => player.id !== entryId)
      );
      setJoinedPlayers((count) => Math.max(0, count - 1));

      // IMPORTANT:
      // Reset all local entry state so the same tournament can be joined again
      // without showing "Already Joined".
      setJoined(false);
      removeDuoTeamCodeLocally(String(tournament.id));
      setCreatedTeamCode("");
      setTeamCodeCopied(false);
      setCurrentEntryId(null);
      setPendingCancelEntryId(null);
      setSlideValue(0);

      // Keep the latest player details saved in the account.
      // They will automatically appear again for the next tournament.

      // Update wallet immediately from the refund returned by the API.
      if (result?.wallet) {
        setWallet({
          deposit_balance: Number(result.wallet.deposit ?? 0),
          bonus_balance: Number(result.wallet.bonus ?? 0),
          winning_balance: Number(result.wallet.winning ?? 0),
        });
      } else {
        // Fallback: reload wallet if the API response does not contain it.
        try {
          const walletResponse = await fetch("/api/wallet", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });
          const walletResult = await walletResponse.json().catch(() => null);

          if (walletResponse.ok && walletResult?.wallet) {
            setWallet({
              deposit_balance: Number(walletResult.wallet.deposit ?? 0),
              bonus_balance: Number(walletResult.wallet.bonus ?? 0),
              winning_balance: Number(walletResult.wallet.winning ?? 0),
            });
          }
        } catch (walletError) {
          console.error("Wallet refresh after cancellation:", walletError);
        }
      }

      setCancelModalMessage(
        `Tournament entry cancelled successfully. 70% refund of ₹${Number(
          result?.refund?.total ?? 0
        ).toFixed(2)} has been added back to your wallet.`
      );
      setCancelModal("success");

      // Close the success popup after 3 seconds.
      window.setTimeout(() => {
        setCancelModal(null);
      }, 3000);
    } catch (error) {
      console.error("Cancel tournament entry:", error);
      setCancelModalMessage(
        error instanceof Error
          ? error.message
          : "Unable to cancel tournament entry."
      );
      setCancelModal("error");
    } finally {
      setCancelling(false);
    }
  };

  const handleDuoCreate = async () => {
    if (!gameName.trim()) {
      setJoinError("Please enter your In-Game Name.");
      return;
    }

    if (!uid) {
      setJoinError("Please enter your UID.");
      return;
    }

    if (!level || Number(level) < 1 || Number(level) > 100) {
      setJoinError("Level must be between 1 and 100.");
      return;
    }

    if (!teamName.trim()) {
      setJoinError("Please enter your team name.");
      return;
    }

    if (walletLoading) {
      setJoinError("Wallet is still loading. Please wait.");
      return;
    }

    if (tournamentUsableBalance < entryFee) {
      setInsufficientBalanceOpen(true);
      return;
    }

    if (duoLoading || !tournament) return;

    setDuoLoading(true);
    setJoinError("");

    try {
      const response = await fetch("/api/tournaments/duo/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: tournament.id,
          teamName: teamName.trim(),
          gameName: gameName.trim(),
          uid,
          level: Number(level),
        }),
      });

      const result = await response.json().catch(() => null);

      if (response.status === 402 || result?.code === "INSUFFICIENT_BALANCE") {
        setInsufficientBalanceOpen(true);
        return;
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to create Duo team.");
      }

      const newTeamCode = String(
        result?.teamCode || result?.team?.team_code || ""
      ).trim();
      setCreatedTeamCode(newTeamCode);
      if (/^\d{6}$/.test(newTeamCode)) {
        saveDuoTeamCodeLocally(String(tournament.id), newTeamCode);
      }
      setShowJoinedTeamCode(true);
      setWallet({
        deposit_balance: Number(result.wallet?.deposit ?? 0),
        bonus_balance: Number(result.wallet?.bonus ?? 0),
        winning_balance: Number(result.wallet?.winning ?? 0),
      });
      setJoinedPlayers((count) => count + 1);
      setJoined(true);
    } catch (error) {
      console.error("Duo team create:", error);
      setJoinError(
        error instanceof Error ? error.message : "Unable to create Duo team."
      );
    } finally {
      setDuoLoading(false);
    }
  };

  const handleDuoJoin = async () => {
    if (!teamCode.trim() || !/^\d{6}$/.test(teamCode.trim())) {
      setJoinError("Please enter a valid 6-digit team code.");
      return;
    }

    if (!gameName.trim()) {
      setJoinError("Please enter your In-Game Name.");
      return;
    }

    if (!uid) {
      setJoinError("Please enter your UID.");
      return;
    }

    if (!level || Number(level) < 1 || Number(level) > 100) {
      setJoinError("Level must be between 1 and 100.");
      return;
    }

    if (duoLoading || !tournament) return;

    setDuoLoading(true);
    setJoinError("");

    try {
      const response = await fetch("/api/tournaments/duo/join", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: tournament.id,
          teamCode: teamCode.trim(),
          gameName: gameName.trim(),
          uid,
          level: Number(level),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to join Duo team.");
      }

      setJoinedPlayers((count) => count + 1);
      setJoined(true);
      setJoinError("");
    } catch (error) {
      console.error("Duo team join:", error);
      setJoinError(
        error instanceof Error ? error.message : "Unable to join Duo team."
      );
    } finally {
      setDuoLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!gameName.trim()) {
      setJoinError("Please enter your In-Game Name.");
      return;
    }

    if (!uid) {
      setJoinError("Please enter your UID.");
      return;
    }

    if (!level || Number(level) < 1 || Number(level) > 100) {
      setJoinError("Level must be between 1 and 100.");
      return;
    }

    if (walletLoading) {
      setJoinError("Wallet is still loading. Please wait.");
      setSlideValue(0);
      return;
    }

    if (tournamentUsableBalance < entryFee) {
      setSlideValue(0);
      return;
    }

    if (joining || !tournament) return;

    setJoining(true);
    setJoinError("");
    setSlideValue(100);

    try {
      const response = await fetch("/api/tournaments/join", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: tournament.id,
          gameName: gameName.trim(),
          uid,
          level: Number(level),
        }),
      });

      const result = await response.json().catch(() => null);

      if (response.status === 402 || result?.code === "INSUFFICIENT_BALANCE") {
        setSlideValue(0);
        return;
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to join tournament.");
      }

      setWallet({
        deposit_balance: Number(result.wallet?.deposit ?? 0),
        bonus_balance: Number(result.wallet?.bonus ?? 0),
        winning_balance: Number(result.wallet?.winning ?? 0),
      });
      setJoinedPlayers((count) => count + 1);
      setJoined(true);

      // Keep the real entry id so cancellation is tied to this exact entry.
      if (result?.entry?.id || result?.entryId) {
        setCurrentEntryId(
          String(result.entry?.id ?? result.entryId).trim()
        );
      }

      setJoinError("");
    } catch (error) {
      console.error("Tournament join:", error);
      setSlideValue(0);
      setJoinError(
        error instanceof Error ? error.message : "Unable to join tournament."
      );
    } finally {
      setJoining(false);
    }
  };

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-[#f5f6f8] pb-24 text-gray-900">
        <header className="sticky top-0 z-40 bg-[#ff174f] px-4 py-2 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-2xl bg-white/30" />
            <div className="h-5 w-36 animate-pulse rounded-lg bg-white/30" />
          </div>
        </header>
        <section className="space-y-3 px-3 pt-3">
          <div className="h-40 animate-pulse rounded-3xl bg-gray-200" />
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="h-16 animate-pulse rounded-2xl bg-gray-100" />
              <div className="h-16 animate-pulse rounded-2xl bg-gray-100" />
              <div className="h-16 animate-pulse rounded-2xl bg-gray-100" />
              <div className="h-16 animate-pulse rounded-2xl bg-gray-100" />
            </div>
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
            <div className="mt-4 space-y-3">
              <div className="h-12 animate-pulse rounded-2xl bg-gray-100" />
              <div className="h-12 animate-pulse rounded-2xl bg-gray-100" />
              <div className="h-12 animate-pulse rounded-2xl bg-gray-100" />
            </div>
          </div>
          <div className="h-24 animate-pulse rounded-3xl bg-gray-200" />
        </section>
      </main>
    );
  }

  if (pageError || !tournament) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
          <div className="text-3xl">⚠️</div>
          <h2 className="mt-3 text-lg font-black">Tournament Not Found</h2>
          <p className="mt-1 text-xs text-gray-500">
            {pageError || "This tournament may have been removed."}
          </p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-5 rounded-xl bg-[#ff174f] px-5 py-3 text-xs font-black text-white"
          >
            GO BACK
          </button>
        </div>
      </main>
    );
  }

  const startDate = tournament.start_time
    ? new Date(tournament.start_time)
    : null;

  const formattedDate = startDate && !Number.isNaN(startDate.getTime())
    ? startDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Time TBA";

  const formattedTime = startDate && !Number.isNaN(startDate.getTime())
    ? startDate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "Time TBA";

  const statusLabel = String(tournament.status || "upcoming").toUpperCase();
  const maxPlayers = Number(tournament.max_players || 0);
  const slotPercentage =
    maxPlayers > 0 ? Math.min(100, (joinedPlayers / maxPlayers) * 100) : 0;

  const tournamentRules =
    Array.isArray(tournament.rules) && tournament.rules.length > 0
      ? tournament.rules
      : [
          "Don't invite unregistered players.",
          "Double Vector is not allowed.",
          "Screen recording is mandatory.",
          "Read all the rules before joining GamerzAdda tournaments.",
        ];

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-24 text-gray-900">

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#ff174f] px-4 py-2 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()} 
            aria-label="Go back" 
            className="group flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-slate-700 shadow-[0_8px_25px_rgba(16,185,129,0.10)] transition active:scale-95" 
          > 
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 transition group-hover:bg-emerald-100"> 
              <svg 
                viewBox="0 0 24 24" 
                className="h-5 w-5" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.4" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              > 
                <path d="M15 18l-6-6 6-6" /> 
              </svg> 
            </span> 
          </button>

          <div>
            <h1 className="text-lg font-black">
              Tournament Details
            </h1>
          </div>
        </div>
      </header>

      {/* TOURNAMENT BANNER + DETAILS */}
      <section className="px-3 pt-3">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl">
          {/* Banner */}
          {/* TOURNAMENT RULES */}
          <div className="overflow-hidden rounded-2xl border border-red-100 bg-white">
            <div className="flex items-center justify-between bg-[#ff174f] px-4 py-3 text-white">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-white/70"></p>
                <div className="mb-1.5 flex w-full items-center gap-2">
          <span className="text-lg">📜</span>
          <h2 className="text-sm font-black text-gray-900">Tournament Rules</h2>
        </div>
              </div>
              
            </div>

            <div className="space-y-2 p-3">
              {tournamentRules.slice(0, 5).map((rule, index) => (
                <RulePreview
                  key={`${rule}-${index}`}
                  icon={index === 0 ? "📖" : "🚫"}
                  text={rule}
                />
              ))}
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="shrink-0 cursor-pointer rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[9px] font-black text-white shadow-sm"
              >
                VIEW ALL RULES
              </button>
            </div>
          </div>

          {/* Tournament title */}
          <div className="p-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#ff174f]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#ff174f]">
                    Free Fire
                  </span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-gray-500">
                    {tournament.mode || "Solo"}
                  </span>
                </div>

                <h2 className="text-xl font-black leading-tight text-gray-900">
                  {tournament.title}
                </h2>

                <p className="mt-1 text-[11px] font-semibold text-gray-400">
                  Play smart. Survive longer. Win bigger.
                </p>
              </div>

              <div className="shrink-0 rounded-2xl bg-[#ff174f]/10 px-3 py-2 text-center">
                <p className="text-[8px] font-black uppercase tracking-wider text-gray-400">
                  Status
                </p>
                <p className="mt-0.5 text-[10px] font-black text-[#ff174f]">
                  ● {statusLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Prize / Entry / Players */}
          <div className="px-4 pb-4">
            <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
              <div className="px-3 py-3.5 text-center">
                <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 text-sm shadow-sm">
                  🏆
                </div>
                <p className="text-[8px] font-black uppercase tracking-wide text-green-600">
                  Prize Pool
                </p>
                <p className="mt-0.5 text-base font-black text-green-600">
                  ₹{Number(tournament.prize_pool || 0).toLocaleString("en-IN")}
                </p>
              </div>

              <div className="border-x border-gray-200 px-3 py-3.5 text-center">
                <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 text-sm shadow-sm">
                  💰
                </div>
                <p className="text-[8px] font-black uppercase tracking-wide text-green-600">
                  Entry
                </p>
                <p className="mt-0.5 text-base font-black text-green-600">
                  ₹{entryFee.toLocaleString("en-IN")}
                </p>
              </div>

              <div className="px-3 py-3.5 text-center">
                <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 text-sm shadow-sm">
                  👥
                </div>
                <p className="text-[8px] font-black uppercase tracking-wide text-green-600">
                  Players
                </p>
                <p className="mt-0.5 text-base font-black text-green-600">
                  {maxPlayers}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MATCH INFO */}
      <section className="px-3 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-black">Match Information</h3>
          <span className="rounded-full bg-green-50 px-3 py-1 text-[9px] font-black text-green-600">
            ● UPCOMING
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoCard icon="💰" label="Entry Fee" value={`₹${entryFee.toLocaleString("en-IN")}`} green />
          <InfoCard icon="🏆" label="Prize Pool" value={`₹${Number(tournament.prize_pool || 0).toLocaleString("en-IN")}`} green />
          <InfoCard icon="🎯" label="Kill Point" value={`₹${Number(tournament.kill_reward || 0).toLocaleString("en-IN")} / Kill`} green />
          <InfoCard icon="🎁" label="Bonus Usable" value={`${bonusUsablePercent}%`} />
          <InfoCard icon="📅" label="Start Date" value={formattedDate} />
          <InfoCard icon="⏰" label="Start Time" value={formattedTime} />
          <InfoCard icon="👥" label="Participants" value={`${joinedPlayers} Players`} />
          <InfoCard icon="🗺️" label="Map" value={tournament.map || "Bermuda Classic"} />
        </div>
      </section>

      {/* PLAYERS PROGRESS */}
      <section className="px-3 pt-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black">Tournament Slots</p>
              <p className="mt-0 text-[8px] font-medium text-gray-400">
                {joinedPlayers} players joined out of {maxPlayers}
              </p>
            </div>

            <p className="text-sm font-black text-red-600">{Math.round(slotPercentage)}%</p>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#ff174f] transition-all duration-300"
              style={{ width: `${slotPercentage}%` }}
            />
          </div>

          <div className="mt-2 flex justify-between text-[9px] font-bold text-gray-400">
            <span>{joinedPlayers} Joined</span>
            <span>{Math.max(0, maxPlayers - joinedPlayers)} Slots Left</span>
          </div>
        </div>
      </section>

      {/* YOUR DUO TEAM CODE */}
      {isDuoTournament && createdTeamCode && (
        <section className="px-3 pt-5">
          <div className="overflow-hidden rounded-2xl border-2 border-emerald-200 bg-emerald-50 shadow-sm">
            <div className="px-4 py-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-xl">
                🔢
              </div>

              <p className="mt-2 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">
                YOUR TEAM CODE
              </p>

              <p className="mt-1 text-3xl font-black tracking-[0.25em] text-emerald-700">
                {createdTeamCode}
              </p>

              <p className="mt-1 text-[9px] font-semibold text-emerald-600">
                Share this 6-digit code with your teammate.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={copyDuoTeamCode}
                  className="rounded-xl bg-white px-3 py-2.5 text-[10px] font-black text-emerald-700 shadow-sm ring-1 ring-emerald-200 transition active:scale-[0.98]"
                >
                  {teamCodeCopied ? "✓ COPIED" : "COPY CODE"}
                </button>

                <button
                  type="button"
                  onClick={shareDuoTeamOnWhatsApp}
                  className="rounded-xl bg-[#25D366] px-3 py-2.5 text-[10px] font-black text-white shadow-sm transition active:scale-[0.98]"
                >
                  WHATSAPP
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* PRIZE DISTRIBUTION */}
      <section className="px-3 pt-5">
        <h3 className="mb-3 text-base font-black">Prize Distribution</h3>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {(prizes.length > 0
            ? prizes
            : [
                { id: "fallback-1", rank: 1, label: "1st", amount: 0 },
                { id: "fallback-2", rank: 2, label: "2nd", amount: 0 },
                { id: "fallback-3", rank: 3, label: "3rd", amount: 0 },
              ]
          ).map((prize) => (
            <PrizeRow
              key={prize.id}
              rank={prize.label || `${prize.rank}th`}
              prize={`₹${Number(prize.amount || 0).toLocaleString("en-IN")}`}
              icon={
                prize.rank === 1
                  ? "🥇"
                  : prize.rank === 2
                  ? "🥈"
                  : prize.rank === 3
                  ? "🥉"
                  : "🏅"
              }
            />
          ))}
        </div>
      </section>

      {/* BOTTOM ACTIONS */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 p-3 backdrop-blur-md">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
          <button className="rounded-xl border border-gray-200 bg-white py-3 text-[10px] font-black text-gray-700 shadow-sm">
            👤
            <br />
            MY MATCHES
          </button>

          <button
            type="button"
            onClick={() => {
              setParticipantSearch("");
              setParticipantsOpen(true);
              loadCurrentUserForCancel();
              loadParticipants();
            }}
            className="rounded-xl border border-emerald-100 bg-white py-3 text-[10px] font-black text-gray-700 shadow-sm transition active:scale-95"
          >
            👥
            <br />
            PARTICIPANTS
          </button>

          <button
            onClick={openJoinPopup}
            className="bg-red-500 hover:bg-red-600 disabled:bg-emerald-500 disabled:hover:bg-emerald-500 disabled:cursor-not-allowed rounded-xl py-3 text-[10px] font-black text-white shadow-lg"
           disabled={joined}>
            {joined ? "✓" : "🔥"}
            <br />
            {joined ? "ALREADY JOINED" : "JOIN NOW"}
          </button>
        </div>
      </div>

      {/* CANCEL MODALS */}
      {cancelModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
            {cancelModal === "notice" && (
              <>
                <div className="px-5 pb-2 pt-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-2xl">⚠️</div>
                  <h3 className="mt-3 text-base font-black text-gray-900">Cancellation Notice</h3>
                  <p className="mt-2 text-sm font-bold leading-5 text-red-600">
                    If you cancel this tournament entry, <b>you will lose 30% of your joining fee</b>.
                  </p>
                  <p className="mt-2 text-sm font-bold leading-5 text-red-600">
                    You can cancel the tournament 2 hours before the match time.
                  </p>
                </div>
                <div className="flex gap-2 border-t border-gray-100 p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingCancelEntryId(null);
                      setCancelModal(null);
                    }}
                    className="flex-1 rounded-xl border border-red-200 bg-red-50 py-3 text-[10px] font-black text-red-600"
                  >
                    NO, KEEP JOINED
                  </button>
                  <button
                    type="button"
                    onClick={confirmCancelTournament}
                    className="flex-1 rounded-xl bg-green-600 py-3 text-[10px] font-black text-white shadow-lg shadow-green-200"
                  >
                    {cancelling ? "CANCELLING..." : "YES, CANCEL"}
                  </button>
                </div>
              </>
            )}

            {(cancelModal === "success" || cancelModal === "error") && (
              <>
                <div className="px-5 pb-2 pt-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-3xl text-white shadow-lg shadow-emerald-200 ring-4 ring-emerald-50">
                    {cancelModal === "success" ? "✓" : "⚠️"}
                  </div>
                  <h3 className="mt-3 text-base font-black text-red-600">
                    {cancelModal === "success" ? "Cancelled Successfully" : "Unable to Cancel"}
                  </h3>
                  <p className="mt-2 text-sm font-bold leading-5 text-red-600">
                    {cancelModal === "success"
                      ? "Tournament entry cancelled successfully. and your 70% fees refund ho gyi hai"
                      : cancelModalMessage}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* INSUFFICIENT BALANCE POPUP */}
      {insufficientBalanceOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="px-5 pb-3 pt-7 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-3xl shadow-sm ring-1 ring-red-100">
                ⚠️
              </div>
              <h3 className="mt-4 text-lg font-black text-gray-900">Insufficient Balance</h3>
              <p className="mt-2 text-sm font-semibold leading-5 text-gray-500">
                Your wallet balance is not enough to join this tournament.
              </p>
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-red-600">Entry Fee</span>
                  <span className="text-red-600">₹{entryFee}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-bold">
                  <span className="text-red-600">Usable Balance</span>
                  <span className="text-red-600">₹{Number(tournamentUsableBalance || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t border-gray-100 p-4">
              <button
                type="button"
                onClick={() => setInsufficientBalanceOpen(false)}
                className="flex-1 rounded-xl border border-red-200 bg-red-50 py-3 text-[10px] font-black text-red-600"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  setInsufficientBalanceOpen(false);
                  setSlideValue(0);
                  router.push("/wallet");
                }}
                className="flex-1 rounded-xl bg-green-600 py-3 text-[10px] font-black text-white shadow-lg shadow-green-200"
              >
                ADD MONEY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PARTICIPANTS MODAL */}
      {participantsOpen && (
        <div className="fixed inset-0 z-[115] flex items-end justify-center bg-black/60 px-2 pb-2 backdrop-blur-sm sm:items-center sm:px-3 sm:pb-3">
          <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-[#ff174f] to-[#e91447] px-4 py-2 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black leading-tight">Participants</h3>
                  <p className="mt-0 text-[9px] font-semibold leading-3 text-white/80">
                    {participants.length} players joined this tournament
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setParticipantsOpen(false)}
                  className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/15 px-2 text-[8px] font-black"
                >
                  CLOSE
                </button>
              </div>
            </div>

            <div className="min-h-0 max-h-[58vh] flex-1 space-y-1.5 overflow-y-auto overscroll-contain bg-[#f8faf9] p-2.5 [scrollbar-width:thin]">
              {participantsLoading ? (
                <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#ff174f]" />
                  <p className="mt-3 text-xs font-bold text-gray-500">Loading players...</p>
                </div>
              ) : participantsError ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-center text-xs font-bold text-red-600">
                  {participantsError}
                </div>
              ) : (
                (() => {
                  const query = participantSearch.trim().toLowerCase();
                  const filtered = participants.filter((player) => {
                    const name = String(player.users?.full_name || "").trim().toLowerCase();
                    const gameName = String(player.game_name || "").trim().toLowerCase();
                    const playerUid = String(player.free_fire_uid || "").trim().toLowerCase();

                    if (!query) return true;

                    return (
                      name.includes(query) ||
                      gameName.includes(query) ||
                      playerUid.includes(query)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl">
                          👥
                        </div>
                        <p className="mt-3 text-sm font-black text-gray-800">No players found</p>
                        <p className="mt-1 text-[10px] font-semibold text-gray-400">Try another name or UID.</p>
                      </div>
                    );
                  }

                  return filtered.map((player, index) => {
                    const name = player.users?.full_name?.trim() || "Unknown Player";
                    const gameNameValue = player.game_name?.trim() || "—";
                    const uidValue = player.free_fire_uid || "—";
                    const playerLevel = player.users?.level ?? "—";
                    const bio = player.users?.bio?.trim() || "GamerzAdda tournament player";

                    return (
                      <div
                        key={player.id}
                        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                      >
                        <div className="flex items-center gap-1 p-2">
                          <div className="relative shrink-0">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border-2 border-red-100 bg-gradient-to-br from-red-50 to-emerald-50 shadow-sm">
                              {player.users?.avatar_url ? (
                                <img
                                  src={player.users.avatar_url}
                                  alt={name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-lg">👤</span>
                              )}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 px-1 text-[7px] font-black text-white">
                              #{String(index + 1).padStart(2, "0")}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-0.5">
                              <div className="min-w-0">
                                <h4 className="truncate text-[14px] font-black text-gray-900">{name}</h4>
                                <p className="mt-0.5 truncate text-[11px] font-medium text-gray-400">{gameNameValue}</p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-0.5">
                                {isOwnParticipant(player) && !player.cancelled && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelTournament(player.id, player.user_id)}
                                    disabled={!canCancelTournament || cancelling}
                                    className={`rounded-lg border px-2 py-1 text-[7px] font-black transition ${
                                      canCancelTournament && !cancelling
                                        ? "border-red-200 bg-red-50 text-red-600 active:scale-[0.97]"
                                        : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                                    }`}
                                  >
                                    {cancelling
                                      ? "CANCELLING..."
                                      : canCancelTournament
                                        ? "CANCEL"
                                        : "LOCKED"}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0 text-[11px] font-medium text-gray-400">
                              <span>UID: <b className="text-gray-600">{uidValue}</b></span>
                              <span className="rounded-full bg-red-50 px-1.5 py-0 text-red-500">
                                ⭐ Level {playerLevel}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-gray-100 bg-emerald-50/60 px-2 py-1.5">
                                                    <p className="mt-0 line-clamp-1 text-[9px] font-semibold leading-3 text-gray-600">{bio}</p>
                        </div>

                      </div>
                    );
                  });
                })()
              )}
            </div>

          </div>
        </div>
      )}

      {/* ALL RULES MODAL */}
      {rulesOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 px-2 pb-2 backdrop-blur-sm sm:items-center sm:px-3 sm:pb-3">
          <div className="max-h-[90vh] max-h-[92vh] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-[#ff174f] px-5 py-4 text-white">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/70">GamerzAdda</p>
                <h3 className="text-lg font-black">All Tournament Rules</h3>
              </div>
              <button
                type="button"
                onClick={() => setRulesOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-lg"
              >
                ×
              </button>
            </div>

            <div className="max-h-[68vh] space-y-2.5 overflow-y-auto p-4">
              {[
                "YOU WILL GET ROOM ID & PASSWORD ON THE SAME MATCH TIME.",
                "(EX. YOUR MATCH IS SCHEDULED AT 2PM, THEN YOU WILL GET ID & PASSWORD AT 2:00 PM AND THE MATCH WILL BE STARTED AT 2:10PM.)",
                "YOU WILL GET ID & PASSWORD VIA GAMERZADDA NOTIFICATION.",
                "TEAMUP NOT ALLOWED.",
                "ALWAYS ON SCREEN RECORDING WHILE PLAYING GAMERZADDA MATCHES.",
                "MONSTER TRUCK OR ANY VEHICLES ARE NOT ALLOWED IN SURVIVAL MATCHES.",
                "HEADSHOT (%) SHOULD NOT BE MORE THAN 60 IN CAREER MODE.",
                "MULTIPLE ACCOUNTS ARE NOT ALLOWED.",
                "REFUND FOR PLAYERS WHO ARE KILLED BY HACKERS.",
                "PLAYING MATCHES ON CALL IS NOT ALLOWED.",
                "CUSTOM POV RECORDING IS MANDATORY.",
                "THIRD PARTY APPLICATIONS ARE NOT ALLOWED.",
                "PC PLAYERS ARE NOT ALLOWED.",
                "INVITING UNREGISTERED PLAYERS ARE NOT ALLOWED.",
                "DOUBLE VECTOR ARE NOT ALLOWED.",
                "MINIMUM LEVEL SHOULD BE 25.",
              ].map((rule, index) => (
                <div
                  key={`${rule}-${index}`}
                  className="flex gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-600">
                    •
                  </div>
                  <p className="pt-1 text-xs font-bold leading-5 text-gray-700">
                    {rule}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 p-2.5">
              <button
                type="button"
                onClick={() => setRulesOpen(false)}
                className="w-full rounded-xl bg-[#ff174f] py-3 text-sm font-black text-white shadow-lg shadow-red-200"
              >
                GOT IT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP */}
      {popup && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 px-2 pb-2 backdrop-blur-sm sm:items-center sm:px-3 sm:pb-3"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              closePopup();
            }
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >

            <div className="flex items-center bg-[#ff174f] px-4 py-2 text-white">
              <h3 className="text-sm font-black">
                {popup === "how"
                  ? "How To Play"
                  : popup === "rules"
                  ? "Match Rules"
                  : "Join Tournament"}
              </h3>
            </div>

            <div className="p-3 sm:p-3.5">

              {/* HOW TO PLAY */}
              {popup === "how" && (
                <div className="space-y-1.5">
                  <Step number="1" text="Join the tournament using the Join Now button." />
                  <Step number="2" text="Wait for the room details to be provided." />
                  <Step number="3" text="Enter the room before the match starts." />
                  <Step number="4" text="Play according to all tournament rules." />
                  <Step number="5" text="Results will be checked after the match." />
                  <Step number="6" text="Winning amount will be added to your wallet." />
                </div>
              )}

              {/* RULES */}
              {popup === "rules" && (
                <div className="space-y-3 text-sm font-semibold text-gray-700">
                  <Rule text="Vehicle is not allowed." />
                  <Rule text="Air Drop is not allowed." />
                  <Rule text="Double Vector is not allowed." />
                  <Rule text="Teaming with other players is prohibited." />
                  <Rule text="Cheating or unfair play may result in disqualification." />
                  <Rule text={`${bonusUsablePercent}% bonus is usable for this match.`} />
                </div>
              )}

              {/* JOIN TOURNAMENT */}
              {popup === "join" && (
                <div className="space-y-2">

                  {isDuoTournament ? (
                    (joined || showJoinedTeamCode) ? (
                    <div className="py-2 text-center">
                      <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
                        <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-xl" />
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-[0_12px_35px_rgba(16,185,129,0.35)] ring-1 ring-emerald-200">
                          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12.5l4.2 4.2L19 7" />
                          </svg>
                        </div>
                      </div>

                      <h4 className="text-xl font-black tracking-tight text-gray-900">
                        Tournament Joined! 🎉
                      </h4>
                      <p className="mt-1 text-xs font-semibold text-gray-500">
                        Your entry has been confirmed successfully.
                      </p>


                      {isDuoTournament && createdTeamCode && (
                        <div className="mt-3 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-center">
                          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">
                            TEAM CODE
                          </p>
                          <p className="mt-1 text-3xl font-black tracking-[0.25em] text-emerald-700">
                            {createdTeamCode}
                          </p>
                          <p className="mt-1 text-[9px] font-semibold text-emerald-600">
                            Share this 6-digit code with your teammate.
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={copyDuoTeamCode}
                              className="rounded-xl bg-white px-3 py-2.5 text-[10px] font-black text-emerald-700 shadow-sm ring-1 ring-emerald-200 active:scale-[0.98]"
                            >
                              {teamCodeCopied ? "✓ COPIED" : "COPY CODE"}
                            </button>
                            <button
                              type="button"
                              onClick={shareDuoTeamOnWhatsApp}
                              className="rounded-xl bg-[#25D366] px-3 py-2.5 text-[10px] font-black text-white shadow-sm active:scale-[0.98]"
                            >
                              WHATSAPP
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
                        <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-green-50 px-4 py-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-600">Entry Details</p>
                            <p className="mt-0.5 text-xs font-bold text-gray-700">Successfully registered</p>
                          </div>
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100">
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 3l2.4 2.1 3.2-.1.9 3 2.1 2.4-2.1 2.4-.9 3-3.2-.1L12 21l-2.4-2.1-3.2.1-.9-3-2.1-2.4 2.1-2.4.9-3 3.2.1L12 3z" />
                              <path d="M8.5 12.2l2.2 2.2 4.8-5" />
                            </svg>
                          </span>
                        </div>

                        <div className="space-y-3 p-4">
                          <WalletRow label="In-Game Name" value={gameName} strong />
                          <WalletRow label="UID" value={uid} />
                          <WalletRow label="Level" value={level} />
                          <WalletRow label="Entry Fee" value={`- ₹${entryFee}`} red />
                          <div className="border-t border-dashed border-gray-200" />
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
                            <WalletRow label="Balance After Join" value={`₹${balanceAfterJoin}`} strong green />
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2.5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-3 text-left shadow-sm">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-sm">⚠️</span>
                        <p className="text-[10px] font-bold leading-4 text-amber-800">
                          Important: Please read all tournament rules carefully before joining any GamerzAdda tournament.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* DUO ACTION */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDuoAction("create");
                            setJoinError("");
                          }}
                          className={`rounded-lg py-2 text-[10px] font-black transition ${
                            duoAction === "create"
                              ? "bg-[#ff174f] text-white shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          CREATE
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDuoAction("join");
                            setJoinError("");
                          }}
                          className={`rounded-lg py-2 text-[10px] font-black transition ${
                            duoAction === "join"
                              ? "bg-[#ff174f] text-white shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          JOIN
                        </button>
                      </div>

                      {duoAction === "create" ? (
                        <>
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                            <p className="text-[10px] font-black text-emerald-700">
                              CREATE DUO TEAM
                            </p>
                            <p className="mt-0.5 text-[8px] font-semibold text-emerald-600">
                              Pay one entry fee and invite your teammate with the 6-digit code.
                            </p>
                          </div>

                          <div>
                            <p className="mb-0.5 text-xs font-medium text-gray-700">👥 TEAM NAME</p>
                            <input
                              type="text"
                              value={teamName}
                              maxLength={20}
                              autoComplete="off"
                              placeholder="Enter team name"
                              onChange={(e) => {
                                setTeamName(
                                  e.target.value.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 20)
                                );
                                setJoinError("");
                              }}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                            />
                          </div>

                          {/* IN-GAME NAME */}
                          <div>
                            <div className="mb-0.5 flex items-center justify-between">
                              <p className="text-xs font-medium text-gray-700">🎮 IN-GAME NAME</p>
                              <span className="text-xs font-medium text-gray-400">{gameName.length}/20</span>
                            </div>
                            <input
                              type="text"
                              value={gameName}
                              maxLength={20}
                              autoComplete="off"
                              placeholder="Enter your in-game name"
                              onChange={(e) => handleGameNameChange(e.target.value)}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold uppercase outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                            />
                          </div>

                          {/* UID */}
                          <div>
                            <p className="mb-0.5 text-xs font-medium text-gray-700">🆔 UID</p>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={uid}
                              maxLength={15}
                              autoComplete="off"
                              placeholder="Enter Free Fire UID"
                              onChange={(e) => handleUidChange(e.target.value)}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                            />
                          </div>

                          {/* LEVEL */}
                          <div>
                            <p className="mb-0.5 text-xs font-medium text-gray-700">⭐ LEVEL</p>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={100}
                              value={level}
                              placeholder="Enter your level (1-100)"
                              onChange={(e) => handleLevelChange(e.target.value)}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                            />
                          </div>

                          {createdTeamCode && (
                            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-center">
                              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">
                                TEAM CODE
                              </p>
                              <p className="mt-1 text-3xl font-black tracking-[0.25em] text-emerald-700">
                                {createdTeamCode}
                              </p>
                              <p className="mt-1 text-[9px] font-semibold text-emerald-600">
                                Share this 6-digit code with your teammate.
                              </p>

                              <button
                                type="button"
                                onClick={copyDuoTeamCode}
                                className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-xs font-black text-emerald-700 shadow-sm ring-1 ring-emerald-200 transition active:scale-[0.98]"
                              >
                                {teamCodeCopied ? "✓ TEAM CODE COPIED" : "COPY TEAM CODE"}
                              </button>

                              <button
                                type="button"
                                onClick={shareDuoTeamOnWhatsApp}
                                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-xs font-black text-white shadow-sm transition active:scale-[0.98] hover:brightness-95"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  className="h-4 w-4"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path d="M20.52 3.48A11.86 11.86 0 0 0 12.08 0C5.52 0 .18 5.34.18 11.9c0 2.1.55 4.15 1.59 5.96L.08 24l6.28-1.65a11.88 11.88 0 0 0 5.71 1.46h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.45-8.43ZM12.08 21.8h-.01a9.88 9.88 0 0 1-5.03-1.38l-.36-.21-3.73.98.99-3.64-.23-.37a9.89 9.89 0 0 1-1.52-5.28C2.19 6.44 6.63 2 12.08 2c2.64 0 5.12 1.03 6.98 2.9a9.84 9.84 0 0 1 2.91 7c0 5.45-4.44 9.9-9.89 9.9Zm5.42-7.42c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.46-.88-.78-1.47-1.74-1.64-2.03-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.26.49 1.69.63.71.23 1.35.2 1.86.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
                                </svg>
                                SHARE ON WHATSAPP
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                            <p className="text-[10px] font-black text-blue-700">JOIN DUO TEAM</p>
                            <p className="mt-0.5 text-[8px] font-semibold text-blue-600">
                              Enter your teammate's 6-digit team code. No entry fee is charged.
                            </p>
                          </div>

                          <div>
                            <p className="mb-0.5 text-xs font-medium text-gray-700">🔢 TEAM CODE</p>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={teamCode}
                              maxLength={6}
                              autoComplete="off"
                              placeholder="Enter 6-digit team code"
                              onChange={(e) => {
                                setTeamCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                                setJoinError("");
                              }}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center text-lg font-black tracking-[0.2em] outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                            />
                          </div>

                          <div>
                            <p className="mb-0.5 text-xs font-medium text-gray-700">🎮 IN-GAME NAME</p>
                            <input
                              type="text"
                              value={gameName}
                              maxLength={20}
                              autoComplete="off"
                              placeholder="Enter your in-game name"
                              onChange={(e) => handleGameNameChange(e.target.value)}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold uppercase outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                            />
                          </div>

                          <div>
                            <p className="mb-0.5 text-xs font-medium text-gray-700">🆔 UID</p>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={uid}
                              maxLength={15}
                              autoComplete="off"
                              placeholder="Enter Free Fire UID"
                              onChange={(e) => handleUidChange(e.target.value)}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                            />
                          </div>

                          <div>
                            <p className="mb-0.5 text-xs font-medium text-gray-700">⭐ LEVEL</p>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={100}
                              value={level}
                              placeholder="Enter your level (1-100)"
                              onChange={(e) => handleLevelChange(e.target.value)}
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                            />
                          </div>
                        </>
                      )}

                      {joinError && (
                        <div
                          role="alert"
                          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-600"
                        >
                          ⚠️ {joinError}
                        </div>
                      )}
                    </>
                  )) : (
                    <>
                      {/* IN-GAME NAME */}
                      <div>
                        <div className="mb-0.5 flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-700">
                            🎮 IN-GAME NAME
                          </p>
                          <span className="text-xs font-medium text-gray-400">
                            {gameName.length}/20
                          </span>
                        </div>

                        <input
                          type="text"
                          value={gameName}
                          maxLength={20}
                          autoComplete="off"
                          placeholder="Enter your in-game name"
                          onChange={(e) => handleGameNameChange(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold uppercase outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />

                        <p className="mt-0 text-[8px] font-medium text-gray-400">
                          Maximum 20 characters • Automatically uppercase
                        </p>
                      </div>

                      {/* UID */}
                      <div>
                        <div className="mb-0.5 flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-700">
                            🆔 UID
                          </p>
                          <span className="text-xs font-medium text-gray-400">
                            {uid.length}/15
                          </span>
                        </div>

                        <input
                          type="text"
                          inputMode="numeric"
                          value={uid}
                          maxLength={15}
                          autoComplete="off"
                          placeholder="Enter Free Fire UID"
                          onChange={(e) => handleUidChange(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />

                        <p className="mt-0 text-[8px] font-medium text-gray-400">
                          Numbers only • Maximum 15 digits
                        </p>
                      </div>

                      {/* LEVEL */}
                      <div>
                        <div className="mb-0.5 flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-700">
                            ⭐ LEVEL
                          </p>
                          <span className="text-xs font-medium text-gray-400">
                            1–100
                          </span>
                        </div>

                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={100}
                          value={level}
                          placeholder="Enter your level (1-100)"
                          onChange={(e) => handleLevelChange(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                        />

                        <p className="mt-0 text-[8px] font-medium text-gray-400">
                          Level must be between 1 and 100
                        </p>
                      </div>

                      {tournamentUsableBalance < entryFee && !walletLoading && (
                        <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-center">
                          <p className="text-[11px] font-black text-red-600">
                            ⚠️ Insufficient wallet balance to join this tournament
                          </p>
                        </div>
                      )}

                      {/* WALLET BREAKDOWN */}
                      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 via-white to-gray-50 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setWalletOpen((open) => !open)}
                          aria-expanded={walletOpen}
                          className="group flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-white/70 active:scale-[0.995]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-sm shadow-sm">
                              💰
                            </span>
                            <div>
                              <p className="text-xs font-medium text-gray-900">Wallet Breakdown</p>
                              <p className="text-xs font-medium text-gray-400">
                                {walletOpen ? "Hide balance details" : "Tap to view balance details"}
                              </p>
                              <div className="mt-1 space-y-0 text-xs font-medium">
                                <div className="flex items-center justify-between">
                                  <span className="text-red-600">Tournament Entry Fee</span>
                                  <span className="text-red-600">- ₹{entryFee.toLocaleString("en-IN")}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-emerald-600">Balance After Join</span>
                                  <span className="text-emerald-600">₹{balanceAfterJoin.toLocaleString("en-IN")}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-yellow-200 bg-yellow-50 text-yellow-700 shadow-sm transition-transform duration-200">
                            <svg
                              viewBox="0 0 24 24"
                              className={`h-4 w-4 transition-transform duration-200 ${walletOpen ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </span>
                        </button>

                        {walletOpen && (
                          <div className="border-t border-gray-100 px-3 py-2">
                            <div className="space-y-0 text-xs leading-none">
                              <p className="rounded-md bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">Current Wallet Balance</p>

                              <div className="flex items-center justify-between py-0 text-xs font-medium">
                                <span className="text-gray-600">Bonus Balance</span>
                                <span className="text-emerald-600">₹{bonusBalance.toLocaleString("en-IN")}</span>
                              </div>
                              <div className="flex items-center justify-between py-0 text-xs font-medium">
                                <span className="text-gray-600">Deposit Balance</span>
                                <span className="text-emerald-600">₹{depositBalance.toLocaleString("en-IN")}</span>
                              </div>
                              <div className="flex items-center justify-between py-0 text-xs font-medium">
                                <span className="text-gray-600">Winning Balance</span>
                                <span className="text-emerald-600">₹{winningBalance.toLocaleString("en-IN")}</span>
                              </div>

                              <div className="my-1 border-t border-gray-200" />

                              <p className="rounded-md bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">Tournament Entry Deduction</p>

                              <div className="flex items-center justify-between py-0 text-xs font-medium">
                                <span className="text-gray-600">Bonus Used</span>
                                <span className="text-red-600">- ₹{bonusCut.toLocaleString("en-IN")}</span>
                              </div>
                              <div className="flex items-center justify-between py-0 text-xs font-medium">
                                <span className="text-gray-600">Deposit Used</span>
                                <span className="text-red-600">- ₹{depositCut.toLocaleString("en-IN")}</span>
                              </div>
                              <div className="flex items-center justify-between py-0 text-xs font-medium">
                                <span className="text-gray-600">Winning Used</span>
                                <span className="text-red-600">- ₹{winningCut.toLocaleString("en-IN")}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {joinError && (
                        <div
                          role="alert"
                          className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-600"
                        >
                          ⚠️ {joinError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

            </div>

            <div className="border-t border-gray-100 p-2.5">

              {popup === "join" ? (
                joined ? (
                  <button
                    onClick={closePopup}
                    className="w-full rounded-xl bg-gradient-to-r from-green-600 to-green-500 py-3.5 text-sm font-black text-white shadow-lg shadow-green-200"
                  >
                    ✓ DONE
                  </button>
                ) : isDuoTournament ? (
                  <button
                    type="button"
                    onClick={duoAction === "create" ? handleDuoCreate : handleDuoJoin}
                    disabled={duoLoading}
                    className="w-full rounded-xl bg-[#ff174f] py-3.5 text-sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {duoLoading
                      ? "PROCESSING..."
                      : duoAction === "create"
                        ? `CREATE TEAM • ₹${entryFee}`
                        : "JOIN TEAM • FREE"}
                  </button>
                ) : (
                  <div className="w-full">
                    <div
                      ref={sliderRef}
                      className={`relative h-[62px] w-full select-none overflow-hidden rounded-2xl border border-red-200/80 bg-gradient-to-r from-red-50 via-white to-red-50 shadow-[0_10px_28px_rgba(255,23,79,0.14)] touch-none ${tournamentUsableBalance < entryFee ? "cursor-not-allowed opacity-75" : ""}`}
                      aria-label="Slide to join tournament"
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-2xl bg-gradient-to-r from-[#ff174f] via-[#ff174f] to-[#ff315f] shadow-[0_0_22px_rgba(255,23,79,0.28)]"
                        style={{ width: `${slideValue}%` }}
                      />

                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span
                          className={`text-[11px] font-black tracking-[0.18em] transition-colors duration-150 ${
                            slideValue >= 55 ? "text-white" : "text-red-500"
                          }`}
                        >
                          {joining || slideValue >= 100 ? "JOINING..." : "SLIDE TO JOIN"}
                        </span>
                      </div>

                      <button
                        type="button"
                        aria-label="Slide to confirm and join"
                        onPointerDown={(e) => {
                          if (joined || joining) return;
                          if (tournamentUsableBalance < entryFee) {
                            e.preventDefault();
                            setSlideValue(0);
                            setInsufficientBalanceOpen(true);
                            return;
                          }
                          e.preventDefault();
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (tournamentUsableBalance < entryFee) return;
                          if (!e.currentTarget.hasPointerCapture(e.pointerId) || joined || joining) return;
                          const rect = sliderRef.current?.getBoundingClientRect();
                          if (!rect) return;

                          const knobWidth = 54;
                          const usableWidth = Math.max(1, rect.width - knobWidth);
                          const x = e.clientX - rect.left - knobWidth / 2;
                          const next = Math.max(0, Math.min(100, (x / usableWidth) * 100));
                          setSlideValue(next);
                        }}
                        onPointerUp={(e) => {
                          if (tournamentUsableBalance < entryFee) {
                            setSlideValue(0);
                            setSlideValue(0);
                            return;
                          }
                          if (!e.currentTarget.hasPointerCapture(e.pointerId) || joined || joining || tournamentUsableBalance < entryFee) return;
                          e.currentTarget.releasePointerCapture(e.pointerId);

                          if (slideValue >= 90) {
                            handleJoin();
                          } else {
                            setSlideValue(0);
                          }
                        }}
                        onPointerCancel={(e) => {
                          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                            e.currentTarget.releasePointerCapture(e.pointerId);
                          }
                          setSlideValue(0);
                        }}
                        className="absolute top-1/2 z-10 flex h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center rounded-2xl border border-white bg-white text-2xl font-black text-[#ff174f] shadow-[0_7px_22px_rgba(0,0,0,0.16)] ring-1 ring-red-100/80 transition-[left] duration-75 ease-out active:scale-[0.94]"
                        style={{ left: `calc(${Math.min(slideValue, 100)}% * 0.9 + 5%)` }}
                      >
                        {slideValue >= 90 ? "✓" : "→"}
                      </button>
                    </div>

                    <p className={`mt-1 text-center text-[8px] font-bold ${tournamentUsableBalance < entryFee ? "text-red-500" : "text-gray-400"}`}>
                      {tournamentUsableBalance < entryFee
                        ? "Insufficient wallet balance to join this tournament"
                        : `Drag the arrow all the way to the right to confirm • ₹${entryFee} will be deducted`}
                    </p>
                  </div>
                )
              ) : (
                <button
                  onClick={closePopup}
                  className="w-full rounded-xl bg-red-600 py-3 text-sm font-black text-white"
                >
                  GOT IT
                </button>
              )}

            </div>
          </div>
        </div>
      )}
    </main>
  );
}


/* INFO CARD */

function InfoCard({
  icon,
  label,
  value,
  green,
}: {
  icon: string;
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${green ? "border-green-100 bg-green-50/40" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${green ? "bg-green-100" : "bg-gray-50"}`}>
          {icon}
        </div>

        <div className="min-w-0">
          <p className={`text-[9px] font-bold uppercase tracking-wide ${green ? "text-green-600" : "text-gray-400"}`}>
            {label}
          </p>

          <p className={`mt-1 truncate text-sm font-black ${green ? "text-green-600" : "text-gray-900"}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}


/* PRIZE ROW */

function PrizeRow({
  rank,
  prize,
  icon,
}: {
  rank: string;
  prize: string;
  icon: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-xl">
          {icon}
        </div>

        <p className="text-sm font-black">
          {rank} Place
        </p>
      </div>

      <p className="text-base font-black text-red-600">
        {prize}
      </p>
    </div>
  );
}


/* STEP */

function Step({
  number,
  text,
}: {
  number: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-black text-white">
        {number}
      </div>

      <p className="pt-1 text-sm font-semibold leading-5 text-gray-700">
        {text}
      </p>
    </div>
  );
}


/* RULE PREVIEW */
function RulePreview({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3">
      <span className="text-lg">{icon}</span>
      <p className="text-xs font-bold text-emerald-600">{text}</p>
    </div>
  );
}


/* RULE */

function Rule({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p>• {text}</p>
    </div>
  );
}


/* WALLET ROW */

function WalletRow({
  label,
  value,
  strong = false,
  green = false,
  red = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-0 text-xs leading-tight">
      <span
        className={
          red
            ? "text-xs font-black text-red-600"
            : green
            ? strong
              ? "text-xs font-black text-emerald-600"
              : "text-xs font-semibold text-emerald-600"
            : strong
            ? "text-xs font-black text-gray-800"
            : "text-xs font-semibold text-gray-500"
        }
      >
        {label}
      </span>
      <span
        className={
          red
            ? "text-xs font-black text-red-600"
            : green
            ? "text-xs font-black text-emerald-600"
            : strong
            ? "text-xs font-black text-gray-900"
            : "text-xs font-bold text-gray-700"
        }
      >
        {value}
      </span>
    </div>
  );
}
