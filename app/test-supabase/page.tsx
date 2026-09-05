"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function TestSupabase() {
  const [status, setStatus] = useState("Testing...");

  useEffect(() => {
    async function test() {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id, title")
        .limit(3);

      if (error) {
        setStatus("ERROR: " + error.message);
        return;
      }

      setStatus(
        "CONNECTED ✅\n\n" +
        data.map((t) => `${t.title}\nID: ${t.id}`).join("\n\n")
      );
    }

    test();
  }, []);

  return (
    <main style={{ padding: 30, whiteSpace: "pre-line" }}>
      <h1>Supabase Test</h1>
      <p>{status}</p>
    </main>
  );
}