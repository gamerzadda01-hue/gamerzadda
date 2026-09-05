"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  bio: string;
  avatarUrl: string;
};

type Wallet = {
  deposit: number;
  bonus: number;
  winning: number;
  total: number;
};

export default function ProfilePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [wallet, setWallet] = useState<Wallet>({
    deposit: 0,
    bonus: 0,
    winning: 0,
    total: 0,
  });

  const [loading, setLoading] = useState(true);
  const [savingBio, setSavingBio] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [bio, setBio] = useState("");
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/profile", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load profile."
        );
      }

      setProfile(data.profile);

      setWallet({
        deposit: Number(data.wallet?.deposit || 0),
        bonus: Number(data.wallet?.bonus || 0),
        winning: Number(data.wallet?.winning || 0),
        total: Number(data.wallet?.total || 0),
      });

      setBio(data.profile?.bio || "");
      setPreview(data.profile?.avatarUrl || "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load profile."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatMoney(amount: number) {
    return `₹${amount.toFixed(2)}`;
  }

  function handleBioChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const value = event.target.value;

    if (value.length > 30) return;

    if (!/^[A-Za-z0-9 ]*$/.test(value)) {
      return;
    }

    setBio(value);
    setMessage("");
    setError("");
  }

  async function saveBio() {
    try {
      setSavingBio(true);
      setMessage("");
      setError("");

      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bio,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to save bio."
        );
      }

      setProfile(data.profile);
      setBio(data.profile.bio || "");

      setMessage("Bio updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save bio."
      );
    } finally {
      setSavingBio(false);
    }
  }

  function selectProfilePicture() {
    fileInputRef.current?.click();
  }

  async function handleProfilePicture(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setMessage("");
    setError("");

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Only JPG, PNG or WebP images are allowed."
      );

      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError(
        "Profile picture must be 2 MB or smaller."
      );

      event.target.value = "";
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "/api/profile/avatar",
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to upload profile picture."
        );
      }

      setPreview(data.avatarUrl);

      setProfile((previous) =>
        previous
          ? {
              ...previous,
              avatarUrl: data.avatarUrl,
            }
          : previous
      );

      setMessage(
        "Profile picture updated successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to upload profile picture."
      );

      if (profile?.avatarUrl) {
        setPreview(profile.avatarUrl);
      } else {
        setPreview("");
      }
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function copyReferral() {
    if (!profile?.referralCode) return;

    try {
      await navigator.clipboard.writeText(
        profile.referralCode
      );

      setMessage("Referral code copied.");
    } catch {
      setError("Unable to copy referral code.");
    }
  }

  async function shareReferral() {
    if (!profile?.referralCode) return;

    const text = `🔥 Download GamerzAdda Now!

🎮 Play Hard. Win Big. 🏆

Download now:
https://gamerzadda.com

🎁 Use my referral code: ${profile.referralCode}

Join GamerzAdda and start playing! 🔥`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join GamerzAdda 🎮",
          text,
        });
      } else {
        await navigator.clipboard.writeText(text);

        setMessage(
          "Referral message copied."
        );
      }
    } catch {
      // User cancelled sharing
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-white via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-4 border-red-100 border-t-red-600 animate-spin" />

          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading profile...
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-white via-white to-green-50 flex items-center justify-center px-5">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl border border-gray-100">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">
            👤
          </div>

          <h1 className="text-2xl font-black text-gray-900">
            Login Required
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Please login to view your profile.
          </p>

          <Link
            href="/login"
            className="mt-6 block rounded-2xl bg-red-600 py-3.5 text-center font-bold text-white shadow-lg shadow-red-200"
          >
            Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-white to-green-50 pb-10">
      <div className="mx-auto w-full max-w-2xl px-4 py-5">

        {/* HEADER */}
        <div className="mb-5 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-xl text-gray-900 shadow-md border border-gray-100 transition active:scale-95"
          >
            ←
          </Link>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-500">
              GamerzAdda
            </p>

            <h1 className="text-2xl font-black text-gray-900">
              My Profile
            </h1>
          </div>
        </div>

        {/* SUCCESS MESSAGE */}
        {message && (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
            {message}
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        {/* PROFILE CARD */}
        <section className="rounded-3xl bg-white p-5 shadow-xl border border-gray-100">
          <div className="flex items-center gap-4">

            <div className="relative">
              {preview ? (
                <img
                  src={preview}
                  alt="Profile"
                  className="h-24 w-24 rounded-full object-cover border-4 border-green-100 shadow-md"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-4xl text-white shadow-md">
                  {profile.name
                    ?.charAt(0)
                    ?.toUpperCase() || "G"}
                </div>
              )}

              <button
                type="button"
                onClick={selectProfilePicture}
                disabled={uploading}
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow-lg"
              >
                {uploading ? "…" : "📷"}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleProfilePicture}
                className="hidden"
              />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-xl font-black text-gray-900">
                {profile.name || "Gamer"}
              </h2>

              <p className="mt-1 truncate text-sm text-gray-500">
                {profile.email}
              </p>

              <p className="mt-1 text-xs font-medium text-gray-400">
                JPG / PNG / WebP • Max 2 MB
              </p>
            </div>
          </div>
        </section>

        {/* PERSONAL INFORMATION */}
        <section className="mt-5 rounded-3xl bg-white p-5 shadow-lg border border-gray-100">
          <div className="mb-4">
            <h2 className="text-lg font-black text-gray-900">
              Personal Information
            </h2>

            <p className="mt-1 text-xs text-gray-400">
              These details cannot be changed.
            </p>
          </div>

          <div className="space-y-4">

            <ReadOnlyField
              label="Full Name"
              value={profile.name}
            />

            <ReadOnlyField
              label="Email"
              value={profile.email}
            />

            <ReadOnlyField
              label="Phone Number"
              value={profile.phone}
            />

            <ReadOnlyField
              label="Referral Code"
              value={profile.referralCode}
            />

          </div>
        </section>

        {/* BIO */}
        <section className="mt-5 rounded-3xl bg-white p-5 shadow-lg border border-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-gray-900">
                About Me
              </h2>

              <p className="mt-1 text-xs text-gray-400">
                You can edit your bio.
              </p>
            </div>

            <span className="text-xs font-bold text-gray-400">
              {bio.length}/30
            </span>
          </div>

          <input
            value={bio}
            onChange={handleBioChange}
            maxLength={30}
            placeholder="Write something about you..."
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm font-medium text-gray-900 outline-none transition focus:border-red-400 focus:bg-white"
          />

          <button
            type="button"
            onClick={saveBio}
            disabled={savingBio}
            className="mt-3 w-full rounded-2xl bg-red-600 py-3.5 font-bold text-white shadow-lg shadow-red-100 transition active:scale-[0.98] disabled:opacity-60"
          >
            {savingBio ? "Saving..." : "Save Bio"}
          </button>
        </section>

        {/* REFERRAL */}
        <section className="mt-5 rounded-3xl bg-gradient-to-br from-green-50 to-white p-5 shadow-lg border border-green-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-green-600">
                Refer & Earn
              </p>

              <h2 className="mt-1 text-xl font-black text-gray-900">
                Invite your friends
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Share your unique referral code.
              </p>
            </div>

            <div className="text-3xl">
              🎁
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-green-200 bg-white p-2">
            <div className="flex-1 px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-gray-400">
                Your Code
              </p>

              <p className="mt-1 text-lg font-black tracking-widest text-green-700">
                {profile.referralCode || "—"}
              </p>
            </div>

            <button
              type="button"
              onClick={copyReferral}
              className="rounded-xl bg-green-100 px-4 py-3 text-sm font-bold text-green-700"
            >
              Copy
            </button>
          </div>

          <button
            type="button"
            onClick={shareReferral}
            className="mt-3 w-full rounded-2xl bg-green-600 py-3.5 font-bold text-white shadow-lg shadow-green-100 transition active:scale-[0.98]"
          >
            📤 Share Referral
          </button>
        </section>

        {/* WALLET */}
        <section className="mt-5 rounded-3xl bg-white p-5 shadow-xl border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                My Wallet
              </p>

              <h2 className="mt-1 text-xl font-black text-gray-900">
                {formatMoney(wallet.total)}
              </h2>

              <p className="text-xs text-gray-400">
                Total wallet balance
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-2xl">
              💰
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">

            <WalletBox
              title="Deposit"
              value={wallet.deposit}
              icon="💳"
            />

            <WalletBox
              title="Bonus"
              value={wallet.bonus}
              icon="🎁"
            />

            <WalletBox
              title="Winning"
              value={wallet.winning}
              icon="🏆"
            />

          </div>

          <Link
            href="/wallet"
            className="mt-4 block rounded-2xl bg-gray-900 py-3.5 text-center font-bold text-white shadow-lg transition active:scale-[0.98]"
          >
            View Wallet
          </Link>
        </section>

      </div>
    </main>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">
        {label}
      </label>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3.5 text-sm font-semibold text-gray-700">
        {value || "Not provided"}
      </div>
    </div>
  );
}

function WalletBox({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
      <div className="text-lg">
        {icon}
      </div>

      <p className="mt-2 text-[11px] font-bold text-gray-400">
        {title}
      </p>

      <p className="mt-1 text-sm font-black text-gray-900">
        ₹{value.toFixed(2)}
      </p>
    </div>
  );
}