"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Tournament = {
  id: string;
  title: string;
  game: string;
  mode: string;
  entry_fee: number;
  prize_pool: number;
  kill_reward: number;
  max_players: number;
  start_time: string;
  map: string;
  bonus_usable_percent: number;
};

type Player = {
  id: string;
  user_id: string;
  free_fire_uid: string | null;
};

type Match = {
  id: string;
  room_id: string | null;
  room_password: string | null;
  start_time: string | null;
  status: string | null;
};

type Prize = {
  id: string;
  rank: number;
  label: string;
  amount: number;
};

type Result = {
  id: string;
  match_id: string;
  user_id: string;
  rank: number | null;
  kills: number | null;
  winning_amount: number | null;
};

export default function TournamentManagePage() {
  const params = useParams();
  const router = useRouter();

  const tournamentId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [resultUserId, setResultUserId] = useState("");
  const [resultRank, setResultRank] = useState("");
  const [resultKills, setResultKills] = useState("");
  const [resultWinningAmount, setResultWinningAmount] = useState("");
  const [savingResult, setSavingResult] = useState(false);

  const [form, setForm] = useState({
    title: "",
    game: "",
    mode: "",
    entry_fee: "",
    prize_pool: "",
    kill_reward: "",
    bonus_usable_percent: "0",
    max_players: "",
    start_time: "",
    map: "",
  });

  const [roomId, setRoomId] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [matchStartTime, setMatchStartTime] = useState("");
  const [matchStatus, setMatchStatus] = useState("upcoming");

  const [newRank, setNewRank] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/admin/login");
      return false;
    }

    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (data?.role !== "admin") {
      router.push("/");
      return false;
    }

    return true;
  }

  async function loadData() {
    setLoading(true);

    const allowed = await checkAdmin();
    if (!allowed) return;

    const { data: tournamentData, error: tournamentError } =
      await supabase
        .from("tournaments")
        .select(
          `
          id,
          title,
          game,
          mode,
          entry_fee,
          prize_pool,
          kill_reward,
          max_players,
          start_time,
          map,
          bonus_usable_percent
        `
        )
        .eq("id", tournamentId)
        .single();

    if (tournamentError || !tournamentData) {
      alert("Tournament not found");
      router.push("/admin/tournaments");
      return;
    }

    const t = tournamentData as Tournament;

    setTournament(t);

    setForm({
      title: t.title || "",
      game: t.game || "",
      mode: t.mode || "",
      entry_fee: String(t.entry_fee ?? 0),
      prize_pool: String(t.prize_pool ?? 0),
      kill_reward: String(t.kill_reward ?? 0),
      bonus_usable_percent: String(t.bonus_usable_percent ?? 0),
      max_players: String(t.max_players ?? 0),
      start_time: t.start_time
        ? new Date(t.start_time).toISOString().slice(0, 16)
        : "",
      map: t.map || "",
    });

    const { data: playersData } = await supabase
      .from("tournament_entries")
      .select("id, user_id, free_fire_uid")
      .eq("tournament_id", tournamentId)
      .order("id", { ascending: false });

    setPlayers((playersData || []) as Player[]);

    const { data: matchData } = await supabase
      .from("matches")
      .select("id, room_id, room_password, start_time, status")
      .eq("tournament_id", tournamentId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (matchData) {
      setMatch(matchData as Match);
      setRoomId(matchData.room_id || "");
      setRoomPassword(matchData.room_password || "");
      setMatchStartTime(
        matchData.start_time
          ? new Date(matchData.start_time).toISOString().slice(0, 16)
          : ""
      );
      setMatchStatus(matchData.status || "upcoming");

      const { data: resultsData, error: resultsError } = await supabase
        .from("results")
        .select("id, match_id, user_id, rank, kills, winning_amount")
        .eq("match_id", matchData.id)
        .order("rank", { ascending: true });

      if (!resultsError) {
        setResults((resultsData || []) as Result[]);
      }
    } else {
      setResults([]);
    }

    const { data: prizesData, error: prizesError } = await supabase
      .from("tournament_prizes")
      .select("id, rank, label, amount")
      .eq("tournament_id", tournamentId)
      .order("rank", { ascending: true });

    if (!prizesError) {
      setPrizes((prizesData || []) as Prize[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  async function saveTournament() {
    if (!tournament) return;

    setSaving(true);

    const { error } = await supabase
      .from("tournaments")
      .update({
        title: form.title,
        game: form.game,
        mode: form.mode,
        entry_fee: Number(form.entry_fee) || 0,
        prize_pool: Number(form.prize_pool) || 0,
        kill_reward: Number(form.kill_reward) || 0,
        bonus_usable_percent: Math.min(100, Math.max(0, Number(form.bonus_usable_percent) || 0)),
      max_players: Number(form.max_players) || 0,
        start_time: form.start_time
          ? new Date(form.start_time).toISOString()
          : null,
        map: form.map,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tournamentId);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Tournament updated successfully");
    await loadData();
  }

  async function saveRoomDetails() {
    if (!roomId.trim() || !roomPassword.trim()) {
      alert("Enter Room ID and Room Password");
      return;
    }

    setSaving(true);

    let error = null;

    if (match) {
      const result = await supabase
        .from("matches")
        .update({
          room_id: roomId.trim(),
          room_password: roomPassword.trim(),
          start_time: matchStartTime
            ? new Date(matchStartTime).toISOString()
            : null,
          status: matchStatus,
        })
        .eq("id", match.id);

      error = result.error;
    } else {
      const result = await supabase.from("matches").insert({
        tournament_id: tournamentId,
        room_id: roomId.trim(),
        room_password: roomPassword.trim(),
        start_time: matchStartTime
          ? new Date(matchStartTime).toISOString()
          : null,
        status: matchStatus,
      });

      error = result.error;
    }

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("LIVE KEYS are now live for users.");
    await loadData();
  }

  async function makeKeysLive() {
    if (!roomId.trim() || !roomPassword.trim()) {
      alert("Enter Room ID and Room Password first.");
      return;
    }

    setSaving(true);

    let error = null;

    if (match) {
      const result = await supabase
        .from("matches")
        .update({
          room_id: roomId.trim(),
          room_password: roomPassword.trim(),
        })
        .eq("id", match.id);

      error = result.error;
    } else {
      const result = await supabase
        .from("matches")
        .insert({
          tournament_id: tournamentId,
          room_id: roomId.trim(),
          room_password: roomPassword.trim(),
          start_time: matchStartTime
            ? new Date(matchStartTime).toISOString()
            : null,
          status: matchStatus,
        });

      error = result.error;
    }

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("LIVE KEYS sent to users successfully.");
    await loadData();
  }

  async function removePlayer(playerId: string) {
    const confirmed = confirm(
      "Are you sure you want to remove this player from the tournament?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("tournament_entries")
      .delete()
      .eq("id", playerId);

    if (error) {
      alert(error.message);
      return;
    }

    setPlayers((prev) => prev.filter((player) => player.id !== playerId));
  }

  async function addPrize() {
    const rank = Number(newRank);
    const amount = Number(newAmount);

    if (!rank || rank < 1) {
      alert("Enter a valid rank");
      return;
    }

    if (!newLabel.trim()) {
      alert("Enter prize label");
      return;
    }

    if (amount < 0) {
      alert("Enter a valid amount");
      return;
    }

    const existing = prizes.find((prize) => prize.rank === rank);

    if (existing) {
      alert(`Rank ${rank} already exists`);
      return;
    }

    const { data, error } = await supabase
      .from("tournament_prizes")
      .insert({
        tournament_id: tournamentId,
        rank,
        label: newLabel.trim(),
        amount,
      })
      .select("id, rank, label, amount")
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    if (data) {
      setPrizes((prev) =>
        [...prev, data as Prize].sort((a, b) => a.rank - b.rank)
      );
    }

    setNewRank("");
    setNewLabel("");
    setNewAmount("");
  }

  async function updatePrize(
    prizeId: string,
    field: "rank" | "label" | "amount",
    value: string
  ) {
    let updateValue: string | number = value;

    if (field === "rank" || field === "amount") {
      updateValue = Number(value) || 0;
    }

    const { error } = await supabase
      .from("tournament_prizes")
      .update({
        [field]: updateValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prizeId);

    if (error) {
      alert(error.message);
      return;
    }

    setPrizes((prev) =>
      prev
        .map((prize) =>
          prize.id === prizeId
            ? {
                ...prize,
                [field]: updateValue,
              }
            : prize
        )
        .sort((a, b) => a.rank - b.rank)
    );
  }

  async function deletePrize(prizeId: string) {
    const confirmed = confirm("Delete this prize?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("tournament_prizes")
      .delete()
      .eq("id", prizeId);

    if (error) {
      alert(error.message);
      return;
    }

    setPrizes((prev) => prev.filter((prize) => prize.id !== prizeId));
  }

  async function saveResult() {
    if (!match) {
      alert("Create/save match details first.");
      return;
    }

    if (!resultUserId.trim()) {
      alert("Select a player.");
      return;
    }

    const rank = Number(resultRank);
    const kills = Number(resultKills) || 0;
    const winningAmount = Number(resultWinningAmount) || 0;

    if (!rank || rank < 1) {
      alert("Enter a valid rank.");
      return;
    }

    if (kills < 0 || winningAmount < 0) {
      alert("Kills and winning amount cannot be negative.");
      return;
    }

    const existingResult = results.find(
      (result) => result.user_id === resultUserId
    );

    setSavingResult(true);

    let data: Result | null = null;
    let error: any = null;

    if (existingResult) {
      const response = await supabase
        .from("results")
        .update({
          rank,
          kills,
          winning_amount: winningAmount,
        })
        .eq("id", existingResult.id)
        .select(
          "id, match_id, user_id, rank, kills, winning_amount"
        )
        .single();

      data = response.data as Result | null;
      error = response.error;
    } else {
      const response = await supabase
        .from("results")
        .insert({
          match_id: match.id,
          user_id: resultUserId.trim(),
          rank,
          kills,
          winning_amount: winningAmount,
        })
        .select(
          "id, match_id, user_id, rank, kills, winning_amount"
        )
        .single();

      data = response.data as Result | null;
      error = response.error;
    }

    setSavingResult(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (data) {
      setResults((prev) =>
        [...prev.filter((result) => result.id !== data!.id), data].sort(
          (a, b) => (a.rank || 999999) - (b.rank || 999999)
        )
      );
    }

    setResultUserId("");
    setResultRank("");
    setResultKills("");
    setResultWinningAmount("");

    alert(existingResult ? "Result updated." : "Result saved.");
  }

  async function deleteResult(resultId: string) {
    const confirmed = confirm("Delete this result?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("results")
      .delete()
      .eq("id", resultId);

    if (error) {
      alert(error.message);
      return;
    }

    setResults((prev) => prev.filter((result) => result.id !== resultId));
  }

  function editResult(result: Result) {
    setResultUserId(result.user_id);
    setResultRank(String(result.rank ?? ""));
    setResultKills(String(result.kills ?? 0));
    setResultWinningAmount(String(result.winning_amount ?? 0));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <div className="text-sm text-gray-400">
          Loading tournament...
        </div>
      </div>
    );
  }

  if (!tournament) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <div className="border-b border-white/10 bg-[#0d0d0d]">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Link
                  href="/admin/tournaments"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 hover:bg-white/10"
                >
                  ← Back
                </Link>

                <div>
                  <h1 className="text-xl font-black">
                    Edit Tournament
                  </h1>

                  <p className="mt-1 text-xs text-gray-500">
                    {tournament.title}
                  </p>
                </div>
              </div>
            </div>


          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* SUMMARY */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-[#101010] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Players
            </p>
            <p className="mt-1 text-2xl font-black">
              {players.length}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#101010] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Max Players
            </p>
            <p className="mt-1 text-2xl font-black">
              {tournament.max_players}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#101010] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Entry Fee
            </p>
            <p className="mt-1 text-2xl font-black text-emerald-400">
              ₹{tournament.entry_fee}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#101010] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Prize Pool
            </p>
            <p className="mt-1 text-2xl font-black text-emerald-400">
              ₹{tournament.prize_pool}
            </p>
          </div>
        </div>

        {/* TOURNAMENT EDIT */}
        <section id="edit-tournament" className="mt-6 rounded-2xl border border-white/10 bg-[#101010] p-5">
          <div className="mb-5">
            <h2 className="text-lg font-black">
              Tournament Details
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Edit tournament information
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Tournament Title"
              value={form.title}
              onChange={(value) =>
                setForm((p) => ({ ...p, title: value }))
              }
            />

            <SelectInput
              label="Game"
              value={form.game}
              options={["Free Fire", "Free Fire MAX"]}
              onChange={(value) =>
                setForm((p) => ({ ...p, game: value }))
              }
            />

            <SelectInput
              label="Mode"
              value={form.mode}
              options={["Solo", "Duo", "Squad"]}
              onChange={(value) =>
                setForm((p) => ({ ...p, mode: value }))
              }
            />

            <Input
              label="Entry Fee ₹"
              type="number"
              value={form.entry_fee}
              onChange={(value) =>
                setForm((p) => ({ ...p, entry_fee: value }))
              }
            />

            <Input
              label="Prize Pool ₹"
              type="number"
              value={form.prize_pool}
              onChange={(value) =>
                setForm((p) => ({ ...p, prize_pool: value }))
              }
            />

            <Input
              label="Kill Reward ₹"
              type="number"
              value={form.kill_reward}
              onChange={(value) =>
                setForm((p) => ({ ...p, kill_reward: value }))
              }
            />

            <div>
              <label className="mb-2 block text-xs font-bold text-gray-400">
                Bonus Wallet Usage %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.bonus_usable_percent}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    bonus_usable_percent: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none focus:border-red-500"
              />
              <p className="mt-1 text-[10px] text-gray-500">
                Maximum percentage of bonus wallet that can be used for this match.
              </p>
            </div>

            <Input
              label="Maximum Players"
              type="number"
              value={form.max_players}
              onChange={(value) =>
                setForm((p) => ({ ...p, max_players: value }))
              }
            />

            <SelectInput
              label="Map"
              value={form.map}
              options={[
                "Bermuda Classic",
                "Purgatory",
                "Kalahari",
                "Alpine",
                "NexTerra",
              ]}
              onChange={(value) =>
                setForm((p) => ({ ...p, map: value }))
              }
            />

            <Input
              label="Match Start Time"
              type="datetime-local"
              value={form.start_time}
              onChange={(value) =>
                setForm((p) => ({ ...p, start_time: value }))
              }
            />

          </div>

          <button
            onClick={saveTournament}
            disabled={saving}
            className="mt-5 rounded-xl bg-red-500 px-6 py-3 text-sm font-black text-white hover:bg-red-400 disabled:opacity-50"
          >
            {saving ? "Saving..." : "SAVE CHANGES"}
          </button>
        </section>

        {/* KEYS */}
        <section className="mt-6 rounded-2xl border border-red-500/20 bg-[#101010] p-5">
          <div className="mb-5">
            <h2 className="text-lg font-black">KEYS</h2>
            <p className="mt-1 text-xs text-gray-500">
              Send the current Room ID and Room Password live to users.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Room ID"
              value={roomId}
              onChange={setRoomId}
            />

            <Input
              label="Room Password"
              value={roomPassword}
              onChange={setRoomPassword}
            />
          </div>

          <button
            type="button"
            onClick={makeKeysLive}
            disabled={saving}
            className="mt-5 w-full rounded-xl bg-red-500 px-6 py-3 text-sm font-black text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "GOING LIVE..." : "🔴 LIVE KEYS"}
          </button>
        </section>

        {/* PRIZE DISTRIBUTION */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-[#101010] p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black">
                Prize Distribution
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Manage winning amounts for this tournament
              </p>
            </div>

            <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400">
              Total: ₹
              {prizes.reduce(
                (total, prize) => total + Number(prize.amount || 0),
                0
              )}
            </div>
          </div>

          {/* ADD PRIZE */}
          <div className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 md:grid-cols-[100px_1fr_160px_auto]">
            <input
              type="number"
              placeholder="Rank"
              value={newRank}
              onChange={(e) => setNewRank(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm outline-none focus:border-red-500"
            />

            <input
              type="text"
              placeholder="Prize Label e.g. 1st Place"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm outline-none focus:border-red-500"
            />

            <input
              type="number"
              placeholder="Amount ₹"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm outline-none focus:border-red-500"
            />

            <button
              onClick={addPrize}
              className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-black text-black hover:bg-emerald-400"
            >
              + Add Prize
            </button>
          </div>

          {/* PRIZE LIST */}
          <div className="mt-4 space-y-3">
            {prizes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-gray-500">
                No prizes added yet.
              </div>
            ) : (
              prizes.map((prize) => (
                <div
                  key={prize.id}
                  className="grid gap-3 rounded-xl border border-white/10 bg-[#0b0b0b] p-4 md:grid-cols-[90px_1fr_160px_auto] md:items-center"
                >
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-gray-600">
                      Rank
                    </label>

                    <input
                      type="number"
                      value={prize.rank}
                      onChange={(e) =>
                        updatePrize(
                          prize.id,
                          "rank",
                          e.target.value
                        )
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#101010] px-3 py-2 text-sm font-bold outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-gray-600">
                      Label
                    </label>

                    <input
                      type="text"
                      value={prize.label}
                      onChange={(e) =>
                        updatePrize(
                          prize.id,
                          "label",
                          e.target.value
                        )
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#101010] px-3 py-2 text-sm font-bold outline-none focus:border-red-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-gray-600">
                      Amount
                    </label>

                    <div className="flex items-center">
                      <span className="rounded-l-lg border border-r-0 border-white/10 bg-[#151515] px-3 py-2 text-sm text-emerald-400">
                        ₹
                      </span>

                      <input
                        type="number"
                        value={prize.amount}
                        onChange={(e) =>
                          updatePrize(
                            prize.id,
                            "amount",
                            e.target.value
                          )
                        }
                        className="w-full rounded-r-lg border border-white/10 bg-[#101010] px-3 py-2 text-sm font-black text-emerald-400 outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => deletePrize(prize.id)}
                    className="rounded-lg bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* HARD CODED RULES NOTE */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-[#101010] p-5">
          <h2 className="text-lg font-black">
            Tournament Rules
          </h2>

          <p className="mt-2 text-xs leading-5 text-gray-500">
            Tournament rules are hardcoded in the user tournament
            page. Rules are not managed from the admin panel.
          </p>
        </section>
      </main>
    </div>
  );
}


function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold text-gray-400">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none focus:border-red-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold text-gray-400">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-[#080808] px-4 py-3 text-sm outline-none focus:border-red-500"
      />
    </div>
  );
}