"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Banner = {
  id: string;
  image_url: string;
  storage_path: string | null;
  click_url: string | null;
  title: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clickUrl, setClickUrl] = useState("");
  const [title, setTitle] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [gameType, setGameType] = useState("home");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  async function checkAdminAndLoad() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/admin/login";
        return;
      }

      const { data: admin } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!admin || admin.role !== "admin") {
        window.location.href = "/";
        return;
      }

      await loadBanners();
    } catch (error) {
      console.error("Banner page error:", error);
      setMessage("Unable to load banners.");
    } finally {
      setLoading(false);
    }
  }

  async function loadBanners() {
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage(error.message);
      return;
    }

    setBanners((data || []) as Banner[]);
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select an image file.");
      e.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("Image must be 2 MB or smaller.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setImageUrl("");
    setSelectedFileName(file.name);
    setMessage("Image selected. Click Add Banner to upload it.");
  }

  async function addBanner(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setSaving(true);

    try {
      let finalImageUrl = imageUrl.trim();
      let storagePath: string | null = null;

      // If a file was selected, upload it to Supabase Storage.
      if (selectedFile) {
        const safeName = selectedFile.name
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

        storagePath = `banners/${Date.now()}-${crypto.randomUUID()}-${safeName || "banner"}`;

        const { error: uploadError } = await supabase.storage
          .from("banners")
          .upload(storagePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: selectedFile.type,
          });

        if (uploadError) {
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        const { data: publicData } = supabase.storage
          .from("banners")
          .getPublicUrl(storagePath);

        finalImageUrl = publicData.publicUrl;
      }

      if (!finalImageUrl) {
        setMessage("Please enter an image URL or upload an image.");
        return;
      }

      // Manual URL is allowed only for http/https.
      if (!selectedFile) {
        try {
          const parsedImageUrl = new URL(finalImageUrl);
          if (!["http:", "https:"].includes(parsedImageUrl.protocol)) {
            throw new Error("Invalid protocol");
          }
        } catch {
          setMessage("Please enter a valid image URL.");
          return;
        }
      }

      const targetUrl = clickUrl.trim();

      if (targetUrl) {
        try {
          const parsed = new URL(targetUrl);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error("Invalid protocol");
          }
        } catch {
          setMessage("Please enter a valid redirect URL (https://...).");
          return;
        }
      }

      const { error } = await supabase.from("banners").insert({
        image_url: finalImageUrl,
        storage_path: storagePath,
        click_url: targetUrl || null,
        title: title.trim() || null,
        is_active: true,
        sort_order: Number(sortOrder) || 0,
        game_type: gameType,
      });

      if (error) {
        // If DB insert fails after a successful upload, clean up the uploaded file.
        if (storagePath) {
          await supabase.storage.from("banners").remove([storagePath]);
        }
        throw new Error(error.message);
      }

      setImageUrl("");
      setSelectedFile(null);
      setSelectedFileName("");
      setClickUrl("");
      setTitle("");
      setSortOrder("0");
      setMessage("Banner uploaded and added successfully.");
      await loadBanners();
    } catch (error) {
      console.error("Add banner error:", error);
      setMessage(
        error instanceof Error ? error.message : "Could not add banner."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleBanner(banner: Banner) {
    const { error } = await supabase
      .from("banners")
      .update({ is_active: !banner.is_active })
      .eq("id", banner.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadBanners();
  }

  async function deleteBanner(banner: Banner) {
    if (!window.confirm("Delete this banner?")) return;

    setMessage("");

    try {
      if (banner.storage_path) {
        const { error: storageError } = await supabase.storage
          .from("banners")
          .remove([banner.storage_path]);

        if (storageError) {
          console.error("Storage delete error:", storageError);
        }
      }

      const { error } = await supabase
        .from("banners")
        .delete()
        .eq("id", banner.id);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Banner and image deleted.");
      await loadBanners();
    } catch (error) {
      console.error("Delete banner error:", error);
      setMessage(
        error instanceof Error ? error.message : "Could not delete banner."
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#070b12] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-black tracking-[2px] text-[#ef1638]">
              GAMERZADDA CONTROL CENTER
            </div>
            <h1 className="mt-1 text-2xl font-black">Banner Management</h1>
            <p className="mt-1 text-xs text-slate-500">
              Upload a banner to Supabase Storage or use an external image URL.
            </p>
          </div>

          <button
            type="button"
            onClick={() => (window.location.href = "/admin")}
            className="rounded-xl border border-slate-700 bg-[#0d1520] px-4 py-2 text-xs font-bold text-slate-200"
          >
            ← Dashboard
          </button>
        </div>

        <section className="mb-7 rounded-2xl border border-slate-800 bg-[#0d1520] p-5">
          <h2 className="mb-4 text-sm font-black">Add New Banner</h2>

          <form onSubmit={addBanner} className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Image URL
              </label>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/banner.jpg"
                className="w-full rounded-xl border border-slate-700 bg-[#080e17] px-4 py-3 text-sm outline-none focus:border-red-500"
              />
              <div className="mt-3">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Upload Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFile}
                  className="block w-full rounded-xl border border-dashed border-slate-700 bg-[#080e17] px-3 py-3 text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-[#ef1638] file:px-3 file:py-2 file:text-xs file:font-black file:text-white"
                />
                {selectedFileName && (
                  <p className="mt-1 text-[9px] text-emerald-400">
                    Selected: {selectedFileName}
                  </p>
                )}
                <p className="mt-1 text-[9px] text-slate-600">
                  JPG, PNG, WEBP etc. • Maximum 2 MB
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Game
              </label>
              <select
                value={gameType}
                onChange={(e) => setGameType(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#080e17] px-4 py-3 text-sm outline-none focus:border-red-500"
              >
                <option value="home">Home</option>
                <option value="freefire">Free Fire</option>
                <option value="freefiremax">Free Fire MAX</option>
                <option value="clashsquad">Clash Squad</option>
                <option value="lonewolf">Lonewolf</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Sort Order
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#080e17] px-4 py-3 text-sm outline-none focus:border-red-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Banner Click URL (Optional)
              </label>
              <input
                value={clickUrl}
                onChange={(e) => setClickUrl(e.target.value)}
                placeholder="https://example.com/tournament"
                className="w-full rounded-xl border border-slate-700 bg-[#080e17] px-4 py-3 text-sm outline-none focus:border-red-500"
              />
              <p className="mt-1 text-[9px] text-slate-600">
                User taps the banner → this URL opens.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Title (Optional)
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summer Tournament"
                className="w-full rounded-xl border border-slate-700 bg-[#080e17] px-4 py-3 text-sm outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-end">
              <button
                disabled={saving}
                className="w-full rounded-xl bg-[#ef1638] px-4 py-3 text-sm font-black disabled:opacity-50"
              >
                {saving ? "Saving..." : "+ Add Banner"}
              </button>
            </div>
          </form>

          {message && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-[#080e17] px-4 py-3 text-xs text-slate-300">
              {message}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black">Banners</h2>
            <span className="text-[10px] font-bold text-slate-500">
              {banners.length} total
            </span>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-[#0d1520] p-8 text-center text-xs text-slate-500">
              Loading banners...
            </div>
          ) : banners.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0d1520] p-8 text-center text-xs text-slate-500">
              No banners added yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {banners.map((banner) => (
                <div
                  key={banner.id}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1520]"
                >
                  <div className="aspect-[2.4/1] bg-black">
                    <img
                      src={banner.image_url}
                      alt={banner.title || "Gamerzadda banner"}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.opacity = "0.25";
                      }}
                    />
                  </div>

                  <div className="p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black">
                          {banner.title || "Untitled Banner"}
                        </div>
                        <div className="mt-1 truncate text-[10px] text-slate-500">
                          {banner.image_url}
                        </div>
                        {banner.click_url && (
                          <div className="mt-1 truncate text-[10px] text-emerald-500">
                            Click → {banner.click_url}
                          </div>
                        )}
                        <div className="mt-2 text-[10px] text-slate-600">
                          Order: {banner.sort_order}
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${
                          banner.is_active
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-slate-700/50 text-slate-500"
                        }`}
                      >
                        {banner.is_active ? "ACTIVE" : "OFF"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => toggleBanner(banner)}
                        className="rounded-xl border border-slate-700 bg-[#101a27] px-3 py-2 text-[10px] font-black"
                      >
                        {banner.is_active ? "Disable" : "Enable"}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteBanner(banner)}
                        className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[10px] font-black text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
